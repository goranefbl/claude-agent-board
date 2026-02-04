import { getDb } from './connection.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { basename, join } from 'path';

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
  if (!projCols.some(c => c.name === 'server_config')) {
    db.exec("ALTER TABLE projects ADD COLUMN server_config TEXT NOT NULL DEFAULT ''");
  }

  // Add mode column to sessions if missing
  if (!sessCols.some(c => c.name === 'mode')) {
    db.exec("ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'execute'");
  }

  // Add interrupted column to messages if missing
  const msgCols = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  if (!msgCols.some(c => c.name === 'interrupted')) {
    db.exec("ALTER TABLE messages ADD COLUMN interrupted INTEGER NOT NULL DEFAULT 0");
  }

  // Add is_internal column to mcp_servers if missing
  const mcpCols = db.prepare("PRAGMA table_info(mcp_servers)").all() as { name: string }[];
  if (mcpCols.length > 0 && !mcpCols.some(c => c.name === 'is_internal')) {
    db.exec("ALTER TABLE mcp_servers ADD COLUMN is_internal INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE mcp_servers SET is_internal = 1 WHERE name = 'Project Manager'");
  }

  // Migrate legacy skill project_id into skill_projects junction table
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='skill_projects'").get();
  if (tables) {
    const legacySkills = db.prepare("SELECT id, project_id FROM skills WHERE project_id IS NOT NULL").all() as { id: string; project_id: string }[];
    for (const s of legacySkills) {
      db.prepare("INSERT OR IGNORE INTO skill_projects (skill_id, project_id) VALUES (?, ?)").run(s.id, s.project_id);
    }
  }

  // --- Multi-tenancy migration ---

  // Check if users table exists
  const usersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!usersTable) {
    // Create users and auth_tokens tables
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE auth_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Create admin user from env vars
    const adminId = uuid();
    const adminUsername = process.env.AUTH_USER || 'admin';
    const adminPassword = process.env.AUTH_PASS || 'admin';
    const adminEmail = 'goranefbl@gmail.com';
    const hash = bcrypt.hashSync(adminPassword, 10);

    db.prepare('INSERT INTO users (id, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(adminId, adminEmail, adminUsername, hash, 'admin');

    // Add user_id columns to existing tables
    const tablesToMigrate = ['projects', 'agents', 'skills', 'sessions', 'mcp_servers', 'apis'];
    for (const tbl of tablesToMigrate) {
      const cols = db.prepare(`PRAGMA table_info(${tbl})`).all() as { name: string }[];
      if (!cols.some(c => c.name === 'user_id')) {
        db.exec(`ALTER TABLE ${tbl} ADD COLUMN user_id TEXT REFERENCES users(id)`);
        db.exec(`UPDATE ${tbl} SET user_id = '${adminId}'`);
      }
    }

    // Add is_general column to projects
    const pCols2 = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    if (!pCols2.some(c => c.name === 'is_general')) {
      db.exec("ALTER TABLE projects ADD COLUMN is_general INTEGER NOT NULL DEFAULT 0");
      db.exec("UPDATE projects SET is_general = 1 WHERE id = '00000000-0000-0000-0000-000000000000'");
    }

    // Migrate settings to have user_id (recreate table with composite key)
    const settingsRows = db.prepare('SELECT key, value, updated_at FROM settings').all() as { key: string; value: string; updated_at: string }[];
    db.exec('DROP TABLE settings');
    db.exec(`
      CREATE TABLE settings (
        user_id TEXT NOT NULL REFERENCES users(id),
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, key)
      );
    `);
    // Re-insert existing settings with admin user_id
    const insertSetting = db.prepare('INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)');
    for (const row of settingsRows) {
      insertSetting.run(adminId, row.key, row.value, row.updated_at);
    }

    // MCP servers: allow NULL user_id for internal servers
    db.exec("UPDATE mcp_servers SET user_id = NULL WHERE is_internal = 1");

    // Add indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
      CREATE INDEX IF NOT EXISTS idx_skills_user_id ON skills(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
      CREATE INDEX IF NOT EXISTS idx_apis_user_id ON apis(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
    `);
  } else {
    // Ensure is_general column exists on projects (for instances that already have users table)
    const pCols3 = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    if (!pCols3.some(c => c.name === 'is_general')) {
      db.exec("ALTER TABLE projects ADD COLUMN is_general INTEGER NOT NULL DEFAULT 0");
      db.exec("UPDATE projects SET is_general = 1 WHERE id = '00000000-0000-0000-0000-000000000000'");
    }
  }

  // Add phone column to users if missing
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (userCols.length > 0 && !userCols.some(c => c.name === 'phone')) {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL");
  }

  // Migrate project paths to user-namespaced directories
  migrateProjectPaths(db);
}

function migrateProjectPaths(db: ReturnType<typeof getDb>) {
  const PROJECTS_ROOT = '/home/claude/projects';

  // Check if migration is needed by looking for a marker or checking path structure
  const projects = db.prepare(`
    SELECT p.id, p.path, p.user_id
    FROM projects p
    WHERE p.path IS NOT NULL AND p.path != ''
  `).all() as { id: string; path: string; user_id: string }[];

  if (projects.length === 0) return;

  // Check if already migrated (paths contain user_id subdirectory)
  const alreadyMigrated = projects.every(p => {
    if (!p.path || !p.user_id) return true;
    return p.path.includes(`/projects/${p.user_id}/`);
  });

  if (alreadyMigrated) return;

  console.log('[Migration] Migrating project paths to user-namespaced directories...');

  for (const project of projects) {
    if (!project.path || !project.user_id) continue;

    // Skip if already in user subdirectory
    if (project.path.includes(`/projects/${project.user_id}/`)) continue;

    const oldPath = project.path;
    const folderName = basename(oldPath);
    const userDir = join(PROJECTS_ROOT, project.user_id);
    const newPath = join(userDir, folderName);

    // Create user directory if not exists
    if (!existsSync(userDir)) {
      mkdirSync(userDir, { recursive: true });
      console.log(`[Migration] Created user directory: ${userDir}`);
    }

    // Move folder if it exists and new location doesn't
    if (existsSync(oldPath) && !existsSync(newPath)) {
      try {
        renameSync(oldPath, newPath);
        console.log(`[Migration] Moved ${oldPath} -> ${newPath}`);
      } catch (err: any) {
        console.error(`[Migration] Failed to move ${oldPath}: ${err.message}`);
        continue;
      }
    }

    // Update database path
    db.prepare('UPDATE projects SET path = ? WHERE id = ?').run(newPath, project.id);
    console.log(`[Migration] Updated project ${project.id} path to ${newPath}`);
  }

  console.log('[Migration] Project path migration complete');
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
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, key)
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
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK (category IN ('decision','feature','bug','content','todo','context')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_entries_fts USING fts5(
      title, content, tags,
      content='memory_entries', content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS memory_entries_ai AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_entries_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_entries_ad AFTER DELETE ON memory_entries BEGIN
      INSERT INTO memory_entries_fts(memory_entries_fts, rowid, title, content, tags) VALUES ('delete', old.rowid, old.title, old.content, old.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_entries_au AFTER UPDATE ON memory_entries BEGIN
      INSERT INTO memory_entries_fts(memory_entries_fts, rowid, title, content, tags) VALUES ('delete', old.rowid, old.title, old.content, old.tags);
      INSERT INTO memory_entries_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
    END;

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL,
      excerpt TEXT DEFAULT NULL,
      cover_image_path TEXT DEFAULT NULL,
      cover_image_caption TEXT DEFAULT NULL,
      is_featured INTEGER NOT NULL DEFAULT 0,
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

  `);

  migrate(db);
}
