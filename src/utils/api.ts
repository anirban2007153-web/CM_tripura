import { AuthSession, ReportItem, UserRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_CLEANMAP_API_URL?.trim().replace(/\/$/, '') || '';

// In development, Vite proxies /api to the local Express service.
export const isApiConfigured = Boolean(API_BASE_URL) || import.meta.env.DEV;

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
  if (!API_BASE_URL) {
    throw new Error('CleanMap authentication and complaint services are not configured.');
  }

  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
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
  signIn(email: string, password: string, expectedRole: UserRole) {
    return request<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, expectedRole }),
    });
  },

  registerCitizen(displayName: string, email: string, password: string) {
    return request<AuthSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, password }),
    });
  },

  getSession() {
    return request<AuthSession>('/api/auth/session');
  },

  signOut() {
    return request<void>('/api/auth/logout', { method: 'POST' });
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
