import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.CLEANMAP_DATA_DIR || path.join(os.homedir(), '.cleanmap', 'data'));
const uploadDir = path.join(dataDir, 'private-evidence');
fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
const dbPath = path.resolve(process.env.CLEANMAP_DB_PATH || path.join(dataDir, 'cleanmap.sqlite'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('citizen','authority')),
    department TEXT,
    jurisdictions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    public_ref TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    ward TEXT NOT NULL,
    department TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    evidence_name TEXT,
    evidence_mime TEXT,
    severity TEXT,
    location_notes TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS complaints_owner ON complaints(owner_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS complaints_scope ON complaints(department, jurisdiction, status, created_at);
  CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES users(id),
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS history_complaint ON status_history(complaint_id, created_at);
  CREATE TABLE IF NOT EXISTS internal_notes (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
const complaintColumns = new Set(db.prepare('PRAGMA table_info(complaints)').all().map((column) => column.name));
if (!complaintColumns.has('evidence_mime')) db.exec('ALTER TABLE complaints ADD COLUMN evidence_mime TEXT');
if (!complaintColumns.has('severity')) db.exec('ALTER TABLE complaints ADD COLUMN severity TEXT');
if (!complaintColumns.has('location_notes')) db.exec('ALTER TABLE complaints ADD COLUMN location_notes TEXT');

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: { maxAge: 31536000 },
}));
app.use(express.json({ limit: '32kb' }));

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) app.set('trust proxy', trustedProxyHops);

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.origin === clientOrigin) {
    res.setHeader('Access-Control-Allow-Origin', clientOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    if (req.headers.origin !== clientOrigin) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  next();
});

const rateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', rateLimiter);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Try again later.' } });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many account creation attempts. Try again later.' } });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

const now = () => new Date().toISOString();
const publicUser = (user) => ({ id: user.id, displayName: user.display_name, role: user.role });
const getSessionUser = async (req) => {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !supabaseUrl || !supabasePublishableKey) return null;
  const headers = { apikey: supabasePublishableKey, Authorization: `Bearer ${token}` };
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers, signal: AbortSignal.timeout(8000) });
  if (!authResponse.ok) return null;
  const authUser = await authResponse.json();
  if (!authUser.id || !/^[0-9a-f-]{36}$/i.test(authUser.id)) return null;
  const profileUrl = new URL('/rest/v1/profiles', supabaseUrl);
  profileUrl.search = new URLSearchParams({ select: 'id,display_name,role,department,jurisdictions', id: `eq.${authUser.id}`, limit: '1' }).toString();
  const profileResponse = await fetch(profileUrl, { headers, signal: AbortSignal.timeout(8000) });
  if (!profileResponse.ok) throw new Error(`Supabase profile lookup failed (${profileResponse.status}).`);
  const [profile] = await profileResponse.json();
  if (!profile || !['citizen', 'authority'].includes(profile.role)) return null;
  const user = {
    id: authUser.id,
    email: String(authUser.email || '').trim().toLowerCase(),
    display_name: typeof profile.display_name === 'string' && profile.display_name.trim()
      ? profile.display_name.trim()
      : String(authUser.user_metadata?.display_name || authUser.email || 'User').slice(0, 100),
    role: profile.role,
    department: profile.department || null,
    jurisdictions_json: JSON.stringify(Array.isArray(profile.jurisdictions) ? profile.jurisdictions : []),
  };
  db.prepare(`INSERT INTO users(id,email,display_name,password_hash,role,department,jurisdictions_json,created_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name,
    role=excluded.role, department=excluded.department, jurisdictions_json=excluded.jurisdictions_json`).run(
    user.id, user.email, user.display_name, 'managed-by-supabase', user.role, user.department, user.jurisdictions_json, now()
  );
  return user;
};
const requireAuth = (role) => async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: 'Sign in to continue.' });
    if (role && user.role !== role) return res.status(403).json({ message: 'You do not have access to this operation.' });
    req.user = user;
    next();
  } catch (error) {
    console.error('Supabase authentication could not be verified:', error?.message || 'unknown error');
    return res.status(503).json({ message: 'Authentication could not be verified. Please try again.' });
  }
};
const requireTrustedOrigin = (req, res, next) => {
  if (req.headers.origin !== clientOrigin) return res.status(403).json({ message: 'Request origin was not accepted.' });
  next();
};
const roleMiddleware = (role) => [requireTrustedOrigin, requireAuth(role)];
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const validEmail = (value) => typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const displayDate = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const transitions = {
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': ['In Progress', 'Needs Information', 'Rejected'],
  'In Progress': ['Resolved', 'Needs Information'],
  'Needs Information': ['Under Review', 'In Progress', 'Rejected'],
  Resolved: [],
  Rejected: [],
};
const reasonRequired = new Set(['Needs Information', 'Rejected', 'Resolved']);

