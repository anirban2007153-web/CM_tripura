import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import crypto from 'node:crypto';
import http from 'node:http';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const origin = 'http://localhost:3000';
const publishableKey = 'sb_publishable_test_key';
const secretKey = 'sb_secret_test_key';
const usersById = new Map();
const usersByEmail = new Map();
const usersByToken = new Map();
let tempDir;
let apiPort;
let authPort;
let apiServer;
let authServer;
let baseUrl;
let authUrl;
let serverOutput = '';

async function getFreePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function addUser({ email, password, displayName, role = 'citizen', department = null, jurisdictions = [] }) {
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    password,
    user_metadata: { display_name: displayName },
    profile: { display_name: displayName, role, department, jurisdictions },
  };
  usersById.set(user.id, user);
  usersByEmail.set(user.email, user);
  return user;
}

function tokenResponse(user) {
  const accessToken = `test-token-${user.id}`;
  usersByToken.set(accessToken, user);
  return {
    access_token: accessToken,
    refresh_token: `refresh-${user.id}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: user.id, email: user.email, user_metadata: user.user_metadata },
  };
}

function startAuthServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, authUrl);
    if (req.method === 'POST' && url.pathname === '/auth/v1/signup') {
      const body = await readJson(req);
      const email = String(body.email || '').toLowerCase();
      if (usersByEmail.has(email)) return sendJson(res, 422, { msg: 'User already registered' });
      const user = addUser({ email, password: body.password, displayName: body.data?.display_name || '' });
      return sendJson(res, 200, { ...tokenResponse(user), user: { id: user.id, email, user_metadata: user.user_metadata } });
    }
    if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const body = await readJson(req);
      const user = usersByEmail.get(String(body.email || '').toLowerCase());
      if (!user || user.password !== body.password) return sendJson(res, 400, { msg: 'Invalid login credentials' });
      return sendJson(res, 200, tokenResponse(user));
    }
    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const user = usersByToken.get(token);
      if (!user) return sendJson(res, 401, { msg: 'Invalid token' });
      return sendJson(res, 200, { id: user.id, email: user.email, user_metadata: user.user_metadata });
    }
    if (req.method === 'GET' && url.pathname === '/rest/v1/profiles') {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const user = usersByToken.get(token);
      const profileId = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (!user) return sendJson(res, 401, { message: 'Invalid token' });
      return sendJson(res, 200, profileId === user.id ? [{ id: user.id, ...user.profile }] : []);
    }
    if (req.method === 'POST' && url.pathname === '/auth/v1/admin/users') {
      if (req.headers.apikey !== secretKey) return sendJson(res, 401, { message: 'Invalid admin key' });
      const body = await readJson(req);
      if (usersByEmail.has(String(body.email || '').toLowerCase())) return sendJson(res, 422, { msg: 'User already registered' });
      const user = addUser({ email: body.email, password: body.password, displayName: body.user_metadata?.display_name || '' });
      return sendJson(res, 200, { id: user.id, email: user.email, user_metadata: user.user_metadata });
    }
    if (req.method === 'PATCH' && url.pathname === '/rest/v1/profiles') {
      if (req.headers.apikey !== secretKey) return sendJson(res, 401, { message: 'Invalid admin key' });
      const profileId = url.searchParams.get('id')?.replace(/^eq\./, '');
      const user = usersById.get(profileId);
      const body = await readJson(req);
      if (!user) return sendJson(res, 404, { message: 'Profile not found' });
      user.profile = { ...user.profile, ...body };
      res.writeHead(204);
      return res.end();
    }
    return sendJson(res, 404, { message: 'Not found' });
  });
}

async function waitForApi() {
  const deadline = Date.now() + 15000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`, { headers: { Origin: origin } });
      if (response.status === 401) return;
    } catch (error) { lastError = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API server did not start in time (${lastError}). ${serverOutput}`);
}

async function request(route, { method = 'GET', body, token, ip = '203.0.113.11' } = {}) {
  const headers = { Origin: origin, 'X-Forwarded-For': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanmap-api-'));
  apiPort = await getFreePort();
  authPort = await getFreePort();
  authUrl = `http://127.0.0.1:${authPort}`;
  baseUrl = `http://127.0.0.1:${apiPort}`;
  authServer = startAuthServer();
  authServer.listen(authPort, '127.0.0.1');
  await once(authServer, 'listening');
  apiServer = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(apiPort),
      CLIENT_ORIGIN: origin,
      CLEANMAP_DATA_DIR: tempDir,
      JURISDICTION_MAP_JSON: JSON.stringify({
        'Ward 12': { department: 'sanitation', jurisdiction: 'ward-12' },
        'Ward 13': { department: 'sanitation', jurisdiction: 'ward-13' },
      }),
      SUPABASE_URL: authUrl,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
      NODE_ENV: 'test',
      TRUST_PROXY_HOPS: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiServer.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  apiServer.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  await waitForApi();
});

