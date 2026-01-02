import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'trades.db');

let db: Database.Database;

export function initDatabase(): void {
  const fs = require('fs');
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_trades (
      tx_hash TEXT PRIMARY KEY,
      processed_at INTEGER NOT NULL
    )
  `);

  console.log('Database initialized');
}

export function isProcessed(txHash: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM processed_trades WHERE tx_hash = ?');
  return stmt.get(txHash) !== undefined;
}

export function markProcessed(txHash: string): void {
  const stmt = db.prepare('INSERT OR IGNORE INTO processed_trades (tx_hash, processed_at) VALUES (?, ?)');
  stmt.run(txHash, Date.now());
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    console.log('Database closed');
  }
}
