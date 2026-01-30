import { getDb } from '../db/connection.js';
import type { Skill, Memory, Message, PermissionMode, Api } from '../../../shared/types.js';

const MAX_HISTORY = 20;

interface ContextResult {
  systemPrompt: string;
  model: string;
  /** Full user message with conversation history prepended */
  fullMessage: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  maxTurns?: number;
}

// Write/destructive tools blocked in Explore mode
const EXPLORE_DISALLOWED_TOOLS = [
  'Bash', 'Write', 'Edit', 'NotebookEdit', 'Task', 'TaskOutput',
  'mcp__chrome-devtools__click',
  'mcp__chrome-devtools__fill',
  'mcp__chrome-devtools__fill_form',
  'mcp__chrome-devtools__drag',
  'mcp__chrome-devtools__evaluate_script',
  'mcp__chrome-devtools__handle_dialog',
  'mcp__chrome-devtools__navigate_page',
  'mcp__chrome-devtools__new_page',
  'mcp__chrome-devtools__press_key',
  'mcp__chrome-devtools__upload_file',
];

export function assembleContext(sessionId: string, userMessage: string, modelOverride?: string, mode?: PermissionMode): ContextResult {
  const db = getDb();

  // Get agent info + project path
  const session = db.prepare(`
    SELECT a.system_prompt, a.name as agent_name, a.model, p.path as project_path, p.name as project_name, p.id as project_id, p.dev_port
    FROM sessions s
    JOIN agents a ON s.agent_id = a.id
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = ?
  `).get(sessionId) as { system_prompt: string; agent_name: string; model: string; project_path: string | null; project_name: string; project_id: string; dev_port: number | null } | undefined;

  if (!session) throw new Error('Session not found');

  // Build system prompt from: agent prompt + environment info + skills + memory
  const systemParts: string[] = [];
  systemParts.push(session.system_prompt);

  // Environment context — include project-specific path when available
  const envLines = [
    '- You have full access to Bash, file tools, WebFetch, WebSearch, and Chrome DevTools (browser)',
    '- The Chrome browser is running and you can navigate, screenshot, click, and inspect any website',
  ];

  if (session.project_path) {
    const folderName = session.project_path.split('/').pop();
    envLines.unshift(
      `- You are working on the "${session.project_name}" project`,
      `- Project directory: ${session.project_path}`,
      `- All code changes should be made inside ${session.project_path}`,
      `- When creating or modifying files, always work within the project directory`,
      `- CRITICAL: Port 3001 is reserved by the platform. NEVER kill processes on port 3001 or any other port you did not start. If a port is in use, pick another port in the 3100-3999 range instead of killing existing processes.`,
    );
    if (session.dev_port) {
      envLines.push(
        `- This project's dev server port is ${session.dev_port}. Always start the dev server on this port.`,
        `- Preview URL: https://${folderName}.agents.wpgens.com/ (subdomain proxies to port ${session.dev_port})`,
        `- Static files are also at: https://agents.wpgens.com/preview/${folderName}/`,
        `- IMPORTANT: Do NOT set basePath, PUBLIC_URL, or any path prefix in the project config. The app is served at the root "/" via subdomain.`,
      );
    } else {
      envLines.push(
        `- Preview URL (static files): https://agents.wpgens.com/preview/${folderName}/`,
        `- If this project needs a dev server (Next.js, Vite, etc.), use a port in the 3100-3999 range. Check which ports are free first with: ss -tlnp | grep -E '31[0-9]{2}'`,
      );
    }
  } else {
    envLines.unshift(
      '- You can create projects in /home/claude/projects/<project-name>/',
      '- Static files are served at https://agents.wpgens.com/preview/<project-name>/',
      '- For dynamic apps, use subdomain: https://<project-name>.agents.wpgens.com/ (requires dev_port set on project)',
      '- CRITICAL: Port 3001 is reserved by the platform. NEVER kill processes on port 3001. When running dev servers, use ports 3100-3999. If a port is in use, pick another port in that range instead of killing the existing process.',
    );
  }
  envLines.push('- When creating web projects, always provide the preview URL to the user');
  systemParts.push('Environment info:\n' + envLines.join('\n'));

  // Style instructions
  systemParts.push(`Response style:
- Do not use emojis, emoticons, or decorative icons in your responses
- Write in plain, direct prose — no bullet-point-heavy formatting unless listing specific items
- Use proper paragraph spacing between ideas
- Keep responses conversational and natural, not overly structured`);

  // Enabled skills
  const skills = db.prepare(`
    SELECT sk.name, sk.prompt FROM skills sk
    JOIN session_skills ss ON ss.skill_id = sk.id
    WHERE ss.session_id = ? AND ss.enabled = 1
    ORDER BY sk.name ASC
  `).all(sessionId) as Pick<Skill, 'name' | 'prompt'>[];

  if (skills.length > 0) {
    systemParts.push('Active skills:\n' + skills.map(s => `- ${s.name}: ${s.prompt}`).join('\n'));
  }

  // Enabled APIs
  const apis = db.prepare(`
    SELECT a.name, a.description, a.base_url, a.auth_type, a.auth_config, a.spec FROM apis a
    JOIN session_apis sa ON sa.api_id = a.id
    WHERE sa.session_id = ? AND sa.enabled = 1
    ORDER BY a.name ASC
  `).all(sessionId) as Pick<Api, 'name' | 'description' | 'base_url' | 'auth_type' | 'auth_config' | 'spec'>[];

  if (apis.length > 0) {
    const apiDocs = apis.map(a => {
      const lines = [`- ${a.name}: ${a.description || 'No description'}`, `  Base URL: ${a.base_url}`];
      if (a.auth_type !== 'none') {
        try {
          const config = JSON.parse(a.auth_config || '{}');
          switch (a.auth_type) {
            case 'bearer':
              lines.push(`  Auth: Include header "Authorization: Bearer ${config.token || '<token>'}"`);
              break;
            case 'header':
              lines.push(`  Auth: Include header "${config.header_name || 'X-Api-Key'}: ${config.header_value || '<value>'}"`);
              break;
            case 'query':
              lines.push(`  Auth: Include query parameter "${config.param_name || 'api_key'}=${config.param_value || '<value>'}"`);
              break;
            case 'basic':
              lines.push(`  Auth: Use HTTP Basic Auth with username "${config.username || ''}" and password "${config.password || ''}"`);
              break;
          }
        } catch {
          lines.push(`  Auth type: ${a.auth_type}`);
        }
      }
      if (a.spec) {
        lines.push(`  API docs:\n${a.spec}`);
      }
      return lines.join('\n');
    }).join('\n\n');
    systemParts.push('Available APIs (use WebFetch or curl to call these):\n' + apiDocs);
  }

  // Project memory
  const projectMemory = db.prepare('SELECT * FROM project_memory WHERE project_id = ?').get(session.project_id) as Memory | undefined;
  if (projectMemory?.summary) {
    systemParts.push(`Project memory (shared across all sessions in this project):\n${projectMemory.summary}`);
  }

  // Session memory
  const memory = db.prepare('SELECT * FROM memory WHERE session_id = ?').get(sessionId) as Memory | undefined;
  if (memory?.summary) {
    systemParts.push(`Session memory:\n${memory.summary}`);
  }

  // Build full message with conversation history
  const messages = db.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(sessionId, MAX_HISTORY) as Pick<Message, 'role' | 'content'>[];

  const messageParts: string[] = [];
  if (messages.length > 0) {
    const history = messages.reverse().map(m =>
      `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`
    ).join('\n\n');
    messageParts.push(`Previous conversation:\n${history}\n\n---\n`);
  }
  messageParts.push(userMessage);

  // Tool configuration from settings
  const allowedToolsSetting = db.prepare("SELECT value FROM settings WHERE key = 'allowed_tools'").get() as { value: string } | undefined;
  const disallowedToolsSetting = db.prepare("SELECT value FROM settings WHERE key = 'disallowed_tools'").get() as { value: string } | undefined;
  let allowedTools = allowedToolsSetting ? JSON.parse(allowedToolsSetting.value) as string[] : undefined;
  let disallowedTools = disallowedToolsSetting ? JSON.parse(disallowedToolsSetting.value) as string[] : undefined;

  // Apply permission mode
  const effectiveMode = mode || 'execute';
  if (effectiveMode === 'explore') {
    // Block all write/destructive tools via disallowedTools (allowedTools is ignored by CLI)
    allowedTools = undefined;
    disallowedTools = EXPLORE_DISALLOWED_TOOLS;
    systemParts.push(`You are in READ-ONLY "Explore" mode. You can ONLY read and search — you cannot create, modify, or delete any files or run any commands. The tools Bash, Write, Edit, NotebookEdit, and Task are disabled. If the user asks you to make changes, explain that you are in Explore mode and cannot modify anything. Do NOT claim you have made changes when you have not.`);
  } else if (effectiveMode === 'ask') {
    // Add system prompt instruction to confirm before edits
    systemParts.push(`CRITICAL RULE - "Ask" mode is active. You MUST follow this protocol strictly:

1. NEVER use Bash, Write, Edit, or NotebookEdit tools in the same response where you describe what you plan to do.
2. When the user requests ANY change (create, modify, delete files or run commands that modify state), you MUST respond with ONLY a text description of what you plan to do and ask "Should I proceed?"
3. Only after the user replies with explicit confirmation (e.g. "yes", "go ahead", "do it") in a SUBSEQUENT message may you execute the change.
4. Read-only operations (Read, Glob, Grep, WebFetch, WebSearch) do NOT require confirmation.
5. Even if the user's message sounds like both a request and approval (e.g. "put the file back"), you MUST still describe your plan first and wait for confirmation in a separate message.

This is a hard constraint. Do not combine your confirmation question with tool execution in the same turn.`);
  }
  // 'execute' mode: no restrictions (current default behavior)

  // Determine model: per-message override > settings default > agent model
  const defaultModelSetting = db.prepare("SELECT value FROM settings WHERE key = 'default_model'").get() as { value: string } | undefined;
  const resolvedModel = modelOverride || defaultModelSetting?.value || session.model || 'sonnet';

  return {
    systemPrompt: systemParts.join('\n\n'),
    model: resolvedModel,
    fullMessage: messageParts.join('\n'),
    allowedTools: allowedTools?.length ? allowedTools : undefined,
    disallowedTools: disallowedTools?.length ? disallowedTools : undefined,
    maxTurns: undefined,
  };
}
