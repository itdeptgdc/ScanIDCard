const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth, forgetUser } = require('../auth');
const { ah, HttpError } = require('../util');

const router = express.Router();
router.use(requireAuth('admin'));

const ROLES = ['admin', 'hr', 'checker'];
const USER_RE = /^[a-z0-9._-]{3,32}$/;

router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await pool.query(`SELECT id, username, display_name, role, status, (status = 'active') AS active, created_at FROM users ORDER BY id`);
    res.json({ rows });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const display = String(req.body?.display_name || '').trim().slice(0, 80);
    const role = ROLES.includes(req.body?.role) ? req.body.role : null;
    const password = String(req.body?.password || '');
    if (!USER_RE.test(username)) throw new HttpError(400, 'USERNAME_INVALID');
    if (!role) throw new HttpError(400, 'BAD_REQUEST');
    if (password.length < 8) throw new HttpError(400, 'PASSWORD_SHORT');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, display_name, password_hash, role, status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [username, display, hash, role, req.body?.active === false || req.body?.status === 'blocked' ? 'blocked' : 'active']
    );
    res.status(201).json({ id: rows[0].id });
  })
);

router.put(
  '/:id(\\d+)',
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const self = id === req.user.id;
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const u = rows[0];
    if (!u) throw new HttpError(404, 'NOT_FOUND');

    const display = req.body?.display_name !== undefined ? String(req.body.display_name).trim().slice(0, 80) : u.display_name;
    const role = ROLES.includes(req.body?.role) ? req.body.role : u.role;
    const active =
      typeof req.body?.active === 'boolean' ? req.body.active
      : ['active', 'blocked'].includes(req.body?.status) ? req.body.status === 'active'
      : u.status === 'active';
    if (self && (role !== 'admin' || !active)) throw new HttpError(400, 'SELF');

    let hash = u.password_hash;
    if (req.body?.password) {
      if (String(req.body.password).length < 8) throw new HttpError(400, 'PASSWORD_SHORT');
      hash = await bcrypt.hash(String(req.body.password), 10);
    }
    await pool.query('UPDATE users SET display_name=$1, role=$2, status=$3, password_hash=$4 WHERE id=$5', [display, role, active ? 'active' : 'blocked', hash, id]);
    forgetUser(id);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id(\\d+)',
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id) throw new HttpError(400, 'SELF');
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    forgetUser(id);
    res.json({ ok: true });
  })
);

module.exports = router;
