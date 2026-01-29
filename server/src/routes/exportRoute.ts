import { Router } from 'express';
import { getDb } from '../db/connection.js';
import type { Session, Message } from '../../../shared/types.js';

const router = Router();

router.get('/:sessionId', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.sessionId) as Session | undefined;
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const messages = db
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(req.params.sessionId) as Message[];

  let md = `# ${session.title}\n\n`;
  md += `*Exported from Claude Chat — ${new Date().toISOString()}*\n\n---\n\n`;

  for (const msg of messages) {
    const label = msg.role === 'user' ? '**You**' : '**Claude**';
    md += `${label}:\n\n${msg.content}\n\n---\n\n`;
  }

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${session.title}.md"`);
  res.send(md);
});

export default router;
