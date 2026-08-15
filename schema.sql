-- Bysmillah HR — D1 (SQLite) sxemasi

CREATE TABLE IF NOT EXISTS candidates (
  id           TEXT PRIMARY KEY,
  telegram_id  TEXT,
  username     TEXT,
  lang         TEXT DEFAULT 'en',
  answers      TEXT NOT NULL DEFAULT '{}',   -- JSON
  cv_name      TEXT,
  cv_key       TEXT,                          -- KV kaliti
  cv_size      INTEGER,
  status       TEXT NOT NULL DEFAULT 'yangi',
  status_by    TEXT,
  status_at    TEXT,
  notified     TEXT NOT NULL DEFAULT '[]',    -- JSON massiv
  group_msg_id INTEGER,
  created_at   TEXT NOT NULL,
  edited_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_candidates_tg ON candidates(telegram_id);
CREATE INDEX IF NOT EXISTS idx_candidates_created ON candidates(created_at DESC);

CREATE TABLE IF NOT EXISTS staff (
  username      TEXT PRIMARY KEY,
  telegram      TEXT,
  role          TEXT NOT NULL DEFAULT 'staff',   -- admin | staff
  kind          TEXT NOT NULL DEFAULT 'worker',  -- admin | specialist | worker
  specialist    TEXT,                            -- ishchi qaysi mutaxassisga biriktirilgan
  departments   TEXT NOT NULL DEFAULT '[]',      -- JSON massiv
  salt          TEXT NOT NULL,
  hash          TEXT NOT NULL,
  secret        TEXT,                            -- parolning shifrlangan nusxasi
  avatar_key    TEXT,                            -- KV kaliti
  active        INTEGER NOT NULL DEFAULT 1,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  created_by    TEXT,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_specialist ON staff(specialist);

-- Bot foydalanuvchilari: tili va oxirgi salom xabari
CREATE TABLE IF NOT EXISTS bot_users (
  telegram_id        TEXT PRIMARY KEY,
  lang               TEXT,
  welcome_message_id INTEGER
);

-- Sozlamalar: hr guruhi, adminlar
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
