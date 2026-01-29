import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createSchema } from './db/schema.js';
import { seed, GENERAL_PROJECT_ID } from './db/seed.js';
import { getDb } from './db/connection.js';
import { setupWebSocket } from './ws/handler.js';
import projectsRouter from './routes/projects.js';
import sessionsRouter from './routes/sessions.js';
import agentsRouter from './routes/agents.js';
import skillsRouter from './routes/skills.js';
import memoryRouter from './routes/memory.js';
import exportRouter from './routes/exportRoute.js';
import authRouter, { authMiddleware } from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import filesRouter from './routes/files.js';
import gitRouter from './routes/git.js';
import mcpsRouter from './routes/mcps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Init DB
createSchema();
seed();

const app = express();
app.use(cors());
app.use(express.json());

// Auth routes (before middleware)
app.use('/api/auth', authRouter);

// Auth middleware — protects all /api/* routes except /api/auth/login
app.use(authMiddleware);

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/files', filesRouter);
app.use('/api/git', gitRouter);
app.use('/api/mcps', mcpsRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Activity log
app.get('/api/activity', (req, res) => {
  const { project_id, limit = '50' } = req.query;
  const db = getDb();
  const lim = Math.min(parseInt(limit as string) || 50, 200);
  let rows;
  if (project_id) {
    rows = db.prepare(`
      SELECT a.*, s.title as session_title, p.name as project_name
      FROM activity_log a
      JOIN sessions s ON a.session_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE s.project_id = ?
      ORDER BY a.created_at DESC LIMIT ?
    `).all(project_id, lim);
  } else {
    rows = db.prepare(`
      SELECT a.*, s.title as session_title, p.name as project_name
      FROM activity_log a
      JOIN sessions s ON a.session_id = s.id
      JOIN projects p ON s.project_id = p.id
      ORDER BY a.created_at DESC LIMIT ?
    `).all(lim);
  }
  res.json(rows);
});

// Expose general project ID to client
app.get('/api/config', (_req, res) => res.json({ generalProjectId: GENERAL_PROJECT_ID }));

// Logs endpoint - reads PM2 log files
app.get('/api/logs', (req, res) => {
  const logType = req.query.type === 'error' ? 'error' : 'out';
  const lines = Math.min(parseInt(req.query.lines as string) || 100, 1000);
  const logFile = path.join(
    process.env.HOME || '/home/claude',
    '.pm2', 'logs', `claude-chat-${logType}-0.log`
  );
  try {
    if (!fs.existsSync(logFile)) {
      return res.json({ logs: `Log file not found: ${logFile}` });
    }
    const content = fs.readFileSync(logFile, 'utf-8');
    const allLines = content.split('\n');
    const tail = allLines.slice(-lines).join('\n');
    res.json({ logs: tail });
  } catch (err: any) {
    res.json({ logs: `Error reading logs: ${err.message}` });
  }
});

// Serve user projects as static files at /preview/<project-name>/
const PROJECTS_DIR = '/home/claude/projects';
app.use('/preview', express.static(PROJECTS_DIR, { extensions: ['html'] }));

// API to list available preview projects
app.get('/api/preview-projects', (_req, res) => {
  try {
    const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => ({ name: e.name, url: `/preview/${e.name}/` }));
    res.json(projects);
  } catch {
    res.json([]);
  }
});

// Serve client static files in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// HTTP + WS server
const server = createServer(app);
const wss = new WebSocketServer({ server });
setupWebSocket(wss);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
