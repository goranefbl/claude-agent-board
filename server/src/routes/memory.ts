import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/connection.js';
import type { Memory } from '../../../shared/types.js';

const router = Router();

// --- Project-level memory ---

router.get('/project/:projectId', (req, res) => {
  const db = getDb();
  let row = db.prepare('SELECT * FROM project_memory WHERE project_id = ?').get(req.params.projectId) as Memory | undefined;
  if (!row) {
    const id = randomUUID();
    db.prepare('INSERT INTO project_memory (id, project_id) VALUES (?, ?)').run(id, req.params.projectId);
    row = db.prepare('SELECT * FROM project_memory WHERE project_id = ?').get(req.params.projectId) as Memory;
  }
  res.json({ summary: row.summary });
});

router.put('/project/:projectId', (req, res) => {
  const { summary } = req.body;
  const db = getDb();
  let existing = db.prepare('SELECT * FROM project_memory WHERE project_id = ?').get(req.params.projectId);
  if (!existing) {
    const id = randomUUID();
    db.prepare('INSERT INTO project_memory (id, project_id) VALUES (?, ?)').run(id, req.params.projectId);
  }
  db.prepare("UPDATE project_memory SET summary = COALESCE(?, summary), updated_at = datetime('now') WHERE project_id = ?")
    .run(summary ?? null, req.params.projectId);
  const updated = db.prepare('SELECT * FROM project_memory WHERE project_id = ?').get(req.params.projectId) as Memory;
  res.json({ summary: updated.summary });
});

// --- Session-level memory ---

router.get('/:sessionId', (req, res) => {
  const row = getDb()
    .prepare('SELECT * FROM memory WHERE session_id = ?')
    .get(req.params.sessionId) as Memory | undefined;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, pinned_facts: JSON.parse(row.pinned_facts) });
});

router.put('/:sessionId', (req, res) => {
  const { summary, pinned_facts } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM memory WHERE session_id = ?').get(req.params.sessionId);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE memory SET summary = COALESCE(?, summary), pinned_facts = COALESCE(?, pinned_facts), updated_at = datetime('now') WHERE session_id = ?")
    .run(
      summary ?? null,
      pinned_facts ? JSON.stringify(pinned_facts) : null,
      req.params.sessionId
    );
  const updated = db.prepare('SELECT * FROM memory WHERE session_id = ?').get(req.params.sessionId) as Memory;
  res.json({ ...updated, pinned_facts: JSON.parse(updated.pinned_facts) });
});

export default router;
