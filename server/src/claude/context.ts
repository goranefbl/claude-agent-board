import { getDb } from '../db/connection.js';
import type { Skill, Memory, Message, PermissionMode } from '../../../shared/types.js';

const MAX_HISTORY = 20;

interface ContextResult {
  systemPrompt: string;
  model: string;
  /** Full user message with conversation history prepended */
  fullMessage: string;
  allowedTools?: string[];
  disallowedTools?: string[];
}

// Read-only tools for Explore mode
const EXPLORE_ALLOWED_TOOLS = [
  'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task',
  'mcp__chrome-devtools__take_screenshot',
  'mcp__chrome-devtools__take_snapshot',
  'mcp__chrome-devtools__list_pages',
  'mcp__chrome-devtools__list_network_requests',
  'mcp__chrome-devtools__list_console_messages',
  'mcp__chrome-devtools__get_network_request',
  'mcp__chrome-devtools__get_console_message',
];

export function assembleContext(sessionId: string, userMessage: string, modelOverride?: string, mode?: PermissionMode): ContextResult {
  const db = getDb();

  // Get agent info + project path
  const session = db.prepare(`
    SELECT a.system_prompt, a.name as agent_name, a.model, p.path as project_path, p.name as project_name, p.id as project_id
    FROM sessions s
    JOIN agents a ON s.agent_id = a.id
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = ?
  `).get(sessionId) as { system_prompt: string; agent_name: string; model: string; project_path: string | null; project_name: string; project_id: string } | undefined;

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
      `- Preview URL: https://agents.wpgens.com/preview/${folderName}/`,
      `- When creating or modifying files, always work within the project directory`,
    );
  } else {
    envLines.unshift(
      '- You can create projects in /home/claude/projects/<project-name>/',
      '- Files placed there are served at https://agents.wpgens.com/preview/<project-name>/',
      '- For example, creating /home/claude/projects/my-site/index.html makes it viewable at https://agents.wpgens.com/preview/my-site/',
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
    // Override tool settings — only allow read-only tools
    allowedTools = EXPLORE_ALLOWED_TOOLS;
    disallowedTools = undefined;
  } else if (effectiveMode === 'ask') {
    // Add system prompt instruction to confirm before edits
    systemParts.push(`IMPORTANT: You are in "Ask" mode. Before making ANY file changes (writing, editing, creating, or deleting files), you MUST first describe what you plan to change and ask the user for explicit confirmation. Do not use Write, Edit, Bash (for file modifications), or NotebookEdit tools without first getting user approval. Read-only operations do not require confirmation.`);
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
  };
}
