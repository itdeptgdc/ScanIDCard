const jwt = require('jsonwebtoken');
const cfg = require('./config');
const { pool } = require('./db');

const COOKIE = 'sid';

function sign(u) {
  return jwt.sign({ uid: u.id, un: u.username, name: u.display_name || u.username }, cfg.jwtSecret, {
    expiresIn: `${cfg.sessionHours}h`,
  });
}

function setCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: cfg.cookieSecure,
    maxAge: cfg.sessionHours * 3600e3,
    path: '/',
  });
}

// Role/active state is cached briefly so the scan endpoint does not hit the users table.
const userState = new Map();
const USER_TTL = 30000;

async function getUserState(uid) {
  const c = userState.get(uid);
  if (c && Date.now() - c.at < USER_TTL) return c;
  const { rows } = await pool.query({ name: 'auth_user', text: 'SELECT status, role FROM users WHERE id = $1', values: [uid] });
  const s = rows[0] ? { active: rows[0].status === 'active', role: rows[0].role, at: Date.now() } : { active: false, role: null, at: Date.now() };
  userState.set(uid, s);
  return s;
}

const forgetUser = (uid) => userState.delete(uid);

/** requireAuth() = any signed-in user; requireAuth('admin','hr') = only those roles. */
function requireAuth(...roles) {
  return async (req, res, next) => {
    let payload;
    try {
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const token = req.cookies?.[COOKIE] || bearer;
      if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
      payload = jwt.verify(token, cfg.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    try {
      const st = await getUserState(payload.uid);
      if (!st.active) return res.status(401).json({ error: 'UNAUTHORIZED' });
      req.user = { id: payload.uid, username: payload.un, name: payload.name, role: st.role };
      if (roles.length && !roles.includes(st.role)) return res.status(403).json({ error: 'FORBIDDEN' });
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { COOKIE, sign, setCookie, requireAuth, forgetUser };
