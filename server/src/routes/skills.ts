import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

/** Helper: attach project_ids array to each skill row */
function attachProjectIds(rows: any[]): any[] {
  if (rows.length === 0) return rows;
  const db = getDb();
  const all = db.prepare('SELECT skill_id, project_id FROM skill_projects').all() as { skill_id: string; project_id: string }[];
  const map = new Map<string, string[]>();
  for (const r of all) {
    if (!map.has(r.skill_id)) map.set(r.skill_id, []);
    map.get(r.skill_id)!.push(r.project_id);
  }
  return rows.map(r => ({ ...r, project_ids: map.get(r.id) || [] }));
}

function syncProjectIds(db: ReturnType<typeof getDb>, skillId: string, projectIds: string[]) {
  db.prepare('DELETE FROM skill_projects WHERE skill_id = ?').run(skillId);
  const insert = db.prepare('INSERT INTO skill_projects (skill_id, project_id) VALUES (?, ?)');
  for (const pid of projectIds) {
    insert.run(skillId, pid);
  }
}

// List all skills (optionally filter by project_id)
router.get('/', (req, res) => {
  const { project_id } = req.query;
  let rows;
  if (project_id) {
    // Return global skills + skills assigned to this project
    rows = getDb()
      .prepare(`SELECT * FROM skills WHERE scope = 'global'
                OR id IN (SELECT skill_id FROM skill_projects WHERE project_id = ?)
                ORDER BY name ASC`)
      .all(project_id);
  } else {
    rows = getDb().prepare('SELECT * FROM skills ORDER BY scope ASC, name ASC').all();
  }
  res.json(attachProjectIds(rows));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(attachProjectIds([row])[0]);
});

