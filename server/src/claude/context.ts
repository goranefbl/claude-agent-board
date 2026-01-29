import { getDb } from '../db/connection.js';
import type { Skill, Memory, Message } from '../../../shared/types.js';

const MAX_HISTORY = 20;

interface ContextResult {
  systemPrompt: string;
  model: string;
  /** Full user message with conversation history prepended */
  fullMessage: string;
}

export function assembleContext(sessionId: string, userMessage: string): ContextResult {
  const db = getDb();

  // Get agent info + project path
  const session = db.prepare(`
    SELECT a.system_prompt, a.name as agent_name, a.model, p.path as project_path, p.name as project_name
    FROM sessions s
    JOIN agents a ON s.agent_id = a.id
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = ?
  `).get(sessionId) as { system_prompt: string; agent_name: string; model: string; project_path: string | null; project_name: string } | undefined;

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

  // Memory
  const memory = db.prepare('SELECT * FROM memory WHERE session_id = ?').get(sessionId) as Memory | undefined;
  if (memory && (memory.summary || memory.pinned_facts !== '[]')) {
    let memBlock = 'Session memory:';
    if (memory.summary) memBlock += `\nSummary: ${memory.summary}`;
    const facts = JSON.parse(memory.pinned_facts) as string[];
    if (facts.length > 0) memBlock += `\nKey facts:\n${facts.map(f => `- ${f}`).join('\n')}`;
    systemParts.push(memBlock);
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

  return {
    systemPrompt: systemParts.join('\n\n'),
    model: session.model || 'sonnet',
    fullMessage: messageParts.join('\n'),
  };
}
