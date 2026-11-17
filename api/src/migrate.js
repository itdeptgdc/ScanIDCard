const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const cfg = require('./config');

async function waitForDb() {
  for (let i = 0; i < 60; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`[db] waiting for database... (${e.message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('database not reachable');
}

async function migrate() {
  await waitForDb();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(424242)'); // safe when several API replicas start together
    await c.query(sql);
    const { rows } = await c.query('SELECT count(*)::int AS n FROM users');
    if (rows[0].n === 0) {
      const hash = await bcrypt.hash(cfg.adminPass, 10);
      await c.query(
        `INSERT INTO users (username, display_name, password_hash, role) VALUES ($1, 'Administrator', $2, 'admin')`,
        [cfg.adminUser.toLowerCase(), hash]
      );
      console.log(`[db] created default admin user "${cfg.adminUser}" - change the password after first login`);
    }
  } finally {
    await c.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    c.release();
  }
}

module.exports = { migrate };