after(async () => {
  if (apiServer && apiServer.exitCode === null) {
    apiServer.kill();
    await once(apiServer, 'exit');
  }
  if (authServer?.listening) await new Promise((resolve) => authServer.close(resolve));
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test('Supabase Auth, origin checks, ownership, authority scope, workflow, and protected notes', async () => {
  const anonymous = await request('/api/auth/session');
  assert.equal(anonymous.status, 401);
  const rejectedOrigin = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Attacker', email: 'attacker@example.test', password: 'correct horse battery staple 123!' }),
  });
  assert.equal(rejectedOrigin.status, 403);

  const citizenResponse = await request('/api/auth/register', {
    method: 'POST', body: { displayName: 'Citizen One', email: 'citizen@example.test', password: 'correct horse battery staple 123!', role: 'authority' },
  });
  assert.equal(citizenResponse.status, 201);
  const citizenAuth = await citizenResponse.json();
  const citizenToken = citizenAuth.access_token;
  const citizenSessionResponse = await request('/api/auth/session', { token: citizenToken });
  assert.equal(citizenSessionResponse.status, 200);
  assert.equal((await citizenSessionResponse.json()).user.role, 'citizen');

  const ownList = await request('/api/citizen/complaints', { token: citizenToken });
  assert.equal(ownList.status, 200);
  assert.deepEqual(await ownList.json(), []);

  const complaintForm = new FormData();
  complaintForm.set('complaint', JSON.stringify({ category: 'Waste', description: 'Overflowing public bin', location: 'Main road', ward: 'Ward 12', latitude: 23.8, longitude: 91.2, severity: 'moderate', locationNotes: 'Near the junction' }));
  complaintForm.set('evidence', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jngAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'evidence.png');
  const complaintResponse = await request('/api/citizen/complaints', { method: 'POST', token: citizenToken, body: complaintForm });
  assert.equal(complaintResponse.status, 201);
  const complaint = await complaintResponse.json();
  assert.match(complaint.id, /^CM-[A-F0-9]{32}$/);
  assert.equal(complaint.status, 'Submitted');
  assert.equal(complaint.severity, 'moderate');
  assert.equal(complaint.locationNotes, 'Near the junction');
  assert.equal(complaint.timeline.length, 1);
  assert.equal('internalNotes' in complaint, false);
  const ownEvidence = await request(`/api/citizen/complaints/${complaint.id}/evidence`, { token: citizenToken });
  assert.equal(ownEvidence.status, 200);
  assert.match(ownEvidence.headers.get('content-type'), /image\/png/);

  const otherComplaintForm = new FormData();
  otherComplaintForm.set('complaint', JSON.stringify({ category: 'Waste', description: 'Unmapped location', location: 'Somewhere else', ward: 'Ward 13', severity: 'low' }));
  const unmappedResponse = await request('/api/citizen/complaints', { method: 'POST', token: citizenToken, body: otherComplaintForm });
  assert.equal(unmappedResponse.status, 201);

  const citizenCannotListAuthority = await request('/api/authority/complaints', { token: citizenToken });
  assert.equal(citizenCannotListAuthority.status, 403);
  const citizenCannotChangeStatus = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', token: citizenToken, body: { status: 'Resolved', reason: 'done' },
  });
  assert.equal(citizenCannotChangeStatus.status, 403);

  const otherCitizenResponse = await request('/api/auth/register', {
    method: 'POST', body: { displayName: 'Citizen Two', email: 'other@example.test', password: 'correct horse battery staple 456!' },
  });
  const otherToken = (await otherCitizenResponse.json()).access_token;
  const otherListResponse = await request('/api/citizen/complaints', { token: otherToken });
  assert.deepEqual(await otherListResponse.json(), []);
  const otherEvidenceResponse = await request(`/api/citizen/complaints/${complaint.id}/evidence`, { token: otherToken });
  assert.equal(otherEvidenceResponse.status, 404);

  const adminEnv = {
    ...process.env,
    SUPABASE_URL: authUrl,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    JURISDICTION_MAP_JSON: JSON.stringify({
      'Ward 12': { department: 'sanitation', jurisdiction: 'ward-12' },
      'Ward 13': { department: 'sanitation', jurisdiction: 'ward-13' },
    }),
  };
  const registrationCommand = await execFileAsync(process.execPath, [
    'server/provision-authority.js', 'staff@example.test', 'Authority Staff', 'sanitation', 'ward-12',
  ], { cwd: projectRoot, env: adminEnv });
  const temporaryPassword = registrationCommand.stdout.match(/password .*: (\S+)/i)?.[1];
  assert.ok(temporaryPassword);
  const authorityLogin = await request('/api/auth/login', {
    method: 'POST', body: { email: 'staff@example.test', password: temporaryPassword },
  });
  assert.equal(authorityLogin.status, 200);
  const authorityToken = (await authorityLogin.json()).access_token;
  const authoritySession = await request('/api/auth/session', { token: authorityToken });
  assert.equal((await authoritySession.json()).user.role, 'authority');

  const authorityQueue = await request('/api/authority/complaints', { token: authorityToken });
  assert.equal(authorityQueue.status, 200);
  const permittedReports = await authorityQueue.json();
  assert.equal(permittedReports.length, 1);
  assert.equal(permittedReports[0].id, complaint.id);

  const outOfScopeProvision = await execFileAsync(process.execPath, [
    'server/provision-authority.js', 'other-staff@example.test', 'Other Authority', 'sanitation', 'ward-13',
  ], { cwd: projectRoot, env: adminEnv });
  const otherPassword = outOfScopeProvision.stdout.match(/Initial password .*: (\S+)/i)?.[1];
  const otherAuthorityLogin = await request('/api/auth/login', {
    method: 'POST', body: { email: 'other-staff@example.test', password: otherPassword },
  });
  const otherAuthorityToken = (await otherAuthorityLogin.json()).access_token;
  const outOfScopeEvidence = await request(`/api/authority/complaints/${complaint.id}/evidence`, { token: otherAuthorityToken });
  assert.equal(outOfScopeEvidence.status, 404);

  const invalidTransition = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', token: authorityToken, body: { status: 'Resolved', reason: 'done' },
  });
  assert.equal(invalidTransition.status, 409);
  const review = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', token: authorityToken, body: { status: 'Under Review' },
  });
  assert.equal(review.status, 200);
  assert.equal((await review.json()).status, 'Under Review');
  const progress = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', token: authorityToken, body: { status: 'In Progress' },
  });
  assert.equal(progress.status, 200);
  const resolution = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', token: authorityToken, body: { status: 'Resolved' },
  });
  assert.equal(resolution.status, 400);
  const resolved = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', token: authorityToken, body: { status: 'Resolved', reason: 'Collected and verified.' },
  });
  assert.equal(resolved.status, 200);

  const note = await request(`/api/authority/complaints/${complaint.id}/notes`, {
    method: 'POST', token: authorityToken, body: { note: 'Keep route clear for pickup.' },
  });
  assert.equal(note.status, 204);
  const authorityNotes = await request(`/api/authority/complaints/${complaint.id}/notes`, { token: authorityToken });
  assert.equal((await authorityNotes.json())[0].note, 'Keep route clear for pickup.');
  const citizenNotes = await request(`/api/authority/complaints/${complaint.id}/notes`, { token: citizenToken });
  assert.equal(citizenNotes.status, 403);
});

test('citizen signups are rate limited per client IP', async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request('/api/auth/register', {
      method: 'POST',
      ip: '203.0.113.99',
      body: { displayName: `Rate Test ${attempt}`, email: `rate${attempt}@example.test`, password: 'correct horse battery staple 123!' },
    });
    assert.equal(response.status, 201);
  }
  const limited = await request('/api/auth/register', {
    method: 'POST',
    ip: '203.0.113.99',
    body: { displayName: 'Rate Test Final', email: 'rate-final@example.test', password: 'correct horse battery staple 123!' },
  });
  assert.equal(limited.status, 429);
});

