import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';
import type { SosForm, SosEntry, SosFieldConfig } from '../../../shared/types.js';

// DB rows have JSON fields stored as strings
type SosFormRow = Omit<SosForm, 'config'> & { config: string };
type SosEntryRow = Omit<SosEntry, 'data'> & { data: string };

const router = Router();

// ---- Forms API ----

// List all forms for the user
router.get('/forms', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const forms = getDb()
    .prepare('SELECT id, user_id, name, description, config, created_at, updated_at FROM sos_forms WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as SosFormRow[];

  // Parse config JSON strings
  const parsed = forms.map(f => ({
    ...f,
    config: typeof f.config === 'string' ? JSON.parse(f.config) : f.config
  }));

  res.json(parsed);
});

// Get a specific form
router.get('/forms/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const form = getDb()
    .prepare('SELECT id, user_id, name, description, config, created_at, updated_at FROM sos_forms WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as SosFormRow | undefined;

  if (!form) return res.status(404).json({ error: 'Form not found' });

  res.json({
    ...form,
    config: typeof form.config === 'string' ? JSON.parse(form.config) : form.config
  });
});

// Create a new form
router.post('/forms', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, description = '', config = [] } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Array.isArray(config)) return res.status(400).json({ error: 'config must be an array' });

  const id = uuid();
  const db = getDb();

  db.prepare(
    'INSERT INTO sos_forms (id, user_id, name, description, config) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, name, description, JSON.stringify(config));

  const form = db.prepare('SELECT * FROM sos_forms WHERE id = ?').get(id) as SosFormRow;
  res.status(201).json({
    ...form,
    config: JSON.parse(form.config)
  });
});

// Update a form
router.put('/forms/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, description, config } = req.body;

  const db = getDb();
  const form = db.prepare('SELECT * FROM sos_forms WHERE id = ? AND user_id = ?').get(req.params.id, userId);

  if (!form) return res.status(404).json({ error: 'Form not found' });

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (config !== undefined) {
    updates.push('config = ?');
    values.push(JSON.stringify(config));
  }

  if (updates.length === 0) return res.json(form);

  updates.push('updated_at = datetime("now")');
  values.push(req.params.id, userId);

  db.prepare(`UPDATE sos_forms SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM sos_forms WHERE id = ?').get(req.params.id) as SosFormRow;
  res.json({
    ...updated,
    config: JSON.parse(updated.config)
  });
});

// Delete a form
router.delete('/forms/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const db = getDb();

  const form = db.prepare('SELECT * FROM sos_forms WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!form) return res.status(404).json({ error: 'Form not found' });

  db.prepare('DELETE FROM sos_forms WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ success: true });
});

// ---- Entries API ----

// List entries for a form with optional date range filtering
router.get('/entries', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { form_id, start_date, end_date } = req.query;

  let query = 'SELECT * FROM sos_entries WHERE user_id = ?';
  const params: any[] = [userId];

  if (form_id) {
    query += ' AND form_id = ?';
    params.push(form_id);
  }

  if (start_date) {
    query += ' AND call_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND call_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY call_date DESC, call_time DESC';

  const entries = getDb().prepare(query).all(...params) as SosEntryRow[];

  // Parse data JSON strings
  const parsed = entries.map(e => ({
    ...e,
    data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
  }));

  res.json(parsed);
});

// Get a specific entry
router.get('/entries/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const entry = getDb()
    .prepare('SELECT * FROM sos_entries WHERE id = ? AND user_id = ?')
    .get(req.params.id, userId) as SosEntryRow | undefined;

  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  res.json({
    ...entry,
    data: typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data
  });
});

// Create a new entry
router.post('/entries', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { form_id, data, call_date, call_time } = req.body;

  if (!form_id || !data || !call_date || !call_time) {
    return res.status(400).json({ error: 'form_id, data, call_date, and call_time are required' });
  }

  const db = getDb();

  // Verify form exists and belongs to user
  const form = db.prepare('SELECT * FROM sos_forms WHERE id = ? AND user_id = ?').get(form_id, userId);
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO sos_entries (id, user_id, form_id, data, call_date, call_time, entry_created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, form_id, JSON.stringify(data), call_date, call_time, now);

  // Log entry creation in audit
  const auditId = uuid();
  db.prepare(
    'INSERT INTO sos_entry_audit (id, entry_id, action, changed_by) VALUES (?, ?, ?, ?)'
  ).run(auditId, id, 'created', userId);

  const entry = db.prepare('SELECT * FROM sos_entries WHERE id = ?').get(id) as SosEntryRow;
  res.status(201).json({
    ...entry,
    data: JSON.parse(entry.data)
  });
});

// Update an entry
router.put('/entries/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { data, call_date, call_time } = req.body;

  const db = getDb();
  const entry = db.prepare('SELECT * FROM sos_entries WHERE id = ? AND user_id = ?').get(req.params.id, userId);

  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const updates: string[] = [];
  const values: any[] = [];

  if (data !== undefined) {
    updates.push('data = ?');
    values.push(JSON.stringify(data));
  }
  if (call_date !== undefined) {
    updates.push('call_date = ?');
    values.push(call_date);
  }
  if (call_time !== undefined) {
    updates.push('call_time = ?');
    values.push(call_time);
  }

  if (updates.length === 0) return res.json(entry);

  updates.push('updated_at = datetime("now")');
  values.push(req.params.id, userId);

  db.prepare(`UPDATE sos_entries SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  // Log the update
  const auditId = uuid();
  db.prepare(
    'INSERT INTO sos_entry_audit (id, entry_id, action, changed_by) VALUES (?, ?, ?, ?)'
  ).run(auditId, req.params.id, 'updated', userId);

  const updated = db.prepare('SELECT * FROM sos_entries WHERE id = ?').get(req.params.id) as SosEntryRow;
  res.json({
    ...updated,
    data: JSON.parse(updated.data)
  });
});

// Delete an entry
router.delete('/entries/:id', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const db = getDb();

  const entry = db.prepare('SELECT * FROM sos_entries WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  // Log the deletion
  const auditId = uuid();
  db.prepare(
    'INSERT INTO sos_entry_audit (id, entry_id, action, changed_by) VALUES (?, ?, ?, ?)'
  ).run(auditId, req.params.id, 'deleted', userId);

  db.prepare('DELETE FROM sos_entries WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ success: true });
});

// Get audit log for an entry
router.get('/entries/:id/audit', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const db = getDb();

  const entry = db.prepare('SELECT * FROM sos_entries WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const audits = db.prepare('SELECT * FROM sos_entry_audit WHERE entry_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(audits);
});

export default router;
