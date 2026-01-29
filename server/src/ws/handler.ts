import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { spawn as cpSpawn } from 'child_process';
import { getDb } from '../db/connection.js';
import { assembleContext } from '../claude/context.js';
import { spawnClaude, killProcess } from '../claude/spawn.js';
import type { WsClientMessage, WsServerMessage, PermissionMode } from '../../../shared/types.js';

function send(ws: WebSocket, msg: WsServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function autoSummarize(sessionId: string) {
  try {
    const db = getDb();

    // Check project's auto_summarize flag
    const session = db.prepare(
      'SELECT p.auto_summarize FROM sessions s JOIN projects p ON s.project_id = p.id WHERE s.id = ?'
    ).get(sessionId) as { auto_summarize: number } | undefined;
    if (!session || !session.auto_summarize) return;

    // Get last 20 messages
    const messages = db.prepare(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all(sessionId) as { role: string; content: string }[];
    if (messages.length < 2) return;

    const transcript = messages
      .reverse()
      .map(m => `${m.role}: ${m.content.substring(0, 500)}`)
      .join('\n\n');

    const prompt = `Summarize this conversation for context continuity. Focus on what was discussed, decisions made, and current state. Under 200 words.\n\n${transcript}`;

    const summary = await new Promise<string>((resolve, reject) => {
      const args = [
        '--print',
        '--model', 'haiku',
        '--max-turns', '1',
        prompt,
      ];

      const child = cpSpawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env, HOME: process.env.HOME || '/home/claude' },
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) resolve(stdout.trim());
        else reject(new Error(stderr || `exit code ${code}`));
      });
      child.on('error', reject);
    });

    db.prepare("UPDATE memory SET summary = ?, updated_at = datetime('now') WHERE session_id = ?")
      .run(summary, sessionId);
  } catch (err) {
    console.error('[MEMORY] Auto-summarize failed:', err);
  }
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
        console.log(`[WS] chat:send session=${msg.sessionId} content="${msg.content.substring(0, 50)}" images=${(msg.images || []).length} model=${msg.model || 'default'} thinking=${!!msg.thinking} mode=${msg.mode || 'execute'}`);
        try {
          handleChatSend(ws, msg.sessionId, msg.content, msg.images, msg.model, msg.thinking, msg.mode);
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

function handleChatSend(ws: WebSocket, sessionId: string, content: string, images?: string[], model?: string, thinking?: boolean, mode?: PermissionMode) {
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
    ctx = assembleContext(sessionId, claudeContent, model, mode);
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
      maxTurns: ctx.maxTurns,
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

          // Auto-update memory (fire-and-forget)
          autoSummarize(sessionId);

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
