const path = require('path');
const Database = require('better-sqlite3');

const config = require('./config');
const fs = require('fs');

const dbPath = path.isAbsolute(config.databasePath)
  ? config.databasePath
  : path.join(process.cwd(), config.databasePath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
console.log(`[DB] SQLite path: ${dbPath}`);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS mods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL UNIQUE,
  kick_user_id TEXT UNIQUE,
  kick_username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  last_activity_at TEXT,
  last_activity_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stream_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_live INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  started_at TEXT,
  ended_at TEXT,
  last_event_at TEXT,
  panel_message_id TEXT,
  panel_channel_id TEXT,
  panel_created_at TEXT
);

INSERT OR IGNORE INTO stream_state (id, is_live) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mod_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  last_activity_at TEXT NOT NULL,
  warnings INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  close_reason TEXT,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  idle_minutes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shifts_open ON shifts(status, mod_id);
CREATE INDEX IF NOT EXISTS idx_shifts_started ON shifts(started_at);

CREATE TABLE IF NOT EXISTS mod_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL,
  mod_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_mod_created ON mod_activity(mod_id, created_at);

CREATE TABLE IF NOT EXISTS shift_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL,
  mod_id INTEGER NOT NULL,
  warning_number INTEGER NOT NULL,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processed_events (
  message_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

function addColumnIfMissing(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

addColumnIfMissing('mods', 'last_activity_at', 'TEXT');
addColumnIfMissing('mods', 'last_activity_type', 'TEXT');
addColumnIfMissing('stream_state', 'panel_message_id', 'TEXT');
addColumnIfMissing('stream_state', 'panel_channel_id', 'TEXT');
addColumnIfMissing('stream_state', 'panel_created_at', 'TEXT');



db.exec(`
CREATE TABLE IF NOT EXISTS mod_scores (
 mod_id INTEGER PRIMARY KEY,
 points INTEGER NOT NULL DEFAULT 0,
 active_minutes INTEGER NOT NULL DEFAULT 0,
 messages_count INTEGER NOT NULL DEFAULT 0
);
`);

module.exports = db;
