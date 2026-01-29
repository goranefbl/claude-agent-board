import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Single-user auth — credentials from env vars or defaults
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'wpgens2024';

// Simple token store (in-memory, survives until restart)
const validTokens = new Set<string>();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === AUTH_USER && password === AUTH_PASS) {
    const token = generateToken();
    validTokens.add(token);
    res.json({ token, username: AUTH_USER });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) validTokens.delete(token);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && validTokens.has(token)) {
    res.json({ username: AUTH_USER });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export function authMiddleware(req: any, res: any, next: any) {
  // Skip auth for login endpoint and static files
  if (req.path === '/api/auth/login') return next();
  if (!req.path.startsWith('/api/')) return next();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && validTokens.has(token)) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

export default router;
