import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_CONFIG = path.join(__dirname, '..', '..', '..', 'mcp-config.json');
const activeProcesses = new Map<string, ChildProcess>();

export interface SpawnOptions {
  systemPrompt: string;
  model?: string;
  allowedTools?: string[];
}

export interface StreamEvent {
  type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
  content?: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  cost?: number;
  sessionId?: string;
}

type EventHandler = (event: StreamEvent) => void;

export function spawnClaude(
  sessionId: string,
  userMessage: string,
  options: SpawnOptions,
  onEvent: EventHandler,
) {
  // Kill any existing process for this session
  killProcess(sessionId);

  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--mcp-config', MCP_CONFIG,
    '--system-prompt', options.systemPrompt,
  ];

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.allowedTools && options.allowedTools.length > 0) {
    args.push('--allowedTools', ...options.allowedTools);
  }

  // Pass user message as the prompt argument
  args.push(userMessage);

  console.log(`[SPAWN] Running: claude ${args.map(a => a.length > 80 ? a.substring(0, 80) + '...' : a).join(' ')}`);
  console.log(`[SPAWN] Args count: ${args.length}`);

  const child = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, HOME: process.env.HOME || '/home/claude' },
  });

  console.log(`[SPAWN] Process started, pid=${child.pid}`);
  activeProcesses.set(sessionId, child);

  let buffer = '';
  let fullText = '';
  let stderrText = '';
  const toolInteractions: { tool: string; input: unknown; result?: string }[] = [];

  child.stdout.on('data', (data: Buffer) => {
    const chunk = data.toString();
    console.log(`[SPAWN] stdout chunk (${chunk.length} bytes): ${chunk.substring(0, 200)}`);
    buffer += chunk;

    // Process complete lines (newline-delimited JSON)
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete last line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        console.log(`[SPAWN] Parsed event type=${event.type} subtype=${event.subtype || ''}`);
        processEvent(event, sessionId, onEvent, (t) => { fullText += t; }, toolInteractions);
      } catch (e: any) {
        console.log(`[SPAWN] Failed to parse line: ${line.substring(0, 100)} err=${e.message}`);
      }
    }
  });

  child.stderr.on('data', (data: Buffer) => {
    const chunk = data.toString();
    console.log(`[SPAWN] stderr: ${chunk.substring(0, 500)}`);
    stderrText += chunk;
  });

  child.on('close', (code) => {
    console.log(`[SPAWN] Process closed, code=${code}, fullText.length=${fullText.length}`);
    activeProcesses.delete(sessionId);

    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer);
        processEvent(event, sessionId, onEvent, (t) => { fullText += t; }, toolInteractions);
      } catch {
        // ignore
      }
    }

    if (code !== 0 && code !== null && !fullText) {
      console.log(`[SPAWN] Error exit. stderr: ${stderrText}`);
      onEvent({ type: 'error', content: stderrText || `Process exited with code ${code}` });
    }
  });

  child.on('error', (err) => {
    console.error(`[SPAWN] Process error:`, err.message);
    activeProcesses.delete(sessionId);
    onEvent({ type: 'error', content: err.message });
  });
}

function processEvent(
  raw: any,
  sessionId: string,
  onEvent: EventHandler,
  appendText: (t: string) => void,
  toolInteractions: { tool: string; input: unknown; result?: string }[],
) {
  if (raw.type === 'system' && raw.subtype === 'init') {
    onEvent({ type: 'init', sessionId: raw.session_id });
    return;
  }

  if (raw.type === 'assistant' && raw.message?.content) {
    for (const block of raw.message.content) {
      if (block.type === 'text' && block.text) {
        appendText(block.text);
        onEvent({ type: 'text', content: block.text });
      } else if (block.type === 'tool_use') {
        toolInteractions.push({ tool: block.name, input: block.input });
        onEvent({
          type: 'tool_use',
          tool: block.name,
          toolInput: block.input,
        });
      }
    }
  }

  if (raw.type === 'user' && raw.tool_use_result) {
    const result = typeof raw.tool_use_result.result === 'string'
      ? raw.tool_use_result.result
      : JSON.stringify(raw.tool_use_result.result);
    // Attach result to last matching tool interaction
    const last = toolInteractions[toolInteractions.length - 1];
    if (last) last.result = result;
    onEvent({
      type: 'tool_result',
      tool: last?.tool || 'unknown',
      toolResult: result.substring(0, 2000), // Truncate for WS
    });
  }

  if (raw.type === 'result') {
    onEvent({
      type: 'done',
      content: raw.result || '',
      cost: raw.total_cost_usd,
    });
  }
}

export function killProcess(sessionId: string): boolean {
  const child = activeProcesses.get(sessionId);
  if (child) {
    child.kill('SIGTERM');
    activeProcesses.delete(sessionId);
    return true;
  }
  return false;
}

export function getToolInteractions(): string {
  return ''; // Placeholder - interactions are tracked per-spawn call now
}
