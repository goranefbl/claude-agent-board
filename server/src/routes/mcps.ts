import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM mcp_servers ORDER BY is_default DESC, name ASC').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM mcp_servers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, description = '', command, args = '[]', env = '{}' } = req.body;
  if (!name || !command) return res.status(400).json({ error: 'name and command required' });
  const id = uuid();
  getDb().prepare(
    'INSERT INTO mcp_servers (id, name, description, command, args, env) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, description, command, args, env);
  res.status(201).json(getDb().prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { name, description, command, args, env, enabled } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    "UPDATE mcp_servers SET name = COALESCE(?, name), description = COALESCE(?, description), command = COALESCE(?, command), args = COALESCE(?, args), env = COALESCE(?, env), enabled = COALESCE(?, enabled), updated_at = datetime('now') WHERE id = ?"
  ).run(name ?? null, description ?? null, command ?? null, args ?? null, env ?? null, enabled ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT is_default FROM mcp_servers WHERE id = ?').get(req.params.id) as { is_default: number } | undefined;
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.is_default) return res.status(400).json({ error: 'Cannot delete default MCP server' });
  db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
