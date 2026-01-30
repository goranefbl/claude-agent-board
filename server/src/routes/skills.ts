import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { spawn as cpSpawn } from 'child_process';
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

/** Detect if input looks like a URL */
function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) || /^skills\.sh\//i.test(trimmed);
}

/** Fetch SKILL.md content from a URL (skills.sh, GitHub, or direct) with AI fallback */
async function fetchSkillUrl(input: string): Promise<string> {
  let url = input.trim();
  if (!url.startsWith('http')) url = `https://${url}`;

  // Fast path: skills.sh URL -> try common raw GitHub patterns
  if (url.includes('skills.sh/')) {
    const match = url.match(/skills\.sh\/([^/]+)\/([^/]+)\/([^/?#]+)/);
    if (match) {
      const [, owner, repo, skillName] = match;
      const base = `https://raw.githubusercontent.com/${owner}/${repo}/main`;
      for (const path of [`skills/${skillName}`, skillName]) {
        const resp = await fetch(`${base}/${path}/SKILL.md`);
        if (resp.ok) return resp.text();
      }
      // Fast path failed -- fall through to AI fallback below
    }
  }

  // Fetch the URL itself (could be skills.sh page, GitHub page, raw markdown, etc.)
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const text = await resp.text();

  // If it looks like raw markdown/SKILL.md content, return directly
  if (text.startsWith('---') || (text.startsWith('#') && !text.includes('<html'))) {
    return text;
  }

  // HTML page: strip scripts/styles/tags and use Claude to extract skill content
  const truncated = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 12000);

  const result = await runClaude(
    `Extract the SKILL.md content from this page.
Return ONLY the raw markdown skill content (with YAML frontmatter if present).
If the page shows a skill with rules/instructions, reconstruct it as a proper SKILL.md with frontmatter (name, description) and the full instructions as the body.
If you cannot find any skill content, return an empty string.

Page URL: ${url}
Page content:
${truncated}`
  );

  if (!result || result.length < 20) throw new Error(`Could not extract skill from ${url}`);
  return result;
}

/** Run Claude to generate JSON from a prompt */
async function runClaude(prompt: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const args = ['--print', '--model', 'sonnet', '--dangerously-skip-permissions', '--', prompt];
    const child = cpSpawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, HOME: process.env.HOME || '/home/claude' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else reject(new Error(stderr || `exit code ${code}`));
    });
    child.on('error', reject);
  });
}

/** Extract JSON object from Claude's response (handles code fences) */
function extractJson(result: string): any {
  let jsonStr = result;
  const fenceMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];
  return JSON.parse(jsonStr);
}

// Generate skill from description or URL using Claude
router.post('/generate', async (req, res) => {
  const { input } = req.body;
  if (!input || !input.trim()) return res.status(400).json({ error: 'input required' });

  try {
    // If input is a URL, fetch the content server-side first
    if (looksLikeUrl(input)) {
      try {
        const content = await fetchSkillUrl(input);
        const parsed = parseSkillMd(content);
        if (parsed.name) {
          return res.json({
            name: parsed.name,
            description: parsed.description || '',
            prompt: parsed.body,
            icon: parsed.icon || '⚡',
          });
        }
        // If no frontmatter, let Claude process the raw content
        const prompt = `You are a skill generator. The user fetched this content from a URL. Parse it and produce a JSON object with these fields:
- name: short human-readable skill name
- description: 1-2 sentence description
- prompt: the full skill instructions (use the fetched content as-is or clean it up)
- icon: a single emoji that represents this skill

IMPORTANT: Respond with ONLY a valid JSON object, no markdown code fences, no explanation.

Fetched content:
${content.slice(0, 8000)}`;
        const result = await runClaude(prompt);
        const gen = extractJson(result);
        if (!gen.name || !gen.prompt) return res.status(422).json({ error: 'Could not parse skill from URL content' });
        return res.json({ name: gen.name, description: gen.description || '', prompt: gen.prompt, icon: gen.icon || '⚡' });
      } catch (fetchErr: any) {
        return res.status(404).json({ error: fetchErr.message || 'Failed to fetch URL' });
      }
    }

    // Plain description: let Claude generate from scratch
    const prompt = `You are a skill generator. The user will describe what they want a skill to do.

Your job is to produce a JSON object with these fields:
- name: short human-readable skill name
- description: 1-2 sentence description
- prompt: the full skill instructions (markdown). Write comprehensive instructions for an AI agent.
- icon: a single emoji that represents this skill

IMPORTANT: Respond with ONLY a valid JSON object, no markdown code fences, no explanation. Just the raw JSON:
{"name":"...","description":"...","prompt":"...","icon":"..."}

User input: ${input}`;

    const result = await runClaude(prompt);
    const parsed = extractJson(result);
    if (!parsed.name || !parsed.prompt) {
      return res.status(422).json({ error: 'Could not generate a valid skill from that input' });
    }

    res.json({
      name: parsed.name,
      description: parsed.description || '',
      prompt: parsed.prompt,
      icon: parsed.icon || '⚡',
    });
  } catch (err: any) {
    console.error('[SKILLS] Generate error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate skill' });
  }
});

// Import skill from URL (skills.sh, raw SKILL.md, or any page with AI fallback)
router.post('/import', async (req, res) => {
  const { url, project_ids, project_id, scope = 'global' } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const skillMd = await fetchSkillUrl(url);

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
      parsed.body,
      scope === 'global' ? 1 : 0,
      scope,
      null,
      url,
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
