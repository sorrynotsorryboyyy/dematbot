-- Schema DematBot. Rejoue a chaque demarrage, toujours idempotent.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  genre       TEXT,
  age         TEXT,
  price       TEXT,
  description TEXT,
  url         TEXT,
  image       TEXT,
  message_id  TEXT,
  thread_id   TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT UNIQUE,
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,           -- support | question | submission
  subject    TEXT,
  status     TEXT NOT NULL DEFAULT 'open',  -- open | claimed | accepted | hold | closed
  claimed_by TEXT,
  created_at INTEGER NOT NULL,
  closed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS submissions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL,
  game_name TEXT,
  stage     TEXT,
  copies    TEXT,
  edition   TEXT,
  team_size TEXT,
  url       TEXT,
  contact   TEXT,
  notes     TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS warns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason       TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warns_user ON warns(user_id);

CREATE TABLE IF NOT EXISTS rolepanels (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  kind       TEXT NOT NULL,   -- platform | notif
  roles_json TEXT NOT NULL
);
