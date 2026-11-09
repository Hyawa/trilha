import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import Database from 'better-sqlite3'

let connection: Database.Database | null = null

export function databasePath(): string {
  return process.env.TRILHA_DB_PATH || path.join(app.getPath('userData'), 'trilha.db')
}

export function initDatabase(customPath?: string): void {
  const file = customPath || databasePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  connection = new Database(file)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  connection.pragma('synchronous = NORMAL')
  migrate(connection)
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      emoji TEXT NOT NULL DEFAULT '🧭',
      color TEXT NOT NULL DEFAULT '#3f6b5b',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('phase', 'topic', 'subtopic')),
      position INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      description TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'studying', 'review', 'done', 'skipped')),
      estimated_minutes INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_board ON nodes(board_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'link',
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_resources_node ON resources(node_id);

    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_checklist_node ON checklist_items(node_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    PRAGMA user_version = 1;
  `)
}

export function getDb(): Database.Database {
  if (!connection) throw new Error('Banco de dados não inicializado.')
  return connection
}

export function closeDatabase(): void {
  if (connection) {
    connection.close()
    connection = null
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
