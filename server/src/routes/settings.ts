import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

const router = Router();

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

router.get('/', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const db = getDb();
  const rows = db.prepare('SELECT key, value, updated_at FROM settings WHERE user_id = ?').all(userId) as { key: string; value: string; updated_at: string }[];
  const result: Record<string, any> = {};
  for (const row of rows) {
    if (row.key.startsWith('token_')) {
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

router.put('/:key', (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { key } = req.params;
  let { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });

  const db = getDb();
  if (key.startsWith('token_')) {
    value = encrypt(value);
  }

  db.prepare(
    "INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id, key) DO UPDATE SET value = ?, updated_at = datetime('now')"
  ).run(userId, key, value, value);

  res.json({ ok: true });
});

router.delete('/:key', (req: Request, res: Response) => {
  const userId = req.user!.id;
  getDb().prepare('DELETE FROM settings WHERE user_id = ? AND key = ?').run(userId, req.params.key);
  res.status(204).end();
});

// Internal: get raw decrypted token for a specific user
export function getToken(key: string, userId?: string): string | null {
  const db = getDb();
  let row: { value: string } | undefined;
  if (userId) {
    row = db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key) as { value: string } | undefined;
  } else {
    // Fallback: get from first admin user
    row = db.prepare("SELECT s.value FROM settings s JOIN users u ON s.user_id = u.id WHERE s.key = ? AND u.role = 'admin' ORDER BY u.created_at ASC LIMIT 1").get(key) as { value: string } | undefined;
  }
  if (!row) return null;
  try {
    return decrypt(row.value);
  } catch {
    return null;
  }
}

// Internal: get a plain setting value for a specific user
export function getSetting(key: string, userId?: string): string | null {
  const db = getDb();
  let row: { value: string } | undefined;
  if (userId) {
    row = db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key) as { value: string } | undefined;
  } else {
    row = db.prepare("SELECT s.value FROM settings s JOIN users u ON s.user_id = u.id WHERE s.key = ? AND u.role = 'admin' ORDER BY u.created_at ASC LIMIT 1").get(key) as { value: string } | undefined;
  }
  return row?.value ?? null;
}

// Get the base domain for subdomain URLs (from admin settings or env var)
export function getBaseDomain(): string {
  const fromSetting = getSetting('base_domain');
  if (fromSetting) return fromSetting;
  return process.env.BASE_DOMAIN || 'localhost';
}

export default router;
