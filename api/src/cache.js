/**
 * In-memory staff index used by the scanner.
 *
 * A scan resolves ID number / card number with a Map lookup (~microseconds) instead of a
 * database round-trip. 100,000 staff use only a few tens of MB of RAM.
 * The cache stays correct across several API instances through Postgres LISTEN/NOTIFY:
 * a trigger on `staff` publishes each changed id, and every instance reloads those rows.
 */
const { Client } = require('pg');
const { pool } = require('./db');
const cfg = require('./config');

const COLS = `id, id_number, card_number, name, position, department, company, passport,
  card_type, status, hire_date, card_expiry, has_photo, photo_version`;

const byId = new Map();
const byIdNumber = new Map();
const byCardNumber = new Map();

function remove(id) {
  const old = byId.get(id);
  if (!old) return;
  byId.delete(id);
  if (byIdNumber.get(old.id_number) === old) byIdNumber.delete(old.id_number);
  if (old.card_number && byCardNumber.get(old.card_number) === old) byCardNumber.delete(old.card_number);
}

function put(r) {
  remove(r.id);
  byId.set(r.id, r);
  byIdNumber.set(r.id_number, r);
  if (r.card_number) byCardNumber.set(r.card_number, r);
}

async function loadAll() {
  const t = Date.now();
  const { rows } = await pool.query(`SELECT ${COLS} FROM staff`);
  byId.clear();
  byIdNumber.clear();
  byCardNumber.clear();
  for (const r of rows) put(r);
  console.log(`[cache] loaded ${rows.length} staff in ${Date.now() - t} ms`);
}

async function refresh(ids) {
  if (!ids.length) return;
  const { rows } = await pool.query(`SELECT ${COLS} FROM staff WHERE id = ANY($1::int[])`, [ids]);
  const found = new Set();
  for (const r of rows) {
    found.add(r.id);
    put(r);
  }
  for (const id of ids) if (!found.has(id)) remove(id);
}

// ---- change notifications (batched, so a 100k-row import triggers one full reload) ----
const pending = new Set();
let timer = null;
let needFull = false;

function schedule(id) {
  if (Number.isInteger(id)) pending.add(id);
  if (pending.size > 2000) needFull = true;
  if (!timer) timer = setTimeout(flush, 150);
}

async function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  const full = needFull;
  needFull = false;
  try {
    if (full) await loadAll();
    else await refresh(ids);
  } catch (e) {
    console.error('[cache] refresh failed, retrying:', e.message);
    ids.forEach((i) => pending.add(i));
    needFull = needFull || full;
    if (!timer) timer = setTimeout(flush, 2000);
  }
}

async function listen() {
  const client = new Client({ connectionString: cfg.databaseUrl });
  let restarted = false;
  const restart = (err) => {
    if (restarted) return;
    restarted = true;
    console.error('[cache] LISTEN connection lost:', err?.message);
    client.end().catch(() => {});
    setTimeout(async () => {
      try {
        await listen();
        await loadAll(); // we may have missed notifications while disconnected
      } catch (e) {
        restart(e);
      }
    }, 2000);
  };
  client.on('notification', (m) => schedule(parseInt(m.payload, 10)));
  client.on('error', restart);
  client.on('end', () => restart(new Error('connection ended')));
  await client.connect();
  await client.query('LISTEN staff_changed');
}

async function init() {
  await listen();
  await loadAll();
}

/** Lookup with database fallback - covers the few ms between a write and its notification. */
async function findByIdNumber(key) {
  const hit = byIdNumber.get(key);
  if (hit) return hit;
  const { rows } = await pool.query({ name: 'cache_by_id', text: `SELECT ${COLS} FROM staff WHERE id_number = $1`, values: [key] });
  if (rows[0]) put(rows[0]);
  return rows[0] || null;
}

async function findByCardNumber(key) {
  const hit = byCardNumber.get(key);
  if (hit) return hit;
  const { rows } = await pool.query({ name: 'cache_by_card', text: `SELECT ${COLS} FROM staff WHERE card_number = $1`, values: [key] });
  if (rows[0]) put(rows[0]);
  return rows[0] || null;
}

module.exports = { init, refresh, findByIdNumber, findByCardNumber, size: () => byId.size };
