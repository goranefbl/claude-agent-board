#!/usr/bin/env tsx
/**
 * Project Manager MCP Server
 *
 * Implements Model Context Protocol (JSON-RPC 2.0 over stdio) to expose
 * project management tools to Claude agents.
 *
 * Tools:
 *   - create_project: Create a new project with a workspace folder
 *   - clone_project: Create a project and clone a git repo into it
 *   - list_projects: List all projects in the system
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

// --- DB setup (same path as main server) ---
const DB_PATH = join(import.meta.dirname || new URL('.', import.meta.url).pathname, '..', '..', 'chat.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const PROJECTS_ROOT = '/home/claude/projects';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

// --- MCP Protocol Implementation ---

const TOOLS = [
  {
    name: 'create_project',
    description: 'Create a new project in the system with a workspace folder on disk. Returns the project ID and path.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Project name' },
        description: { type: 'string', description: 'Project description (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'clone_project',
    description: 'Create a new project and clone a git repository into its workspace folder. Returns the project ID and path.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Project name' },
        git_url: { type: 'string', description: 'Git repository URL to clone' },
        description: { type: 'string', description: 'Project description (optional)' },
      },
      required: ['name', 'git_url'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects in the system with their IDs, names, and paths.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_project_memory',
    description: 'Read the shared project memory for a project. Project memory persists across all sessions and contains important context like server configuration, startup commands, and recovery steps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'update_project_memory',
    description: 'Update the shared project memory for a project. Use this to save important project context that should persist across sessions, such as: architecture decisions, known issues, working notes, and other context for future sessions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        summary: { type: 'string', description: 'The full project memory content (replaces existing).' },
      },
      required: ['project_id', 'summary'],
    },
  },
  {
    name: 'get_server_config',
    description: 'Read the server configuration for a project. Server config contains startup commands, dependencies, health checks, and recovery steps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'update_server_config',
    description: 'Update the server configuration for a project. Use this after setting up a new project or changing how the dev server runs. Include: start command, required services (databases, etc.), health check command, and any recovery steps.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        server_config: { type: 'string', description: 'Server config content. Include start command, dependencies, health check, and recovery steps.' },
      },
      required: ['project_id', 'server_config'],
    },
  },
];

function handleInitialize(id: number | string) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'project-manager', version: '1.0.0' },
    },
  };
}

function handleToolsList(id: number | string) {
  return {
    jsonrpc: '2.0',
    id,
    result: { tools: TOOLS },
  };
}

function handleToolCall(id: number | string, params: { name: string; arguments?: Record<string, unknown> }) {
  const { name, arguments: args = {} } = params;

  try {
    switch (name) {
      case 'create_project': {
        const projectName = args.name as string;
        if (!projectName) throw new Error('name is required');
        const description = (args.description as string) || '';

        const projectId = randomUUID();
        const slug = slugify(projectName);
        const projectPath = join(PROJECTS_ROOT, slug);
        if (!existsSync(projectPath)) mkdirSync(projectPath, { recursive: true });

        db.prepare('INSERT INTO projects (id, name, description, path, git_push_disabled) VALUES (?, ?, ?, ?, 1)')
          .run(projectId, projectName, description, projectPath);

        return success(id, `Project created successfully.\n\nID: ${projectId}\nName: ${projectName}\nPath: ${projectPath}\n\nThe project folder has been created and registered in the system. It will appear in the sidebar after a page refresh.`);
      }

      case 'clone_project': {
        const projectName = args.name as string;
        const gitUrl = args.git_url as string;
        if (!projectName) throw new Error('name is required');
        if (!gitUrl) throw new Error('git_url is required');
        const description = (args.description as string) || '';

        const projectId = randomUUID();
        const slug = slugify(projectName);
        const projectPath = join(PROJECTS_ROOT, slug);
        if (!existsSync(projectPath)) mkdirSync(projectPath, { recursive: true });

        // Clone the repository
        try {
          execSync(`git clone ${JSON.stringify(gitUrl)} .`, {
            cwd: projectPath,
            timeout: 120_000,
            stdio: 'pipe',
          });
        } catch (err: any) {
          // Clean up on failure
          try { execSync(`rm -rf ${JSON.stringify(projectPath)}`); } catch { /* ignore */ }
          throw new Error(`Git clone failed: ${err.stderr?.toString() || err.message}`);
        }

        db.prepare('INSERT INTO projects (id, name, description, path, git_push_disabled, git_origin_url) VALUES (?, ?, ?, ?, 1, ?)')
          .run(projectId, projectName, description, projectPath, gitUrl);

        return success(id, `Project created and repository cloned successfully.\n\nID: ${projectId}\nName: ${projectName}\nPath: ${projectPath}\nCloned from: ${gitUrl}\n\nThe project will appear in the sidebar after a page refresh.`);
      }

      case 'list_projects': {
        const rows = db.prepare("SELECT id, name, description, path FROM projects WHERE id != '00000000-0000-0000-0000-000000000000' ORDER BY name ASC").all() as {
          id: string; name: string; description: string; path: string | null;
        }[];

        if (rows.length === 0) {
          return success(id, 'No projects found.');
        }

        const list = rows.map(r => `- ${r.name} (ID: ${r.id})${r.path ? `\n  Path: ${r.path}` : ''}`).join('\n');
        return success(id, `Found ${rows.length} project(s):\n\n${list}`);
      }

      case 'get_project_memory': {
        const projectId = args.project_id as string;
        if (!projectId) throw new Error('project_id is required');

        const row = db.prepare('SELECT summary FROM project_memory WHERE project_id = ?').get(projectId) as { summary: string | null } | undefined;
        if (!row || !row.summary) {
          return success(id, 'No project memory set for this project.');
        }
        return success(id, row.summary);
      }

      case 'update_project_memory': {
        const projectId = args.project_id as string;
        const summary = args.summary as string;
        if (!projectId) throw new Error('project_id is required');
        if (!summary) throw new Error('summary is required');

        // Verify project exists
        const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as { id: string } | undefined;
        if (!project) throw new Error(`Project not found: ${projectId}`);

        // Upsert project memory
        const existing = db.prepare('SELECT id FROM project_memory WHERE project_id = ?').get(projectId);
        if (existing) {
          db.prepare("UPDATE project_memory SET summary = ?, updated_at = datetime('now') WHERE project_id = ?").run(summary, projectId);
        } else {
          const memId = randomUUID();
          db.prepare('INSERT INTO project_memory (id, project_id, summary) VALUES (?, ?, ?)').run(memId, projectId, summary);
        }

        return success(id, 'Project memory updated successfully.');
      }

      case 'get_server_config': {
        const projectId = args.project_id as string;
        if (!projectId) throw new Error('project_id is required');

        const row = db.prepare('SELECT server_config FROM projects WHERE id = ?').get(projectId) as { server_config: string | null } | undefined;
        if (!row) throw new Error(`Project not found: ${projectId}`);
        if (!row.server_config) {
          return success(id, 'No server config set for this project.');
        }
        return success(id, row.server_config);
      }

      case 'update_server_config': {
        const projectId = args.project_id as string;
        const serverConfig = args.server_config as string;
        if (!projectId) throw new Error('project_id is required');
        if (!serverConfig) throw new Error('server_config is required');

        const proj = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as { id: string } | undefined;
        if (!proj) throw new Error(`Project not found: ${projectId}`);

        db.prepare("UPDATE projects SET server_config = ?, updated_at = datetime('now') WHERE id = ?").run(serverConfig, projectId);
        return success(id, 'Server config updated successfully.');
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        };
    }
  } catch (err: any) {
    return success(id, `Error: ${err.message}`, true);
  }
}

function success(id: number | string, text: string, isError = false) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text }],
      isError,
    },
  };
}

// --- stdio transport ---

function send(msg: unknown) {
  const json = JSON.stringify(msg);
  process.stdout.write(json + '\n');
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);

    // Handle notifications (no id)
    if (msg.method === 'notifications/initialized') return;
    if (msg.method === 'notifications/cancelled') return;

    switch (msg.method) {
      case 'initialize':
        send(handleInitialize(msg.id));
        break;
      case 'tools/list':
        send(handleToolsList(msg.id));
        break;
      case 'tools/call':
        send(handleToolCall(msg.id, msg.params));
        break;
      default:
        if (msg.id !== undefined) {
          send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
        }
    }
  } catch (err: any) {
    // Try to extract id for error response
    try {
      const parsed = JSON.parse(line);
      send({ jsonrpc: '2.0', id: parsed.id, error: { code: -32700, message: err.message } });
    } catch {
      // Can't even parse — ignore
    }
  }
});

rl.on('close', () => {
  db.close();
  process.exit(0);
});
