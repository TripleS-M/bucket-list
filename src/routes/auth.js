const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { setSession, clearSession, requireAuth } = require('../middleware/auth');

const router = express.Router();
const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Valid bcrypt hash of a random string, compared against when the email is unknown so timing doesn't leak.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, avatarUrl: u.avatar_url });
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

router.post('/signup', authLimiter, async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const name = str(req.body.name);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Valid email required' });
  if (!name || name.length > 60) return res.status(400).json({ error: 'Name required (max 60 chars)' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8-72 characters' });

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const hash = await bcrypt.hash(password, 12);
  let id;
  try {
    id = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email, name, hash).lastInsertRowid;
  } catch {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  setSession(res, id);
  res.status(201).json({ user: publicUser(getUser(id)) });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !user.password_hash || !ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
});

// Frontend uses Google Identity Services and POSTs the resulting ID token ("credential").
router.post('/google', authLimiter, async (req, res) => {
  if (!googleClient) return res.status(503).json({ error: 'Google sign-in is not configured' });
  const credential = str(req.body.credential);
  if (!credential) return res.status(400).json({ error: 'credential required' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Invalid Google token' });
  }
  if (!payload?.email || !payload.email_verified) return res.status(401).json({ error: 'Google email not verified' });

  const email = payload.email.toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(payload.sub)
    || db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (email, name, google_id, avatar_url) VALUES (?, ?, ?, ?)')
      .run(email, payload.name || email.split('@')[0], payload.sub, payload.picture || null);
    user = getUser(lastInsertRowid);
  } else if (!user.google_id) {
    // Existing email/password account: link Google (Google has verified the email).
    db.prepare('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?')
      .run(payload.sub, payload.picture || null, user.id);
    user = getUser(user.id);
  }
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// Lets the frontend know whether to render the Google button, and with which client ID.
router.get('/config', (_req, res) => res.json({ googleClientId: config.googleClientId || null }));

module.exports = router;
