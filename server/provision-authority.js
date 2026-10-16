import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.CLEANMAP_DATA_DIR || path.join(os.homedir(), '.cleanmap', 'data'));
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const dbPath = path.resolve(process.env.CLEANMAP_DB_PATH || path.join(dataDir, 'cleanmap.sqlite'));
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('citizen','authority')),
  department TEXT, jurisdictions_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
)`);

const [emailArg, nameArg, departmentArg, jurisdictionArg] = process.argv.slice(2);
if (!emailArg || !nameArg || !departmentArg || !jurisdictionArg) {
  console.error('Usage: npm run provision-authority -- <email> <display-name> <department> <jurisdiction[,jurisdiction...]>');
  console.error('Run this command only from a trusted administrative workstation. A unique initial password is printed once.');
  process.exit(2);
}
const email = emailArg.trim().toLowerCase();
const displayName = nameArg.trim();
const department = departmentArg.trim();
const jurisdictions = [...new Set(jurisdictionArg.split(',').map((item) => item.trim()).filter(Boolean))];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || !department || jurisdictions.length === 0) {
  console.error('Email, display name, department, and at least one jurisdiction are required.');
  process.exit(2);
}
const temporaryPassword = `${crypto.randomBytes(24).toString('base64url')}aA1!`;
const hash = await bcrypt.hash(temporaryPassword, 12);
try {
  db.prepare(`INSERT INTO users(id,email,display_name,password_hash,role,department,jurisdictions_json,created_at)
    VALUES(?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(), email, displayName, hash, 'authority', department,
      JSON.stringify(jurisdictions), new Date().toISOString());
  console.log(`Provisioned authority account ${email} for ${department}: ${jurisdictions.join(', ')}.`);
  console.log(`Initial password (share through a secure channel): ${temporaryPassword}`);
} catch (error) {
  if (String(error.code) === 'SQLITE_CONSTRAINT_UNIQUE') {
    console.error('An account with that email already exists.');
    process.exitCode = 1;
  } else throw error;
}