function readJurisdictionMap() {
  const raw = process.env.JURISDICTION_MAP_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error('JURISDICTION_MAP_JSON must be a JSON object mapping exact ward labels to { department, jurisdiction }.');
  }
}
const jurisdictionMap = readJurisdictionMap();

function complaintScope(user, complaint) {
  return user.role === 'authority' && user.department === complaint.department &&
    JSON.parse(user.jurisdictions_json).includes(complaint.jurisdiction);
}

function historyFor(complaintId, authorityView) {
  const rows = db.prepare(`SELECT h.*, u.display_name FROM status_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.complaint_id=? ORDER BY h.created_at ASC`).all(complaintId);
  return rows.map((row) => ({
    id: row.id,
    title: row.status,
    status: row.status,
    statusType: row.status === 'Submitted' ? 'submitted' : row.status === 'Under Review' ? 'under-review' : 'action-reported',
    date: displayDate(row.created_at),
    description: row.reason,
    ...(authorityView && row.display_name ? { reviewerName: row.display_name } : {}),
  }));
}

function toReport(row, authorityView = false) {
  const evidencePath = row.evidence_name ? `/api/${authorityView ? 'authority' : 'citizen'}/complaints/${encodeURIComponent(row.public_ref)}/evidence` : '';
  return {
    id: row.public_ref,
    title: row.category,
    category: row.category,
    ward: row.ward,
    location: row.location,
    coordinates: row.latitude == null || row.longitude == null ? 'Not provided' : `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`,
    lat: row.latitude ?? undefined,
    lng: row.longitude ?? undefined,
    submittedAt: displayDate(row.created_at),
    status: row.status,
    triageTurnaround: '',
    resolutionSpan: '',
    geostampAccuracy: '',
    attestations: '',
    originalImage: evidencePath,
    originalImageTag: '',
    siteAssessment: row.description,
    ...(row.severity ? { severity: row.severity } : {}),
    ...(row.location_notes ? { locationNotes: row.location_notes } : {}),
    timeline: historyFor(row.id, authorityView),
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    callback(allowed.has(file.mimetype) ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), allowed.has(file.mimetype));
  },
});

function validateImage(file) {
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(file.path, 'r');
  try { fs.readSync(fd, buffer, 0, buffer.length, 0); } finally { fs.closeSync(fd); }
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new Error('The uploaded file content is not a supported image.');
  return isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp';
}

async function proxySupabaseAuth(res, action, payload, successStatus, redirectTo) {
  if (!supabaseUrl || !supabasePublishableKey) return res.status(503).json({ message: 'Authentication is not configured.' });
  const upstreamUrl = new URL(action === 'login' ? 'auth/v1/token?grant_type=password' : 'auth/v1/signup', `${supabaseUrl.replace(/\/$/, '')}/`);
  if (redirectTo) upstreamUrl.searchParams.set('redirect_to', redirectTo);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { apikey: supabasePublishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      return res.status(action === 'login' ? 401 : 400).json({
        message: action === 'login' ? 'Email or password was not accepted.' : 'Could not create the account. Check the details or sign in.',
      });
    }
    const result = await upstream.json();
    return res.status(successStatus).json(result);
  } catch (error) {
    console.error('Supabase Auth request failed:', error?.name || 'unknown error');
    return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
  }
}

