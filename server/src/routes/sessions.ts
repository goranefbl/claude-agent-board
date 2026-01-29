import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';
import { GENERAL_PROJECT_ID } from '../db/seed.js';

const router = Router();

function logActivity(sessionId: string, action: string, actor: 'user' | 'ai', fromStatus?: string | null, toStatus?: string | null) {
  getDb().prepare(
    'INSERT INTO activity_log (id, session_id, action, actor, from_status, to_status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuid(), sessionId, action, actor, fromStatus ?? null, toStatus ?? null);
}

router.get('/', (req, res) => {
  const { project_id } = req.query;
  let rows;
  if (project_id) {
    rows = getDb()
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY updated_at DESC')
      .all(project_id);
  } else {
    rows = getDb()
      .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
      .all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { project_id, agent_id, title = 'New Chat' } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id required' });
  const pid = project_id || GENERAL_PROJECT_ID;
  const id = uuid();
  const db = getDb();
  db.prepare('INSERT INTO sessions (id, project_id, agent_id, title, status) VALUES (?, ?, ?, ?, ?)').run(id, pid, agent_id, title, 'backlog');
  // Create memory record
  db.prepare('INSERT INTO memory (id, session_id) VALUES (?, ?)').run(uuid(), id);
  // Enable all global skills
  const globalSkills = db.prepare('SELECT id FROM skills WHERE is_global = 1').all() as { id: string }[];
  const insertSkill = db.prepare('INSERT INTO session_skills (session_id, skill_id, enabled) VALUES (?, ?, 1)');
  for (const skill of globalSkills) {
    insertSkill.run(id, skill.id);
  }
  logActivity(id, 'created', 'user', null, 'backlog');
  res.status(201).json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { title, agent_id } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE sessions SET title = COALESCE(?, title), agent_id = COALESCE(?, agent_id), updated_at = datetime('now') WHERE id = ?")
    .run(title ?? null, agent_id ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id));
});

// Update session status (for kanban board)
router.patch('/:id/status', (req, res) => {
  const { status, actor = 'user' } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const fromStatus = existing.status;
  db.prepare("UPDATE sessions SET status = ?, status_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(status, req.params.id);
  logActivity(req.params.id, `moved`, actor, fromStatus, status);
  res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Get messages for a session
router.get('/:id/messages', (req, res) => {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(req.params.id);
  res.json(rows);
});

export { logActivity };
export default router;
