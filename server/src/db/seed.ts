import { v4 as uuid } from 'uuid';
import { getDb } from './connection.js';

// Fixed ID for the General project — always exists, hidden from UI project list
export const GENERAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

export function seed() {
  const db = getDb();

  // Always ensure General project exists
  const generalExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(GENERAL_PROJECT_ID);
  if (!generalExists) {
    db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)')
      .run(GENERAL_PROJECT_ID, 'General', 'Default project for general chats');
  }

  const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number };
  if (agentCount.c > 0) return;

  const agents = [
    {
      id: uuid(),
      name: 'Builder',
      system_prompt: 'You are a senior software engineer. Help the user build software by writing clean, well-structured code. Focus on practical implementations, best practices, and clear explanations of your design decisions.',
      icon: '🔨',
      is_default: 1,
    },
    {
      id: uuid(),
      name: 'Researcher',
      system_prompt: 'You are a research assistant. Help the user explore topics thoroughly by finding information, analyzing data, and synthesizing findings into clear summaries. Be thorough and cite your reasoning.',
      icon: '🔍',
      is_default: 0,
    },
    {
      id: uuid(),
      name: 'Debugger',
      system_prompt: 'You are an expert debugger. Help the user identify and fix bugs in their code. Analyze error messages, trace logic flows, suggest fixes, and explain root causes clearly.',
      icon: '🐛',
      is_default: 0,
    },
    {
      id: uuid(),
      name: 'Writer',
      system_prompt: 'You are a technical writer. Help the user create clear documentation, README files, blog posts, and other written content. Focus on clarity, structure, and audience-appropriate language.',
      icon: '✍️',
      is_default: 0,
    },
  ];

  const insertAgent = db.prepare(
    'INSERT INTO agents (id, name, system_prompt, icon, is_default) VALUES (?, ?, ?, ?, ?)'
  );

  for (const agent of agents) {
    insertAgent.run(agent.id, agent.name, agent.system_prompt, agent.icon, agent.is_default);
  }

  const skills = [
    {
      id: uuid(),
      name: 'Code Review',
      slug: 'code-review',
      description: 'Adds code review guidelines to the context',
      prompt: `# Code Review

When reviewing code, check for:
- **Correctness**: Does the code do what it's supposed to?
- **Edge cases**: Are boundary conditions handled?
- **Performance**: Any obvious bottlenecks or N+1 queries?
- **Readability**: Is the code clear and well-named?
- **Security**: Any injection, XSS, or auth vulnerabilities?
- **Best practices**: Does it follow language/framework conventions?

Provide specific, actionable feedback with file:line references.`,
      is_global: 1,
      scope: 'global',
      icon: '🔍',
    },
    {
      id: uuid(),
      name: 'Concise Output',
      slug: 'concise-output',
      description: 'Requests shorter, more focused responses',
      prompt: `# Concise Output

Keep responses concise and focused:
- Use bullet points and code blocks
- Avoid unnecessary explanations unless asked
- Prefer showing code over describing it
- No filler phrases or pleasantries
- Get straight to the answer`,
      is_global: 1,
      scope: 'global',
      icon: '✂️',
    },
    {
      id: uuid(),
      name: 'Testing',
      slug: 'testing',
      description: 'Testing best practices and patterns',
      prompt: `# Testing Best Practices

When writing or discussing tests:
- Test behavior, not implementation details
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Include edge cases and error scenarios
- Aim for meaningful coverage, not 100%
- Prefer integration tests for critical paths
- Use mocks sparingly, only at system boundaries`,
      is_global: 1,
      scope: 'global',
      icon: '🧪',
    },
  ];

  const insertSkill = db.prepare(
    'INSERT INTO skills (id, name, slug, description, prompt, is_global, scope, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const skill of skills) {
    insertSkill.run(skill.id, skill.name, skill.slug, skill.description, skill.prompt, skill.is_global, skill.scope, skill.icon);
  }
}
