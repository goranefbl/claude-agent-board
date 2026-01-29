import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
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

  getDb().prepare('INSERT INTO projects (id, name, description, path, git_push_disabled) VALUES (?, ?, ?, ?, 1)').run(id, name, description, projectPath);
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const { name, description, path, git_origin_url, git_push_disabled, git_protected_branches, color } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), path = COALESCE(?, path), git_origin_url = COALESCE(?, git_origin_url), git_push_disabled = COALESCE(?, git_push_disabled), git_protected_branches = COALESCE(?, git_protected_branches), color = COALESCE(?, color), updated_at = datetime('now') WHERE id = ?")
    .run(name ?? null, description ?? null, path ?? null, git_origin_url ?? null, git_push_disabled ?? null, git_protected_branches ?? null, color ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
