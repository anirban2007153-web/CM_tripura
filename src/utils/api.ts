import { AuthSession, ReportItem, UserRole } from '../types';
import { isSupabaseConfigured, supabaseAuth } from './supabaseAuth';

const API_BASE_URL = import.meta.env.VITE_CLEANMAP_API_URL?.trim().replace(/\/$/, '') || '';

// In development, Vite proxies /api to the local Express service.
export const isApiConfigured = isSupabaseConfigured;
if (import.meta.env.PROD && API_BASE_URL && !API_BASE_URL.startsWith('https://')) {
  throw new Error('VITE_CLEANMAP_API_URL must use HTTPS in production.');
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function withEvidenceUrl(report: ReportItem): ReportItem {
  if (!report.originalImage || !API_BASE_URL) return report;
  return { ...report, originalImage: new URL(report.originalImage, API_BASE_URL).toString() };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new Error('Supabase Auth and the CleanMap API are not configured.');
  }

  const headers = new Headers(init.headers);
  const accessToken = await supabaseAuth.getAccessToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'omit',
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.message === 'string') message = body.message;
    } catch {
      // Keep the status-based message when the API returns no JSON body.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const cleanMapApi = {
  async signIn(email: string, password: string, expectedRole: UserRole) {
    await supabaseAuth.signIn(email, password);
    try {
      const session = await this.getSession();
      if (session.user.role !== expectedRole) throw new ApiError('This account does not have access to this portal.', 403);
      return session;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) await supabaseAuth.signOut();
      throw error;
    }
  },

  async registerCitizen(displayName: string, email: string, password: string) {
    const hasSession = await supabaseAuth.signUp(displayName, email, password);
    return hasSession ? this.getSession() : null;
  },

  getSession() {
    return request<AuthSession>('/api/auth/session');
  },

  signOut() {
    return supabaseAuth.signOut();
  },

  getCitizenComplaints() {
    return request<ReportItem[]>('/api/citizen/complaints').then((items) => items.map(withEvidenceUrl));
  },

  getAuthorityComplaints(query: URLSearchParams) {
    return request<ReportItem[]>(`/api/authority/complaints?${query.toString()}`).then((items) => items.map(withEvidenceUrl));
  },

  createComplaint(formData: FormData) {
    return request<ReportItem>('/api/citizen/complaints', {
      method: 'POST',
      body: formData,
    }).then(withEvidenceUrl);
  },

  addAuthorityNote(id: string, note: string) {
    return request<void>(`/api/authority/complaints/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  getAuthorityNotes(id: string) {
    return request<Array<{ id: string; note: string; author: string; createdAt: string }>>(
      `/api/authority/complaints/${encodeURIComponent(id)}/notes`
    );
  },

  updateComplaintStatus(id: string, status: string, reason: string) {
    return request<ReportItem>(`/api/authority/complaints/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }).then(withEvidenceUrl);
  },
};

