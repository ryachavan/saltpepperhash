// db.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    method TEXT NOT NULL,        -- 'plain' | 'salted' | 'salted_peppered'
    hash TEXT NOT NULL,
    salt TEXT,                   -- NULL for the plain method
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
