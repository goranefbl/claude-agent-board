import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

const router = Router();

// Simple encryption for token values using a derived key from AUTH_PASS
const ALGO = 'aes-256-cbc';
function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_PASS || 'default-key';
  return crypto.scryptSync(secret, 'claude-agent-board-salt', 32);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Get all settings (tokens are masked)
router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value, updated_at FROM settings').all() as { key: string; value: string; updated_at: string }[];
  const result: Record<string, any> = {};
  for (const row of rows) {
    if (row.key.startsWith('token_')) {
      // Return masked value for tokens
      try {
        const decrypted = decrypt(row.value);
        result[row.key] = {
          value: decrypted.slice(0, 4) + '••••' + decrypted.slice(-4),
          hasValue: true,
          updated_at: row.updated_at,
        };
      } catch {
        result[row.key] = { value: '', hasValue: false, updated_at: row.updated_at };
      }
    } else {
      result[row.key] = { value: row.value, updated_at: row.updated_at };
    }
  }
  res.json(result);
});

// Set a setting
router.put('/:key', (req, res) => {
  const { key } = req.params;
  let { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });

  const db = getDb();

  // Encrypt token values
  if (key.startsWith('token_')) {
    value = encrypt(value);
  }

  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')"
  ).run(key, value, value);

  res.json({ ok: true });
});

// Delete a setting
router.delete('/:key', (req, res) => {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
  res.status(204).end();
});

// Internal: get raw decrypted token (used by server internals, not exposed via API)
export function getToken(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return decrypt(row.value);
  } catch {
    return null;
  }
}

// Internal: get a plain setting value
export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export default router;
