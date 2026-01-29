import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';
import { assembleContext } from '../claude/context.js';
import { spawnClaude, killProcess } from '../claude/spawn.js';
import type { WsClientMessage, WsServerMessage } from '../../../shared/types.js';

const MEMORY_UPDATE_INTERVAL = 10;

function send(ws: WebSocket, msg: WsServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function updateMemory(sessionId: string) {
  const db = getDb();
  const msgCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE session_id = ?').get(sessionId) as { c: number };
  if (msgCount.c % MEMORY_UPDATE_INTERVAL !== 0) return;

  const messages = db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(sessionId) as { role: string; content: string }[];

  const summary = messages
    .reverse()
    .map(m => `${m.role}: ${m.content.substring(0, 100)}`)
    .join(' | ');

  db.prepare("UPDATE memory SET summary = ?, updated_at = datetime('now') WHERE session_id = ?")
    .run(`Conversation summary (${msgCount.c} messages): ${summary.substring(0, 500)}`, sessionId);
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.on('message', (raw) => {
      console.log('[WS] Received:', raw.toString().substring(0, 200));
      let msg: WsClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        console.log('[WS] Failed to parse message');
        return;
      }

      if (msg.type === 'chat:send') {
        console.log(`[WS] chat:send session=${msg.sessionId} content="${msg.content.substring(0, 50)}" images=${(msg.images || []).length} model=${msg.model || 'default'} thinking=${!!msg.thinking}`);
        try {
          handleChatSend(ws, msg.sessionId, msg.content, msg.images, msg.model, msg.thinking);
        } catch (err: any) {
          console.error(`[WS] handleChatSend error:`, err);
          send(ws, { type: 'chat:error', sessionId: msg.sessionId, error: err.message });
        }
      } else if (msg.type === 'chat:stop') {
        killProcess(msg.sessionId);
      }
    });
    ws.on('close', () => console.log('[WS] Client disconnected'));
  });
}

function handleChatSend(ws: WebSocket, sessionId: string, content: string, images?: string[], model?: string, thinking?: boolean) {
  const db = getDb();

  // Save user message
  const userMsgId = uuid();
  db.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)')
    .run(userMsgId, sessionId, 'user', content);
  console.log(`[CHAT] Saved user message ${userMsgId}`);

  // Update session timestamp
  db.prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);

  // Build message for Claude — append image references if present
  let claudeContent = content;
  if (images && images.length > 0) {
    const imageRefs = images.map(p => `[Attached image: ${p}]`).join('\n');
    claudeContent = `${content}\n\n${imageRefs}\n\nThe user attached ${images.length} image(s). Read them using the file read tool to see what was shared.`;
  }

  // Assemble context
  let ctx: ReturnType<typeof assembleContext>;
  try {
    ctx = assembleContext(sessionId, claudeContent, model);
    console.log(`[CHAT] Context assembled: model=${ctx.model}, systemPrompt=${ctx.systemPrompt.substring(0, 80)}...`);
    console.log(`[CHAT] Full message length: ${ctx.fullMessage.length}`);
  } catch (err: any) {
    console.error(`[CHAT] Context assembly error:`, err.message);
    send(ws, { type: 'chat:error', sessionId, error: err.message });
    return;
  }

  const assistantMsgId = uuid();
  let fullText = '';
  const toolInteractions: { tool: string; input: unknown; result?: string }[] = [];

  console.log(`[CHAT] Spawning claude...`);
  spawnClaude(
    sessionId,
    ctx.fullMessage,
    {
      systemPrompt: ctx.systemPrompt,
      model: ctx.model,
      thinking: !!thinking,
      allowedTools: ctx.allowedTools,
      disallowedTools: ctx.disallowedTools,
    },
    (event) => {
      switch (event.type) {
        case 'text':
          fullText += event.content || '';
          send(ws, { type: 'chat:chunk', sessionId, content: event.content || '' });
          break;

        case 'tool_use':
          toolInteractions.push({ tool: event.tool || '', input: event.toolInput || {} });
          send(ws, {
            type: 'chat:tool_use',
            sessionId,
            tool: event.tool || '',
            input: event.toolInput || {},
          });
          break;

        case 'tool_result':
          // Attach result to last tool interaction
          const last = toolInteractions[toolInteractions.length - 1];
          if (last) last.result = event.toolResult;
          send(ws, {
            type: 'chat:tool_result',
            sessionId,
            tool: event.tool || '',
            result: event.toolResult || '',
          });
          break;

        case 'done': {
          const finalText = event.content || fullText;

          // Save assistant message with tool interactions
          db.prepare('INSERT INTO messages (id, session_id, role, content, tool_use) VALUES (?, ?, ?, ?, ?)')
            .run(
              assistantMsgId,
              sessionId,
              'assistant',
              finalText,
              toolInteractions.length > 0 ? JSON.stringify(toolInteractions) : null,
            );

          send(ws, {
            type: 'chat:done',
            sessionId,
            messageId: assistantMsgId,
            cost: event.cost,
          });

          // Auto-update memory
          updateMemory(sessionId);

          // Auto-title on first exchange
          const msgCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE session_id = ?').get(sessionId) as { c: number };
          if (msgCount.c === 2) {
            const title = content.substring(0, 60) + (content.length > 60 ? '...' : '');
            db.prepare("UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, sessionId);
          }
          break;
        }

        case 'error':
          send(ws, { type: 'chat:error', sessionId, error: event.content || 'Unknown error' });
          break;
      }
    },
  );
}
