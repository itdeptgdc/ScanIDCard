const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { COOKIE, sign, setCookie, requireAuth } = require('../auth');
const { ah } = require('../util');

const router = express.Router();

// simple in-memory brute-force protection: 10 failed attempts / 15 min per IP+username
const attempts = new Map();
const WINDOW = 15 * 60e3;
const MAX = 10;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.first > WINDOW) attempts.delete(k);
}, 60e3).unref();

router.post(
  '/login',
  ah(async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const key = `${req.ip}|${username}`;
    const a = attempts.get(key);
    if (a && a.count >= MAX && Date.now() - a.first < WINDOW) return res.status(429).json({ error: 'TOO_MANY' });

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const u = rows[0];
    const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
    if (!u || !ok || u.status !== 'active') {
      const cur = attempts.get(key);
      if (!cur || Date.now() - cur.first > WINDOW) attempts.set(key, { count: 1, first: Date.now() });
      else cur.count++;
      return res.status(401).json({ error: 'INVALID_LOGIN' });
    }
    attempts.delete(key);
    setCookie(res, sign(u));
    res.json({ id: u.id, username: u.username, name: u.display_name || u.username, role: u.role });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth(), (req, res) => res.json(req.user));

module.exports = router;
