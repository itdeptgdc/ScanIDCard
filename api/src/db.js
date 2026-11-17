const { Pool, types } = require('pg');
const cfg = require('./config');

types.setTypeParser(1082, (v) => v); // DATE -> 'YYYY-MM-DD' string (no TZ shifting)
types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT (count(*)) -> number

const pool = new Pool({
  connectionString: cfg.databaseUrl,
  max: cfg.dbPoolMax,
  idleTimeoutMillis: 30000,
});
pool.on('error', (e) => console.error('[pg] idle client error:', e.message));

module.exports = { pool };
