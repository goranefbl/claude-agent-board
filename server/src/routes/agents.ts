import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM agents ORDER BY is_default DESC, name ASC').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, system_prompt, icon = '🤖', model = 'sonnet' } = req.body;
  if (!name || !system_prompt) return res.status(400).json({ error: 'name and system_prompt required' });
  const id = uuid();
  getDb().prepare('INSERT INTO agents (id, name, system_prompt, icon, model) VALUES (?, ?, ?, ?, ?)').run(id, name, system_prompt, icon, model);
  res.status(201).json(getDb().prepare('SELECT * FROM agents WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { name, system_prompt, icon, model } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE agents SET name = COALESCE(?, name), system_prompt = COALESCE(?, system_prompt), icon = COALESCE(?, icon), model = COALESCE(?, model), updated_at = datetime('now') WHERE id = ?")
    .run(name ?? null, system_prompt ?? null, icon ?? null, model ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
