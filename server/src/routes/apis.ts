import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

function attachProjectIds(rows: any[]): any[] {
  if (rows.length === 0) return rows;
  const db = getDb();
  const all = db.prepare('SELECT api_id, project_id FROM api_projects').all() as { api_id: string; project_id: string }[];
  const map = new Map<string, string[]>();
  for (const r of all) {
    if (!map.has(r.api_id)) map.set(r.api_id, []);
    map.get(r.api_id)!.push(r.project_id);
  }
  return rows.map(r => ({ ...r, project_ids: map.get(r.id) || [] }));
}

function syncProjectIds(db: ReturnType<typeof getDb>, apiId: string, projectIds: string[]) {
  db.prepare('DELETE FROM api_projects WHERE api_id = ?').run(apiId);
  const insert = db.prepare('INSERT INTO api_projects (api_id, project_id) VALUES (?, ?)');
  for (const pid of projectIds) {
    insert.run(apiId, pid);
  }
}

// List all APIs (optionally filter by project_id)
router.get('/', (req, res) => {
  const { project_id } = req.query;
  let rows;
  if (project_id) {
    rows = getDb()
      .prepare(`SELECT * FROM apis WHERE scope = 'global'
                OR id IN (SELECT api_id FROM api_projects WHERE project_id = ?)
                ORDER BY name ASC`)
      .all(project_id);
  } else {
    rows = getDb().prepare('SELECT * FROM apis ORDER BY scope ASC, name ASC').all();
  }
  res.json(attachProjectIds(rows));
});

// Get single API
router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(attachProjectIds([row])[0]);
});

// Create API
router.post('/', (req, res) => {
  const { name, description = '', base_url, auth_type = 'none', auth_config = '{}', spec = '', scope = 'global', project_ids, icon = '🔌' } = req.body;
  if (!name || !base_url) return res.status(400).json({ error: 'name and base_url required' });
  const id = uuid();
  const db = getDb();
  db.prepare(
    'INSERT INTO apis (id, name, description, base_url, auth_type, auth_config, spec, scope, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, description, base_url, auth_type, auth_config, spec, scope, icon);
  const pids: string[] = project_ids || [];
  if (pids.length > 0) syncProjectIds(db, id, pids);
  res.status(201).json(attachProjectIds([db.prepare('SELECT * FROM apis WHERE id = ?').get(id)])[0]);
});

// Update API
router.put('/:id', (req, res) => {
  const { name, description, base_url, auth_type, auth_config, spec, scope, project_ids, icon } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE apis SET
    name = COALESCE(?, name),
    description = COALESCE(?, description),
    base_url = COALESCE(?, base_url),
    auth_type = COALESCE(?, auth_type),
    auth_config = COALESCE(?, auth_config),
    spec = COALESCE(?, spec),
    scope = COALESCE(?, scope),
    icon = COALESCE(?, icon),
    updated_at = datetime('now')
    WHERE id = ?`)
    .run(
      name ?? null, description ?? null, base_url ?? null, auth_type ?? null,
      auth_config ?? null, spec ?? null, scope ?? null, icon ?? null,
      req.params.id
    );
  if (project_ids !== undefined) {
    syncProjectIds(db, req.params.id, project_ids);
  }
  res.json(attachProjectIds([db.prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id)])[0]);
});

// Delete API
router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM apis WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Session APIs - get all APIs with enabled status for a session
router.get('/session/:sessionId', (req, res) => {
  const { project_id } = req.query;
  let query: string;
  let params: any[];

  if (project_id) {
    query = `
      SELECT a.*, COALESCE(sa.enabled, 0) as enabled
      FROM apis a
      LEFT JOIN session_apis sa ON sa.api_id = a.id AND sa.session_id = ?
      WHERE a.scope = 'global' OR a.id IN (SELECT api_id FROM api_projects WHERE project_id = ?)
      ORDER BY a.scope ASC, a.name ASC
    `;
    params = [req.params.sessionId, project_id];
  } else {
    query = `
      SELECT a.*, COALESCE(sa.enabled, 0) as enabled
      FROM apis a
      LEFT JOIN session_apis sa ON sa.api_id = a.id AND sa.session_id = ?
      ORDER BY a.scope ASC, a.name ASC
    `;
    params = [req.params.sessionId];
  }

  const rows = getDb().prepare(query).all(...params);
  res.json(attachProjectIds(rows));
});

// Toggle API for a session
router.put('/session/:sessionId/:apiId', (req, res) => {
  const { enabled } = req.body;
  const db = getDb();
  db.prepare(`
    INSERT INTO session_apis (session_id, api_id, enabled) VALUES (?, ?, ?)
    ON CONFLICT(session_id, api_id) DO UPDATE SET enabled = ?
  `).run(req.params.sessionId, req.params.apiId, enabled ? 1 : 0, enabled ? 1 : 0);
  res.json({ ok: true });
});

export default router;
