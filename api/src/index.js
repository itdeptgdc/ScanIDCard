const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cfg = require('./config');
const { pool } = require('./db');
const { migrate } = require('./migrate');
const cache = require('./cache');
const { HttpError } = require('./util');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cookieParser());

// Scan hot path is mounted first: no compression, tiny JSON limit.
app.use('/api/scan', require('./routes/scan'));

app.use(compression());
app.use(express.json({ limit: '3mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, cachedStaff: cache.size() });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/users', require('./routes/users'));
app.use('/api/card-templates', require('./routes/templates'));

app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  if (err.code === '23505') {
    const c = err.constraint || '';
    const code = c.includes('card') ? 'CARD_EXISTS' : c.includes('id_number') ? 'ID_EXISTS' : c.includes('username') ? 'USERNAME_EXISTS' : 'DUPLICATE';
    return res.status(409).json({ error: code });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.type === 'entity.too.large' ? 'TOO_LARGE' : 'BAD_REQUEST' });
  console.error(err);
  res.status(500).json({ error: 'SERVER_ERROR' });
});

(async () => {
  await migrate();
  await cache.init();
  const server = app.listen(cfg.port, () => console.log(`[api] listening on :${cfg.port}`));
  server.keepAliveTimeout = 65000;
  const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch((e) => {
  console.error('[api] failed to start:', e);
  process.exit(1);
});