app.post('/api/auth/login', loginLimiter, requireTrustedOrigin, (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string' || password.length < 1 || password.length > 1024) {
    return res.status(400).json({ message: 'Enter a valid email address and password.' });
  }
  return proxySupabaseAuth(res, 'login', { email: email.trim().toLowerCase(), password }, 200);
});

app.post('/api/auth/register', requireTrustedOrigin, signupLimiter, (req, res) => {
  const { displayName, email, password } = req.body || {};
  if (!validText(displayName, 100) || !validEmail(email) || typeof password !== 'string' || password.length < 12 || password.length > 200) {
    return res.status(400).json({ message: 'Enter a name, valid email address, and password of at least 12 characters.' });
  }
  const redirectTo = `${clientOrigin.replace(/\/$/, '')}/citizen/login`;
  return proxySupabaseAuth(res, 'register', {
    email: email.trim().toLowerCase(),
    password,
    data: { display_name: displayName.trim() },
  }, 201, redirectTo);
});

app.get('/api/auth/session', ...roleMiddleware(), (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/citizen/complaints', ...roleMiddleware('citizen'), (req, res) => {
  const rows = db.prepare('SELECT * FROM complaints WHERE owner_id=? ORDER BY created_at DESC').all(req.user.id);
  return res.json(rows.map((row) => toReport(row, false)));
});

