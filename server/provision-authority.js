import 'dotenv/config';
import crypto from 'node:crypto';

const [emailArg, nameArg, departmentArg, jurisdictionArg] = process.argv.slice(2);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!emailArg || !nameArg || !departmentArg || !jurisdictionArg) {
  console.error('Usage: npm run provision-authority -- <email> <display-name> <department> <jurisdiction[,jurisdiction...]>');
  process.exit(2);
}
if (!supabaseUrl || !publishableKey || !secretKey) {
  console.error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY in the trusted server environment.');
  process.exit(2);
}

const email = emailArg.trim().toLowerCase();
const displayName = nameArg.trim();
const department = departmentArg.trim();
const jurisdictions = [...new Set(jurisdictionArg.split(',').map((item) => item.trim()).filter(Boolean))];
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || displayName.length > 100 || !department || jurisdictions.length === 0) {
  console.error('Email, display name (up to 100 characters), department, and at least one jurisdiction are required.');
  process.exit(2);
}

const map = JSON.parse(process.env.JURISDICTION_MAP_JSON || '{}');
const assigned = new Set(Object.values(map)
  .filter((entry) => entry && entry.department === department)
  .map((entry) => entry.jurisdiction));
if (jurisdictions.some((value) => !assigned.has(value))) {
  console.error('Every jurisdiction must match a server-controlled JURISDICTION_MAP_JSON entry for this department.');
  process.exit(2);
}

const baseUrl = supabaseUrl.replace(/\/$/, '');
const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };
async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.msg || body.message || `Supabase request failed (${response.status}).`);
  return body;
}

const temporaryPassword = `${crypto.randomBytes(24).toString('base64url')}aA1!`;
try {
  const authUser = await supabaseRequest('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: temporaryPassword, email_confirm: true, user_metadata: { display_name: displayName } }),
  });
  await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ role: 'authority', department, jurisdictions, display_name: displayName, updated_at: new Date().toISOString() }),
  });
  console.log(`Provisioned authority account ${email} for ${department}: ${jurisdictions.join(', ')}.`);
  console.log(`Initial password (share through a secure channel): ${temporaryPassword}`);
} catch (error) {
  console.error(`Authority provisioning failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
}

