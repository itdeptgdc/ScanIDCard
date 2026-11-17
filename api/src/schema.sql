-- Scan ID schema. Idempotent: runs on every API start.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'checker')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- migration: old boolean column users.active -> users.status ('active' / 'blocked')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'active') THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    UPDATE users SET status = CASE WHEN active THEN 'active' ELSE 'blocked' END;
    ALTER TABLE users DROP COLUMN active;
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'blocked'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS staff (
  id            SERIAL PRIMARY KEY,
  id_number     TEXT NOT NULL,                 -- printed staff ID (normalised upper-case)
  card_number   TEXT,                          -- physical card / RFID number (normalised), optional
  name          TEXT NOT NULL DEFAULT '',
  position      TEXT NOT NULL DEFAULT '',
  department    TEXT NOT NULL DEFAULT '',
  company       TEXT NOT NULL DEFAULT '',
  passport      TEXT NOT NULL DEFAULT '',
  card_type     TEXT NOT NULL DEFAULT 'casino_staff',   -- built-in type, or 'tpl_<id>' (custom card template)
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'blocked')),
  hire_date     DATE,
  card_expiry   DATE,
  has_photo     BOOLEAN NOT NULL DEFAULT false,
  photo_version INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O(log n) exact lookups for the scanner
CREATE UNIQUE INDEX IF NOT EXISTS staff_id_number_uq   ON staff (id_number);
CREATE UNIQUE INDEX IF NOT EXISTS staff_card_number_uq ON staff (card_number) WHERE card_number IS NOT NULL;
-- fast "contains" search in the admin table
CREATE INDEX IF NOT EXISTS staff_name_trgm  ON staff USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS staff_idno_trgm  ON staff USING gin (id_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS staff_card_type_idx ON staff (card_type);
CREATE INDEX IF NOT EXISTS staff_expiry_idx    ON staff (card_expiry);

-- card types are now dynamic (custom templates): validated by the API instead of a CHECK constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_card_type_check;

-- custom ID card templates designed in the dashboard. Staff use them as card_type = 'tpl_<id>'.
CREATE TABLE IF NOT EXISTS card_templates (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#7b1fa2',   -- badge colour in lists
  design     JSONB NOT NULL DEFAULT '{}'::jsonb, -- background + positioned elements (see web/components/TemplateCard.js)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- images used by templates (background, logos ...)
CREATE TABLE IF NOT EXISTS card_assets (
  id         SERIAL PRIMARY KEY,
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- photos are kept out of the hot staff table
CREATE TABLE IF NOT EXISTS staff_photos (
  staff_id INT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  mime     TEXT NOT NULL,
  data     BYTEA NOT NULL
);

-- one row per person per work day: first scan = check-in, later scans = check-out
CREATE TABLE IF NOT EXISTS attendance (
  id         BIGSERIAL PRIMARY KEY,
  staff_id   INT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date  DATE NOT NULL,
  check_in   TIMESTAMPTZ NOT NULL,
  check_out  TIMESTAMPTZ,
  method_in  TEXT,
  method_out TEXT,
  scan_count INT NOT NULL DEFAULT 1,
  UNIQUE (staff_id, work_date)
);
CREATE INDEX IF NOT EXISTS attendance_work_date_idx ON attendance (work_date, check_in DESC);
-- check-out without a check-in (forgot to scan in the morning) is allowed
ALTER TABLE attendance ALTER COLUMN check_in DROP NOT NULL;

-- security audit trail (written in batches, never blocks a scan)
CREATE TABLE IF NOT EXISTS scan_logs (
  id       BIGSERIAL PRIMARY KEY,
  at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id INT,
  raw      TEXT,
  method   TEXT,
  result   TEXT NOT NULL,
  user_id  INT
);
CREATE INDEX IF NOT EXISTS scan_logs_at_idx ON scan_logs (at DESC);

-- notify every API instance so its in-memory scan cache stays in sync
CREATE OR REPLACE FUNCTION staff_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('staff_changed', COALESCE(NEW.id, OLD.id)::text);
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_notify_trg ON staff;
CREATE TRIGGER staff_notify_trg
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION staff_notify();