app.post('/api/citizen/complaints', ...roleMiddleware('citizen'), uploadLimiter, upload.single('evidence'), (req, res, next) => {
  let evidencePath = req.file?.path;
  try {
    const complaint = JSON.parse(req.body?.complaint || '{}');
    const { category, description, location, ward, severity, locationNotes } = complaint;
    const latitude = complaint.latitude === undefined || complaint.latitude === '' ? null : Number(complaint.latitude);
    const longitude = complaint.longitude === undefined || complaint.longitude === '' ? null : Number(complaint.longitude);
    if (!validText(category, 80) || !validText(description, 5000) || !validText(location, 300) || !validText(ward, 100)) {
      if (evidencePath) fs.rmSync(evidencePath, { force: true });
      return res.status(400).json({ message: 'Category, description, location, and ward are required.' });
    }
    if (!['low', 'moderate', 'severe'].includes(severity) || (locationNotes !== undefined && (typeof locationNotes !== 'string' || locationNotes.trim().length > 500))) {
      if (evidencePath) fs.rmSync(evidencePath, { force: true });
      return res.status(400).json({ message: 'Choose a severity and keep location notes to 500 characters or fewer.' });
    }
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      if (evidencePath) fs.rmSync(evidencePath, { force: true });
      return res.status(400).json({ message: 'Location coordinates are invalid.' });
    }
    const normalizedWard = ward.trim().toLowerCase();
    const mapped = Object.entries(jurisdictionMap).find(([label]) => label.trim().toLowerCase() === normalizedWard)?.[1];
    if (mapped && (!validText(mapped.department, 100) || !validText(mapped.jurisdiction, 100))) {
      if (evidencePath) fs.rmSync(evidencePath, { force: true });
      return res.status(500).json({ message: 'This complaint location is not configured for safe assignment.' });
    }
    const department = mapped && validText(mapped.department, 100) ? mapped.department.trim() : 'unassigned';
    const jurisdiction = mapped && validText(mapped.jurisdiction, 100) ? mapped.jurisdiction.trim() : 'unassigned';
    const evidenceMime = req.file ? validateImage(req.file) : null;
    const id = crypto.randomUUID();
    const publicRef = `CM-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
    const createdAt = now();
    const insert = db.transaction(() => {
      db.prepare(`INSERT INTO complaints(id,public_ref,owner_id,category,description,location,ward,department,jurisdiction,latitude,longitude,evidence_name,evidence_mime,severity,location_notes,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, publicRef, req.user.id, category.trim(), description.trim(), location.trim(), ward.trim(), department, jurisdiction, latitude, longitude, req.file?.filename || null, evidenceMime, severity, locationNotes?.trim() || null, 'Submitted', createdAt, createdAt);
      db.prepare('INSERT INTO status_history(id,complaint_id,actor_id,status,reason,created_at) VALUES(?,?,?,?,?,?)')
        .run(crypto.randomUUID(), id, req.user.id, 'Submitted', 'Complaint submitted.', createdAt);
    });
    insert();
    return res.status(201).json(toReport(db.prepare('SELECT * FROM complaints WHERE id=?').get(id), false));
  } catch (error) {
    if (evidencePath) fs.rmSync(evidencePath, { force: true });
    if (error instanceof SyntaxError) return res.status(400).json({ message: 'Complaint form data is invalid.' });
    if (error instanceof multer.MulterError) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Evidence images must be 5 MB or smaller.' : 'Evidence upload is invalid.' });
    if (error instanceof Error && /image/.test(error.message)) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

app.get('/api/authority/complaints', ...roleMiddleware('authority'), (req, res) => {
  const userJurisdictions = JSON.parse(req.user.jurisdictions_json);
  if (!req.user.department || userJurisdictions.length === 0) return res.json([]);
  const params = [req.user.department, ...userJurisdictions];
  let sql = `SELECT * FROM complaints WHERE department=? AND jurisdiction IN (${userJurisdictions.map(() => '?').join(',')})`;
  const filters = { status: ['Submitted', 'Under Review', 'In Progress', 'Needs Information', 'Resolved', 'Rejected'] };
  if (req.query.status) {
    if (!filters.status.includes(req.query.status)) return res.status(400).json({ message: 'Status filter is invalid.' });
    sql += ' AND status=?'; params.push(req.query.status);
  }
  if (req.query.category) { sql += ' AND category LIKE ?'; params.push(`%${String(req.query.category).slice(0, 80)}%`); }
  if (req.query.location) { sql += ' AND (location LIKE ? OR ward LIKE ?)'; params.push(`%${String(req.query.location).slice(0, 100)}%`, `%${String(req.query.location).slice(0, 100)}%`); }
  if (req.query.from && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) { sql += ' AND created_at >= ?'; params.push(`${req.query.from}T00:00:00.000Z`); }
  if (req.query.to && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) { sql += ' AND created_at < ?'; const d = new Date(`${req.query.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); params.push(d.toISOString()); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  return res.json(db.prepare(sql).all(...params).map((row) => toReport(row, true)));
});

function findAuthorizedComplaint(req, res) {
  const row = db.prepare('SELECT * FROM complaints WHERE public_ref=?').get(req.params.id);
  if (!row || !complaintScope(req.user, row)) { res.status(404).json({ message: 'Complaint was not found in your authorized area.' }); return null; }
  return row;
}

app.patch('/api/authority/complaints/:id/status', ...roleMiddleware('authority'), (req, res) => {
  const complaint = findAuthorizedComplaint(req, res);
  if (!complaint) return;
  const { status, reason = '' } = req.body || {};
  if (typeof status !== 'string' || !transitions[complaint.status]?.includes(status)) return res.status(409).json({ message: 'That status transition is not allowed.' });
  if (reasonRequired.has(status) && !validText(reason, 1000)) return res.status(400).json({ message: 'A reason is required for this status change.' });
  if (reason && (typeof reason !== 'string' || reason.length > 1000)) return res.status(400).json({ message: 'Reason must be 1,000 characters or fewer.' });
  const createdAt = now();
  const update = db.transaction(() => {
    const updated = db.prepare('UPDATE complaints SET status=?,updated_at=? WHERE id=? AND status=?').run(status, createdAt, complaint.id, complaint.status);
    if (!updated.changes) throw new Error('STATUS_CHANGED_CONCURRENTLY');
    db.prepare('INSERT INTO status_history(id,complaint_id,actor_id,status,reason,created_at) VALUES(?,?,?,?,?,?)')
      .run(crypto.randomUUID(), complaint.id, req.user.id, status, String(reason).trim() || `Status changed to ${status}.`, createdAt);
  });
  try { update(); } catch (error) {
    if (error.message === 'STATUS_CHANGED_CONCURRENTLY') return res.status(409).json({ message: 'The complaint changed while you were reviewing it. Refresh the queue and try again.' });
    throw error;
  }
  return res.json(toReport(db.prepare('SELECT * FROM complaints WHERE id=?').get(complaint.id), true));
});

app.post('/api/authority/complaints/:id/notes', ...roleMiddleware('authority'), (req, res) => {
  const complaint = findAuthorizedComplaint(req, res);
  if (!complaint) return;
  if (!validText(req.body?.note, 5000)) return res.status(400).json({ message: 'Internal notes must contain 1 to 5,000 characters.' });
  db.prepare('INSERT INTO internal_notes(id,complaint_id,actor_id,note,created_at) VALUES(?,?,?,?,?)')
    .run(crypto.randomUUID(), complaint.id, req.user.id, req.body.note.trim(), now());
  return res.sendStatus(204);
});

app.get('/api/authority/complaints/:id/notes', ...roleMiddleware('authority'), (req, res) => {
  const complaint = findAuthorizedComplaint(req, res);
  if (!complaint) return;
  const notes = db.prepare(`SELECT n.id,n.note,n.created_at,u.display_name FROM internal_notes n
    JOIN users u ON u.id=n.actor_id WHERE n.complaint_id=? ORDER BY n.created_at ASC`).all(complaint.id);
  return res.json(notes.map((item) => ({ id: item.id, note: item.note, author: item.display_name, createdAt: displayDate(item.created_at) })));
});

app.get('/api/authority/complaints/:id/evidence', ...roleMiddleware('authority'), (req, res) => {
  const complaint = findAuthorizedComplaint(req, res);
  if (!complaint) return;
  if (!complaint.evidence_name) return res.sendStatus(404);
  const image = path.join(uploadDir, path.basename(complaint.evidence_name));
  return res.sendFile(image, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': complaint.evidence_mime } }, (err) => { if (err && !res.headersSent) res.sendStatus(404); });
});

app.get('/api/citizen/complaints/:id/evidence', ...roleMiddleware('citizen'), (req, res) => {
  const complaint = db.prepare('SELECT * FROM complaints WHERE public_ref=? AND owner_id=?').get(req.params.id, req.user.id);
  if (!complaint || !complaint.evidence_name) return res.sendStatus(404);
  const image = path.join(uploadDir, path.basename(complaint.evidence_name));
  return res.sendFile(image, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': complaint.evidence_mime } }, (err) => { if (err && !res.headersSent) res.sendStatus(404); });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Evidence images must be 5 MB or smaller.' : 'Evidence upload is invalid.' });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ message: 'Request data is invalid.' });
  console.error('CleanMap API request failed:', error?.message || 'unknown error');
  return res.status(500).json({ message: 'The service could not complete the request.' });
});

const port = Number(process.env.PORT || 3001);
if (process.env.NODE_ENV === 'production') {
  if (!process.env.CLIENT_ORIGIN) throw new Error('Set CLIENT_ORIGIN to the exact HTTPS origin of the web client in production.');
  if (new URL(process.env.CLIENT_ORIGIN).protocol !== 'https:') throw new Error('CLIENT_ORIGIN must use HTTPS in production.');
  if (!supabaseUrl.startsWith('https://') || !supabasePublishableKey) throw new Error('Set the HTTPS Supabase URL and publishable key in production.');
  if (trustedProxyHops < 0 || !Number.isInteger(trustedProxyHops)) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.listen(port, () => console.log(`CleanMap API listening on port ${port}.`));

