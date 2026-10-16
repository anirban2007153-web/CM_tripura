import { UserRole } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const API_BASE_URL = import.meta.env.VITE_CLEANMAP_API_URL?.trim().replace(/\/$/, '') || '';
const STORAGE_KEY = 'cleanmap.supabase.session';

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: SupabaseUser;
}

export interface AuthSession {
  user: { id: string; displayName: string; role: UserRole };
}

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
if (import.meta.env.PROD && !SUPABASE_URL.startsWith('https://')) {
  throw new Error('VITE_SUPABASE_URL must use HTTPS in production.');
}

async function authGatewayRequest<T>(action: 'login' | 'register', body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/auth/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : 'Authentication request failed.');
  return result as T;
}

function readStoredSession(): SupabaseSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as SupabaseSession : null;
  } catch {
    return null;
  }
}

function storeSession(session: SupabaseSession | null) {
  if (typeof window === 'undefined') return;
  if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(STORAGE_KEY);
}

async function authRequest<T>(path: string, body?: unknown, accessToken?: string, method?: string): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Supabase Auth is not configured.');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.msg || result.message || result.error_description || result.error;
    throw new Error(typeof message === 'string' ? message : 'Supabase Auth request failed.');
  }
  return result as T;
}

async function currentSession(): Promise<SupabaseSession | null> {
  const session = readStoredSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 > Date.now() + 60_000) return session;
  try {
    const refreshed = await authRequest<SupabaseSession>('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    if (!refreshed.expires_at && refreshed.expires_in) refreshed.expires_at = Math.floor(Date.now() / 1000) + refreshed.expires_in;
    storeSession(refreshed);
    return refreshed;
  } catch {
    storeSession(null);
    return null;
  }
}

export const supabaseAuth = {
  async getAccessToken() {
    return (await currentSession())?.access_token || null;
  },

  async signIn(email: string, password: string) {
    const session = await authGatewayRequest<SupabaseSession>('login', { email, password });
    if (!session.expires_at && session.expires_in) session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
    storeSession(session);
  },

  async signUp(displayName: string, email: string, password: string) {
    const result = await authGatewayRequest<SupabaseSession & { session?: SupabaseSession | null }>('register', {
      email,
      password,
      data: { display_name: displayName },
    });
    const session = result.session || (result.access_token ? result : null);
    if (session) {
      if (!session.expires_at && session.expires_in) session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
      storeSession(session);
      return true;
    }
    return false;
  },

  async signOut() {
    const session = await currentSession();
    if (!session) { storeSession(null); return; }
    await authRequest('logout', undefined, session.access_token, 'DELETE').catch(() => undefined);
    storeSession(null);
  },

  clearSession() { storeSession(null); },
};

