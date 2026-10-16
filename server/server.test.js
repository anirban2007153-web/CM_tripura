import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
const origin = 'http://localhost:3000';
let tempDir;
let port;
let server;
let baseUrl;
let serverOutput = '';

async function getFreePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port: freePort } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return freePort;
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`, { headers: { Origin: origin } });
      if (response.status === 401) return;
    } catch (error) { lastError = error.message; /* wait for the child process to bind */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API server did not start in time (${lastError}). ${serverOutput}`);
}

async function request(route, { method = 'GET', body, cookie } = {}) {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(`${baseUrl}${route}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
}

function sessionCookie(response) {
  const setCookie = response.headers.getSetCookie()[0];
  return setCookie?.split(';', 1)[0];
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanmap-api-'));
  port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      CLIENT_ORIGIN: origin,
      CLEANMAP_DATA_DIR: tempDir,
      JURISDICTION_MAP_JSON: JSON.stringify({ 'Ward 12': { department: 'sanitation', jurisdiction: 'ward-12' } }),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  await waitForServer();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test('citizen accounts, complaint ownership, authority scope, workflow, and protected notes', async () => {
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
  const citizenCookie = sessionCookie(citizenResponse);
  const citizenSession = await citizenResponse.json();
  assert.equal(citizenSession.user.role, 'citizen');

  const ownList = await request('/api/citizen/complaints', { cookie: citizenCookie });
  assert.equal(ownList.status, 200);
  assert.deepEqual(await ownList.json(), []);

  const complaintForm = new FormData();
  complaintForm.set('complaint', JSON.stringify({ category: 'Waste', description: 'Overflowing public bin', location: 'Main road', ward: 'Ward 12', latitude: 23.8, longitude: 91.2, severity: 'moderate', locationNotes: 'Near the junction' }));
  complaintForm.set('evidence', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jngAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'evidence.png');
  const complaintResponse = await request('/api/citizen/complaints', { method: 'POST', cookie: citizenCookie, body: complaintForm });
  assert.equal(complaintResponse.status, 201);
  const complaint = await complaintResponse.json();
  assert.match(complaint.id, /^CM-[A-F0-9]{32}$/);
  assert.equal(complaint.status, 'Submitted');
  assert.equal(complaint.severity, 'moderate');
  assert.equal(complaint.locationNotes, 'Near the junction');
  assert.equal(complaint.timeline.length, 1);
  assert.equal('internalNotes' in complaint, false);
  const ownEvidence = await request(`/api/citizen/complaints/${complaint.id}/evidence`, { cookie: citizenCookie });
  assert.equal(ownEvidence.status, 200);
  assert.match(ownEvidence.headers.get('content-type'), /image\/png/);

  const otherComplaintForm = new FormData();
  otherComplaintForm.set('complaint', JSON.stringify({ category: 'Waste', description: 'Unmapped location', location: 'Somewhere else', ward: 'Ward 13', severity: 'low' }));
  const unmappedResponse = await request('/api/citizen/complaints', { method: 'POST', cookie: citizenCookie, body: otherComplaintForm });
  assert.equal(unmappedResponse.status, 201);

  const citizenCannotListAuthority = await request('/api/authority/complaints', { cookie: citizenCookie });
  assert.equal(citizenCannotListAuthority.status, 403);
  const citizenCannotChangeStatus = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', cookie: citizenCookie, body: { status: 'Resolved', reason: 'done' },
  });
  assert.equal(citizenCannotChangeStatus.status, 403);

  const otherCitizenResponse = await request('/api/auth/register', {
    method: 'POST', body: { displayName: 'Citizen Two', email: 'other@example.test', password: 'correct horse battery staple 456!' },
  });
  const otherCookie = sessionCookie(otherCitizenResponse);
  const otherListResponse = await request('/api/citizen/complaints', { cookie: otherCookie });
  assert.deepEqual(await otherListResponse.json(), []);
  const otherEvidenceResponse = await request(`/api/citizen/complaints/${complaint.id}/evidence`, { cookie: otherCookie });
  assert.equal(otherEvidenceResponse.status, 404);

  const registrationCommand = await execFileAsync(process.execPath, [
    'server/provision-authority.js', 'staff@example.test', 'Authority Staff', 'sanitation', 'ward-12',
  ], { cwd: projectRoot, env: { ...process.env, CLEANMAP_DATA_DIR: tempDir } });
  const temporaryPassword = registrationCommand.stdout.match(/password .*: (\S+)/i)?.[1];
  assert.ok(temporaryPassword);

  const authorityLogin = await request('/api/auth/login', {
    method: 'POST', body: { email: 'staff@example.test', password: temporaryPassword, expectedRole: 'authority' },
  });
  assert.equal(authorityLogin.status, 200);
  const authorityCookie = sessionCookie(authorityLogin);
  assert.equal((await authorityLogin.json()).user.role, 'authority');

  const authorityQueue = await request('/api/authority/complaints', { cookie: authorityCookie });
  assert.equal(authorityQueue.status, 200);
  const permittedReports = await authorityQueue.json();
  assert.equal(permittedReports.length, 1);
  assert.equal(permittedReports[0].id, complaint.id);

  const outOfScopeProvision = await execFileAsync(process.execPath, [
    'server/provision-authority.js', 'other-staff@example.test', 'Other Authority', 'sanitation', 'ward-13',
  ], { cwd: projectRoot, env: { ...process.env, CLEANMAP_DATA_DIR: tempDir } });
  const otherPassword = outOfScopeProvision.stdout.match(/Initial password .*: (\S+)/i)?.[1];
  const otherAuthorityLogin = await request('/api/auth/login', {
    method: 'POST', body: { email: 'other-staff@example.test', password: otherPassword, expectedRole: 'authority' },
  });
  const otherAuthorityCookie = sessionCookie(otherAuthorityLogin);
  const outOfScopeEvidence = await request(`/api/authority/complaints/${complaint.id}/evidence`, { cookie: otherAuthorityCookie });
  assert.equal(outOfScopeEvidence.status, 404);

  const invalidTransition = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', cookie: authorityCookie, body: { status: 'Resolved', reason: 'done' },
  });
  assert.equal(invalidTransition.status, 409);

  const review = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', cookie: authorityCookie, body: { status: 'Under Review' },
  });
  assert.equal(review.status, 200);
  assert.equal((await review.json()).status, 'Under Review');

  const resolutionWithoutReason = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', cookie: authorityCookie, body: { status: 'In Progress' },
  });
  assert.equal(resolutionWithoutReason.status, 200);
  const resolution = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', cookie: authorityCookie, body: { status: 'Resolved' },
  });
  assert.equal(resolution.status, 400);
  const resolved = await request(`/api/authority/complaints/${complaint.id}/status`, {
    method: 'PATCH', cookie: authorityCookie, body: { status: 'Resolved', reason: 'Collected and verified.' },
  });
  assert.equal(resolved.status, 200);

  const note = await request(`/api/authority/complaints/${complaint.id}/notes`, {
    method: 'POST', cookie: authorityCookie, body: { note: 'Keep route clear for pickup.' },
  });
  assert.equal(note.status, 204);
  const authorityNotes = await request(`/api/authority/complaints/${complaint.id}/notes`, { cookie: authorityCookie });
  assert.equal((await authorityNotes.json())[0].note, 'Keep route clear for pickup.');
  const citizenNotes = await request(`/api/authority/complaints/${complaint.id}/notes`, { cookie: citizenCookie });
  assert.equal(citizenNotes.status, 403);

  const logout = await request('/api/auth/logout', { method: 'POST', cookie: citizenCookie });
  assert.equal(logout.status, 204);
  const staleCitizenSession = await request('/api/auth/session', { cookie: citizenCookie });
  assert.equal(staleCitizenSession.status, 401);
});
