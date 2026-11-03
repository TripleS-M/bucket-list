const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

const COOKIE = 'token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Cross-site frontend in production needs SameSite=None; Secure.
const cookieBase = {
  httpOnly: true,
  sameSite: config.isProd ? 'none' : 'lax',
  secure: config.isProd,
};

function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { ...cookieBase, maxAge: MAX_AGE_MS });
}

function clearSession(res) {
  res.clearCookie(COOKIE, cookieBase);
}

function loadUser(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, config.jwtSecret);
    return db.prepare('SELECT id, email, name, avatar_url FROM users WHERE id = ?').get(sub) || null;
  } catch {
    return null;
  }
}

/** Attaches req.user if logged in; never blocks. */
function optionalAuth(req, _res, next) {
  req.user = loadUser(req);
  next();
}

function requireAuth(req, res, next) {
  req.user = loadUser(req);
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}

module.exports = { setSession, clearSession, optionalAuth, requireAuth };
