import { getDb } from './connection.js';

function migrate(db: ReturnType<typeof getDb>) {
  // Add path column to projects if missing
  const projCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!projCols.some(c => c.name === 'path')) {
    db.exec("ALTER TABLE projects ADD COLUMN path TEXT DEFAULT NULL");
  }

  // Add status + status_updated_at to sessions if missing
  const sessCols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  if (!sessCols.some(c => c.name === 'status')) {
    db.exec("ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'backlog'");
  }
  if (!sessCols.some(c => c.name === 'status_updated_at')) {
    db.exec("ALTER TABLE sessions ADD COLUMN status_updated_at TEXT NOT NULL DEFAULT ''");
    // Backfill with existing updated_at values
    db.exec("UPDATE sessions SET status_updated_at = updated_at WHERE status_updated_at = ''");
  }

  // Add git settings columns to projects if missing
  if (!projCols.some(c => c.name === 'git_push_disabled')) {
    db.exec("ALTER TABLE projects ADD COLUMN git_push_disabled INTEGER NOT NULL DEFAULT 0");
  }
  if (!projCols.some(c => c.name === 'git_protected_branches')) {
    db.exec("ALTER TABLE projects ADD COLUMN git_protected_branches TEXT NOT NULL DEFAULT ''");
  }
  if (!projCols.some(c => c.name === 'color')) {
    db.exec("ALTER TABLE projects ADD COLUMN color TEXT NOT NULL DEFAULT ''");
  }
  if (!projCols.some(c => c.name === 'git_origin_url')) {
    db.exec("ALTER TABLE projects ADD COLUMN git_origin_url TEXT NOT NULL DEFAULT ''");
  }
  if (!projCols.some(c => c.name === 'auto_summarize')) {
    db.exec("ALTER TABLE projects ADD COLUMN auto_summarize INTEGER NOT NULL DEFAULT 1");
  }
  if (!projCols.some(c => c.name === 'dev_port')) {
    db.exec("ALTER TABLE projects ADD COLUMN dev_port INTEGER DEFAULT NULL");
  }

  // Add mode column to sessions if missing
  if (!sessCols.some(c => c.name === 'mode')) {
    db.exec("ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'execute'");
  }

  // Migrate legacy skill project_id into skill_projects junction table
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='skill_projects'").get();
  if (tables) {
    const legacySkills = db.prepare("SELECT id, project_id FROM skills WHERE project_id IS NOT NULL").all() as { id: string; project_id: string }[];
    for (const s of legacySkills) {
      db.prepare("INSERT OR IGNORE INTO skill_projects (skill_id, project_id) VALUES (?, ?)").run(s.id, s.project_id);
    }
  }
}

export function createSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      path TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🤖',
      is_default INTEGER NOT NULL DEFAULT 0,
      model TEXT NOT NULL DEFAULT 'sonnet',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      is_global INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT 'global',
      project_id TEXT DEFAULT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_url TEXT DEFAULT NULL,
      icon TEXT NOT NULL DEFAULT '⚡',
      globs TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL DEFAULT 'New Session',
      status TEXT NOT NULL DEFAULT 'backlog',
      status_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'user',
      from_status TEXT,
      to_status TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tool_use TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
      summary TEXT NOT NULL DEFAULT '',
      pinned_facts TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_memory (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      summary TEXT NOT NULL DEFAULT '',
      pinned_facts TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_skills (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (session_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS skill_projects (
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      PRIMARY KEY (skill_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS apis (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL,
      auth_type TEXT NOT NULL DEFAULT 'none',
      auth_config TEXT NOT NULL DEFAULT '{}',
      spec TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT 'global',
      icon TEXT NOT NULL DEFAULT '🔌',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_projects (
      api_id TEXT NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      PRIMARY KEY (api_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS session_apis (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      api_id TEXT NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (session_id, api_id)
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      command TEXT NOT NULL,
      args TEXT NOT NULL DEFAULT '[]',
      env TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrate(db);
}
