import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http, { createServer } from 'http';
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
import apisRouter from './routes/apis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Init DB
createSchema();
seed();

const app = express();

// Subdomain proxy: <project>.wpgens.com -> project's dev_port
// Must be before cors/json/auth so it proxies raw requests
app.use((req, res, next) => {
  const host = req.headers.host || '';
  // Match <project>.wpgens.com but skip reserved subdomains
  const match = host.match(/^([^.]+)\.wpgens\.com/);
  if (!match) return next();
  const reserved = ['agents', 'agent', 'www', 'mail', 'ftp'];
  if (reserved.includes(match[1])) return next();

  const subdomain = match[1];
  const db = getDb();
  // Match subdomain to project folder name (last segment of path)
  const project = db.prepare(
    "SELECT dev_port, path FROM projects WHERE dev_port IS NOT NULL AND path LIKE ?"
  ).get(`%/${subdomain}`) as { dev_port: number; path: string } | undefined;

  if (!project) {
    return res.status(404).send(`No project found for subdomain: ${subdomain}`);
  }

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: project.dev_port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${project.dev_port}` },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    res.status(502).send(`Dev server not running on port ${project.dev_port}`);
  });
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));

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
app.use('/api/apis', apisRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Image upload for chat — saves base64 image to temp file, returns path
const UPLOAD_DIR = '/tmp/chat-images';
app.post('/api/upload/image', (req, res) => {
  const { data, filename } = req.body; // data = base64 string, filename = original name
  if (!data) return res.status(400).json({ error: 'data (base64) required' });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = (filename || 'image.png').split('.').pop() || 'png';
  const name = `img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, name);
  const buffer = Buffer.from(data, 'base64');
  fs.writeFileSync(filePath, buffer);
  res.json({ path: filePath, size: buffer.length });
});

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

// Serve user projects: reverse proxy if dev_port set, otherwise static files
const PROJECTS_DIR = '/home/claude/projects';
app.use('/preview', (req, res, next) => {
  // Extract project folder name from URL: /preview/<folder>/...
  const match = req.path.match(/^\/([^/]+)/);
  if (!match) return next();
  const folderName = match[1];

  // Look up project by path to check for dev_port
  const db = getDb();
  const project = db.prepare("SELECT dev_port FROM projects WHERE path LIKE ?").get(`%/${folderName}`) as { dev_port: number | null } | undefined;

  if (project?.dev_port) {
    // Reverse proxy to the dev server
    const subPath = req.url.replace(`/${folderName}`, '') || '/';
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: project.dev_port,
      path: subPath,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${project.dev_port}` },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      // Dev server not running, fall through to static
      express.static(PROJECTS_DIR, { extensions: ['html'] })(req, res, next);
    });
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } else {
    // Static file serving (original behavior)
    express.static(PROJECTS_DIR, { extensions: ['html'] })(req, res, next);
  }
});

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