// Create skill manually
router.post('/', (req, res) => {
  const { name, slug, description = '', prompt, is_global = 0, scope = 'global', project_ids, project_id, icon = '⚡', globs } = req.body;
  if (!name || !prompt) return res.status(400).json({ error: 'name and prompt required' });
  const id = uuid();
  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const db = getDb();
  db.prepare(
    'INSERT INTO skills (id, name, slug, description, prompt, is_global, scope, project_id, icon, globs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, finalSlug, description, prompt, is_global ? 1 : 0, scope, null, icon, globs || null);
  // Handle project assignments
  const pids: string[] = project_ids || (project_id ? [project_id] : []);
  if (pids.length > 0) syncProjectIds(db, id, pids);
  res.status(201).json(attachProjectIds([db.prepare('SELECT * FROM skills WHERE id = ?').get(id)])[0]);
});

// Import skill from URL (skills.sh or raw SKILL.md)
router.post('/import', async (req, res) => {
  const { url, project_ids, project_id, scope = 'global' } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    let skillMd: string;
    let sourceUrl = url;

    // Handle skills.sh URLs: convert to raw GitHub SKILL.md URL
    if (url.includes('skills.sh/')) {
      // e.g. https://skills.sh/vercel-labs/agent-skills/web-design-guidelines
      const match = url.match(/skills\.sh\/([^/]+)\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: 'Invalid skills.sh URL format. Expected: skills.sh/owner/repo/skill-name' });
      const [, owner, repo, skillName] = match;
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${skillName}/SKILL.md`;
      const response = await fetch(rawUrl);
      if (!response.ok) {
        // Try alternate path structure
        const altUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillName}/SKILL.md`;
        const altResponse = await fetch(altUrl);
        if (!altResponse.ok) return res.status(404).json({ error: `Could not find SKILL.md at ${rawUrl} or ${altUrl}` });
        skillMd = await altResponse.text();
      } else {
        skillMd = await response.text();
      }
    } else if (url.endsWith('.md') || url.includes('raw.githubusercontent.com')) {
      // Direct URL to SKILL.md
      const response = await fetch(url);
      if (!response.ok) return res.status(404).json({ error: `Could not fetch ${url}` });
      skillMd = await response.text();
    } else {
      return res.status(400).json({ error: 'URL must be a skills.sh link or direct URL to a SKILL.md file' });
    }

    // Parse SKILL.md: extract YAML frontmatter and markdown body
    const parsed = parseSkillMd(skillMd);
    if (!parsed.name) return res.status(400).json({ error: 'Could not parse skill name from SKILL.md' });

    const id = uuid();
    const slug = parsed.slug || parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const db = getDb();

    db.prepare(
      'INSERT INTO skills (id, name, slug, description, prompt, is_global, scope, project_id, source_url, icon, globs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      parsed.name,
      slug,
      parsed.description || '',
      parsed.body, // The full markdown body is the prompt
      scope === 'global' ? 1 : 0,
      scope,
      null,
      sourceUrl,
      parsed.icon || '⚡',
      parsed.globs ? JSON.stringify(parsed.globs) : null,
    );

    const pids: string[] = project_ids || (project_id ? [project_id] : []);
    if (pids.length > 0) syncProjectIds(db, id, pids);

    res.status(201).json(attachProjectIds([db.prepare('SELECT * FROM skills WHERE id = ?').get(id)])[0]);
  } catch (err: any) {
    console.error('[SKILLS] Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update skill
router.put('/:id', (req, res) => {
  const { name, slug, description, prompt, is_global, scope, project_ids, icon, globs } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE skills SET
    name = COALESCE(?, name),
    slug = COALESCE(?, slug),
    description = COALESCE(?, description),
    prompt = COALESCE(?, prompt),
    is_global = COALESCE(?, is_global),
    scope = COALESCE(?, scope),
    icon = COALESCE(?, icon),
    globs = COALESCE(?, globs),
    updated_at = datetime('now')
    WHERE id = ?`)
    .run(
      name ?? null, slug ?? null, description ?? null, prompt ?? null,
      is_global !== undefined ? (is_global ? 1 : 0) : null,
      scope ?? null, icon ?? null,
      globs !== undefined ? (globs ? JSON.stringify(globs) : null) : null,
      req.params.id
    );
  if (project_ids !== undefined) {
    syncProjectIds(db, req.params.id, project_ids);
  }
  res.json(attachProjectIds([db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id)])[0]);
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Session skills - get all skills with enabled status for a session
router.get('/session/:sessionId', (req, res) => {
  const { project_id } = req.query;
  let query: string;
  let params: any[];

  if (project_id) {
    // Show global + project-scoped skills
    query = `
      SELECT s.*, COALESCE(ss.enabled, 0) as enabled
      FROM skills s
      LEFT JOIN session_skills ss ON ss.skill_id = s.id AND ss.session_id = ?
      WHERE s.scope = 'global' OR s.id IN (SELECT skill_id FROM skill_projects WHERE project_id = ?)
      ORDER BY s.scope ASC, s.name ASC
    `;
    params = [req.params.sessionId, project_id];
  } else {
    query = `
      SELECT s.*, COALESCE(ss.enabled, 0) as enabled
      FROM skills s
      LEFT JOIN session_skills ss ON ss.skill_id = s.id AND ss.session_id = ?
      ORDER BY s.scope ASC, s.name ASC
    `;
    params = [req.params.sessionId];
  }

  const rows = getDb().prepare(query).all(...params);
  res.json(attachProjectIds(rows));
});

// Toggle skill for a session
router.put('/session/:sessionId/:skillId', (req, res) => {
  const { enabled } = req.body;
  const db = getDb();
  db.prepare(`
    INSERT INTO session_skills (session_id, skill_id, enabled) VALUES (?, ?, ?)
    ON CONFLICT(session_id, skill_id) DO UPDATE SET enabled = ?
  `).run(req.params.sessionId, req.params.skillId, enabled ? 1 : 0, enabled ? 1 : 0);
  res.json({ ok: true });
});

export default router;

// ---- SKILL.md parser ----

interface ParsedSkill {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  globs?: string[];
  body: string;
}

function parseSkillMd(content: string): ParsedSkill {
  const result: ParsedSkill = { name: '', body: content };

  // Extract YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    result.body = fmMatch[2].trim();

    // Parse YAML fields (simple parser, no dependency)
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '');

    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    if (descMatch) result.description = descMatch[1].trim().replace(/^["']|["']$/g, '');

    const iconMatch = frontmatter.match(/^icon:\s*(.+)$/m);
    if (iconMatch) result.icon = iconMatch[1].trim().replace(/^["']|["']$/g, '');

    const globsMatch = frontmatter.match(/^globs:\s*\[([^\]]*)\]/m);
    if (globsMatch) {
      result.globs = globsMatch[1].split(',').map(g => g.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
  } else {
    // No frontmatter, try to extract name from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) result.name = headingMatch[1].trim();
  }

  return result;
}
