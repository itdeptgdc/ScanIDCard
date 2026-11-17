const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);

const cfg = {
  port: parseInt(env('PORT', '4000'), 10),
  databaseUrl: env('DATABASE_URL', 'postgres://scanid:scanid@localhost:5432/scanid'),
  dbPoolMax: parseInt(env('DB_POOL_MAX', '20'), 10),

  jwtSecret: env('JWT_SECRET', 'dev-jwt-secret-change-me'),
  qrSecret: env('QR_SECRET', 'dev-qr-secret-change-me'),
  sessionHours: parseInt(env('SESSION_HOURS', '12'), 10),
  cookieSecure: env('COOKIE_SECURE', 'false') === 'true',

  // Time zone used to decide the "work date" of a scan.
  tz: env('APP_TZ', 'Asia/Bangkok'),
  // Scan windows (HH:MM, app time zone). Check-in window, then check-out window (may cross midnight).
  // Scans outside both windows are rejected (OUTSIDE_HOURS). The work day starts at CHECKIN_START,
  // so a 02:00 check-out still belongs to yesterday's work date.
  checkinStart: env('CHECKIN_START', '04:30'),
  checkinEnd: env('CHECKIN_END', '16:30'),
  checkoutStart: env('CHECKOUT_START', '16:35'),
  checkoutEnd: env('CHECKOUT_END', '04:00'),
  // Scans closer together than this (seconds) are treated as duplicates, not check-out.
  minGapSec: parseInt(env('SCAN_MIN_GAP_SECONDS', '60'), 10),
  // Allow scanning by ID number alone (typed, or old QR codes that contain only the ID).
  allowIdOnly: env('ALLOW_ID_ONLY_SCAN', 'true') === 'true',
  logRetentionDays: parseInt(env('LOG_RETENTION_DAYS', '90'), 10),

  adminUser: env('ADMIN_USERNAME', 'admin'),
  adminPass: env('ADMIN_PASSWORD', 'admin1234'),
};

if (process.env.NODE_ENV === 'production') {
  for (const k of ['jwtSecret', 'qrSecret']) {
    if (cfg[k].startsWith('dev-')) console.warn(`[WARN] ${k} uses the default value - set it in .env before going live`);
  }
}

module.exports = cfg;
