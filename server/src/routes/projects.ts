import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getDb } from '../db/connection.js';

const router = Router();
const PROJECTS_ROOT = '/home/claude/projects';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function ensureProjectFolder(slug: string): string {
  const fullPath = join(PROJECTS_ROOT, slug);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
}

router.get('/', (_req, res) => {
  const rows = getDb().prepare("SELECT * FROM projects WHERE id != '00000000-0000-0000-0000-000000000000' ORDER BY updated_at DESC").all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, description = '', path: customPath } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuid();

  // Determine project path: custom path (existing project) or auto-create folder
  let projectPath: string;
  if (customPath && existsSync(customPath)) {
    projectPath = customPath;
  } else {
    const slug = slugify(name);
    projectPath = ensureProjectFolder(slug);
  }

  // Auto-detect git origin URL from existing repo
  let gitOriginUrl = '';
  try {
    gitOriginUrl = execSync('git config --get remote.origin.url', {
      cwd: projectPath, timeout: 5000, encoding: 'utf-8', stdio: 'pipe',
    }).trim();
  } catch { /* not a git repo or no remote */ }

  // Auto-assign next available dev port (3100-3999)
  const usedPorts = getDb().prepare('SELECT dev_port FROM projects WHERE dev_port IS NOT NULL ORDER BY dev_port ASC').all() as { dev_port: number }[];
  const usedSet = new Set(usedPorts.map(r => r.dev_port));
  let devPort: number | null = null;
  for (let p = 3100; p <= 3999; p++) {
    if (!usedSet.has(p)) { devPort = p; break; }
  }

  getDb().prepare('INSERT INTO projects (id, name, description, path, git_push_disabled, git_origin_url, dev_port) VALUES (?, ?, ?, ?, 1, ?, ?)').run(id, name, description, projectPath, gitOriginUrl, devPort);
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const { name, description, path, git_origin_url, git_push_disabled, git_protected_branches, color, auto_summarize, dev_port, server_config } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), path = COALESCE(?, path), git_origin_url = COALESCE(?, git_origin_url), git_push_disabled = COALESCE(?, git_push_disabled), git_protected_branches = COALESCE(?, git_protected_branches), color = COALESCE(?, color), auto_summarize = COALESCE(?, auto_summarize), dev_port = COALESCE(?, dev_port), server_config = COALESCE(?, server_config), updated_at = datetime('now') WHERE id = ?")
    .run(name ?? null, description ?? null, path ?? null, git_origin_url ?? null, git_push_disabled ?? null, git_protected_branches ?? null, color ?? null, auto_summarize ?? null, dev_port ?? null, server_config ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT path, dev_port FROM projects WHERE id = ?').get(req.params.id) as { path: string | null; dev_port: number | null } | undefined;

  if (project?.path && existsSync(project.path)) {
    // Stop Docker containers if docker-compose.yml exists
    const composePath = join(project.path, 'docker-compose.yml');
    if (existsSync(composePath)) {
      try {
        execSync('sudo docker compose down -v', { cwd: project.path, timeout: 30_000, stdio: 'pipe' });
      } catch { /* ignore if docker not running or compose fails */ }
    }

    // Kill any process on the dev port
    if (project.dev_port) {
      try {
        execSync(`fuser -k ${project.dev_port}/tcp`, { timeout: 5_000, stdio: 'pipe' });
      } catch { /* ignore if nothing on port */ }
    }

    // Remove project folder
    try {
      rmSync(project.path, { recursive: true, force: true });
    } catch { /* ignore permission errors */ }
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
