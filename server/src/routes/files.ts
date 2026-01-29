import { Router } from 'express';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import { getDb } from '../db/connection.js';

const router = Router();

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '__pycache__', '.next',
  '.cache', '.parcel-cache', 'coverage', '.nyc_output',
  'build', '.svelte-kit', '.nuxt', '.output', '.turbo',
]);

const MAX_DEPTH = 10;
const MAX_FILE_SIZE = 1_000_000; // 1MB

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

function getProjectPath(projectId: string): string | null {
  const row = getDb().prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string | null } | undefined;
  return row?.path ?? null;
}

function isPathSafe(projectRoot: string, requestedPath: string): boolean {
  const abs = resolve(projectRoot, requestedPath);
  return abs.startsWith(projectRoot + '/') || abs === projectRoot;
}

function walkDir(dirPath: string, rootPath: string, depth: number): TreeNode[] {
  if (depth > MAX_DEPTH) return [];
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: TreeNode[] = [];
  // Sort: dirs first, then files, both alphabetical
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    const fullPath = join(dirPath, entry.name);
    const relPath = relative(rootPath, fullPath);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'dir',
        children: walkDir(fullPath, rootPath, depth + 1),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'file',
      });
    }
  }
  return nodes;
}

// GET /tree/:projectId
router.get('/tree/:projectId', (req, res) => {
  const projectPath = getProjectPath(req.params.projectId);
  if (!projectPath) return res.status(404).json({ error: 'Project not found or has no path' });
  if (!existsSync(projectPath)) return res.status(404).json({ error: 'Project directory not found on disk' });

  const tree = walkDir(projectPath, projectPath, 0);
  res.json(tree);
});

// GET /read/:projectId?path=relative/path
router.get('/read/:projectId', (req, res) => {
  const projectPath = getProjectPath(req.params.projectId);
  if (!projectPath) return res.status(404).json({ error: 'Project not found' });

  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path query param required' });
  if (!isPathSafe(projectPath, filePath)) return res.status(403).json({ error: 'Path traversal denied' });

  const absPath = resolve(projectPath, filePath);
  if (!existsSync(absPath)) return res.status(404).json({ error: 'File not found' });

  try {
    const stat = statSync(absPath);
    if (stat.size > MAX_FILE_SIZE) {
      return res.status(413).json({ error: 'File too large (>1MB)' });
    }
    const content = readFileSync(absPath, 'utf-8');
    res.json({ content, path: filePath, size: stat.size });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /write/:projectId
router.put('/write/:projectId', (req, res) => {
  const projectPath = getProjectPath(req.params.projectId);
  if (!projectPath) return res.status(404).json({ error: 'Project not found' });

  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });
  if (!isPathSafe(projectPath, filePath)) return res.status(403).json({ error: 'Path traversal denied' });

  const absPath = resolve(projectPath, filePath);
  try {
    const dir = join(absPath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /create/:projectId
router.post('/create/:projectId', (req, res) => {
  const projectPath = getProjectPath(req.params.projectId);
  if (!projectPath) return res.status(404).json({ error: 'Project not found' });

  const { path: itemPath, type } = req.body;
  if (!itemPath || !type) return res.status(400).json({ error: 'path and type required' });
  if (!isPathSafe(projectPath, itemPath)) return res.status(403).json({ error: 'Path traversal denied' });

  const absPath = resolve(projectPath, itemPath);
  try {
    if (type === 'dir') {
      mkdirSync(absPath, { recursive: true });
    } else {
      const dir = join(absPath, '..');
      mkdirSync(dir, { recursive: true });
      writeFileSync(absPath, '', 'utf-8');
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /delete/:projectId?path=relative/path
router.delete('/delete/:projectId', (req, res) => {
  const projectPath = getProjectPath(req.params.projectId);
  if (!projectPath) return res.status(404).json({ error: 'Project not found' });

  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path query param required' });
  if (!isPathSafe(projectPath, filePath)) return res.status(403).json({ error: 'Path traversal denied' });

  const absPath = resolve(projectPath, filePath);
  if (!existsSync(absPath)) return res.status(404).json({ error: 'Not found' });

  try {
    rmSync(absPath, { recursive: true });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
