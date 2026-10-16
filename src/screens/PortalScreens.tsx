import React, { useEffect, useState } from 'react';
import { AuthenticatedUser, ReportItem, Screen } from '../types';
import { cleanMapApi } from '../utils/api';

interface PortalProps {
  user: AuthenticatedUser;
  reports: ReportItem[];
  loading: boolean;
  loadError: string | null;
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string) => void;
  onSignOut: () => void;
  signOutError: string | null;
  onFilterChange?: (params: URLSearchParams) => void;
}

function PortalHeader({ user, onSignOut, signOutError, authority = false }: { user: AuthenticatedUser; onSignOut: () => void; signOutError: string | null; authority?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">{authority ? 'admin_panel_settings' : 'account_circle'}</span>
        <div className="min-w-0">
          <p className="truncate font-bold text-on-surface">{user.displayName || user.id}</p>
          <p className="text-xs text-on-surface-variant">{authority ? 'Authorized authority workspace' : 'Citizen account'}</p>
        </div>
      </div>
      {signOutError && <p aria-live="polite" className="w-full rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{signOutError}</p>}
      <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant px-4 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary" onClick={onSignOut} type="button">
        <span aria-hidden="true" className="material-symbols-outlined text-lg">logout</span> Sign out
      </button>
    </div>
  );
}

function ReportCard({ report, onTrack }: { report: ReportItem; onTrack: () => void }) {
  return (
    <article className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-bold text-primary">{report.id}</p>
          <h3 className="mt-1 font-bold text-on-surface">{report.category}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{report.location} · {report.ward}</p>
        </div>
        <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">{report.status}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-on-surface-variant">{report.siteAssessment}</p>
      {(report.severity || report.locationNotes) && <p className="mt-2 text-xs text-on-surface-variant">{report.severity && `Severity: ${report.severity}`}{report.severity && report.locationNotes ? ' · ' : ''}{report.locationNotes && `Location notes: ${report.locationNotes}`}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-3">
        <span className="text-xs text-outline">Submitted {report.submittedAt}</span>
        <button className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary" onClick={onTrack} type="button">View permitted details</button>
      </div>
    </article>
  );
}

export function CitizenDashboard(props: PortalProps) {
  const { user, reports, loading, loadError, onNavigate, onSignOut, signOutError } = props;
  return (
    <main className="min-h-[calc(100vh-12rem)] bg-surface px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <PortalHeader user={user} onSignOut={onSignOut} signOutError={signOutError} />
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Citizen portal</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface">Your complaints</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Only complaints associated with your account are shown here. Reference numbers do not grant access to private complaint details.</p>
          </div>
          <button className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-on-primary shadow-sm hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" onClick={() => onNavigate('report-a-problem')} type="button">
            <span aria-hidden="true" className="material-symbols-outlined">add</span> Submit a complaint
          </button>
        </div>
        {loading ? <p aria-live="polite" className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Loading your complaints…</p> : null}
        {loadError ? <p aria-live="polite" className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">{loadError}</p> : null}
        {!loading && !loadError && reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-4xl text-outline">assignment</span>
            <h2 className="mt-3 text-lg font-bold text-on-surface">No complaints yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">When you submit a complaint, its reference and status will appear here.</p>
            <button className="mt-5 min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary hover:bg-primary-container" onClick={() => onNavigate('report-a-problem')} type="button">Start a complaint</button>
          </div>
        ) : null}
        {!loading && !loadError && reports.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {reports.map((report) => <ReportCard key={report.id} report={report} onTrack={() => onNavigate('track-a-report', 'forward', report.id)} />)}
          </div>
        ) : null}
      </div>
    </main>
  );
}

const STATUS_OPTIONS = ['Submitted', 'Under Review', 'In Progress', 'Needs Information', 'Resolved', 'Rejected'] as const;

function allowedNextStatuses(status: string): string[] {
  switch (status) {
    case 'Submitted': return ['Under Review', 'Rejected'];
    case 'Under Review': return ['In Progress', 'Needs Information', 'Rejected'];
    case 'In Progress': return ['Resolved', 'Needs Information'];
    case 'Needs Information': return ['Under Review', 'In Progress', 'Rejected'];
    default: return [];
  }
}

export function AuthorityDashboard(props: PortalProps) {
  const { user, reports, loading, loadError, onSignOut, signOutError, onFilterChange } = props;
  const [filters, setFilters] = useState({ status: '', category: '', location: '', from: '', to: '' });
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [internalNotes, setInternalNotes] = useState<Record<string, Array<{ id: string; note: string; author: string; createdAt: string }>>>({});
  const [notesLoading, setNotesLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiveReportId(null);
  }, [reports]);

  useEffect(() => {
    if (!activeReportId) return;
    let isMounted = true;
    setNotesLoading(true);
    cleanMapApi.getAuthorityNotes(activeReportId).then((items) => {
      if (isMounted) setInternalNotes((existing) => ({ ...existing, [activeReportId]: items }));
    }).catch((error) => {
      if (isMounted) setActionError(error instanceof Error ? error.message : 'Internal notes could not be loaded.');
    }).finally(() => {
      if (isMounted) setNotesLoading(false);
    });
    return () => { isMounted = false; };
  }, [activeReportId]);

  const submitStatus = async (report: ReportItem) => {
    if (!nextStatus || saving) return;
    if ((nextStatus === 'Rejected' || nextStatus === 'Needs Information' || nextStatus === 'Resolved') && reason.trim().length < 5) {
      setActionError('Provide a clear reason before rejecting, requesting information, or resolving a complaint.');
      return;
    }
    setSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await cleanMapApi.updateComplaintStatus(report.id, nextStatus, reason.trim());
      setActionMessage('Status update recorded by the service.');
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      onFilterChange?.(params);
      setNextStatus('');
      setReason('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Status update failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async (report: ReportItem) => {
    if (note.trim().length < 2 || saving) return;
    setSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await cleanMapApi.addAuthorityNote(report.id, note.trim());
      const updatedNotes = await cleanMapApi.getAuthorityNotes(report.id);
      setInternalNotes((existing) => ({ ...existing, [report.id]: updatedNotes }));
      setNote('');
      setActionMessage('Internal note saved. It is available only through the authority service.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Internal note could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-12rem)] bg-surface px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <PortalHeader user={user} onSignOut={onSignOut} signOutError={signOutError} authority />
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Authority portal</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface">Complaint review queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">Queue results and every action are authorized by the trusted service for your assigned department and jurisdiction. Status changes are audited by the backend.</p>
        </div>

        <form className="mb-5 grid gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => { event.preventDefault(); const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); }); onFilterChange?.(params); }}>
          <label className="text-xs font-semibold text-on-surface-variant">Status<select className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface" onChange={(event) => setFilters({ ...filters, status: event.target.value })} value={filters.status}><option value="">All permitted</option>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="text-xs font-semibold text-on-surface-variant">Category<input className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface" onChange={(event) => setFilters({ ...filters, category: event.target.value })} placeholder="Any category" value={filters.category} /></label>
          <label className="text-xs font-semibold text-on-surface-variant">Location<input className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface" onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="Ward or area" value={filters.location} /></label>
          <label className="text-xs font-semibold text-on-surface-variant">From<input className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface" onChange={(event) => setFilters({ ...filters, from: event.target.value })} type="date" value={filters.from} /></label>
          <label className="text-xs font-semibold text-on-surface-variant">To<input className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface" onChange={(event) => setFilters({ ...filters, to: event.target.value })} type="date" value={filters.to} /></label>
          <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary sm:col-span-2 lg:col-span-5" type="submit">Apply authorized queue filters</button>
        </form>

        {actionError && <p aria-live="polite" className="mb-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{actionError}</p>}
        {actionMessage && <p aria-live="polite" className="mb-4 rounded-lg bg-secondary-container p-3 text-sm text-on-secondary-container">{actionMessage}</p>}
        {loading && <p aria-live="polite" className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Loading authorized complaints…</p>}
        {loadError && <p aria-live="polite" className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">{loadError}</p>}
        {!loading && !loadError && reports.length === 0 && <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">No complaints are available for your assigned permissions and filters.</div>}

        <div className="space-y-4">
          {reports.map((report) => {
            const expanded = activeReportId === report.id;
            const allowed = allowedNextStatuses(report.status);
            return (
              <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm sm:p-5" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-sm font-bold text-primary">{report.id}</p>
                    <h2 className="mt-1 font-bold text-on-surface">{report.category} · {report.ward}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{report.location} · {report.submittedAt}</p>
                  </div>
                  <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">{report.status}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">{report.siteAssessment}</p>
                {(report.severity || report.locationNotes) && <p className="mt-2 text-sm text-on-surface-variant">{report.severity && `Severity: ${report.severity}`}{report.severity && report.locationNotes ? ' · ' : ''}{report.locationNotes && `Location notes: ${report.locationNotes}`}</p>}
                {report.originalImage && <img alt={`Evidence for complaint ${report.id}`} className="mt-4 max-h-64 rounded-xl object-contain" crossOrigin="use-credentials" src={report.originalImage} />}
                <div className="mt-4 flex flex-wrap gap-3 border-t border-outline-variant/30 pt-3">
                  <button aria-expanded={expanded} className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary" onClick={() => { setActiveReportId(expanded ? null : report.id); setActionError(''); setActionMessage(''); }} type="button">{expanded ? 'Hide review controls' : 'Review and update'}</button>
                </div>
                {expanded && <div className="mt-4 grid gap-5 border-t border-outline-variant/30 pt-4 lg:grid-cols-2">
                  <section className="lg:col-span-2" aria-labelledby={`history-heading-${report.id}`}>
                    <h3 className="font-bold text-on-surface" id={`history-heading-${report.id}`}>Status and audit history</h3>
                    {report.timeline.length ? <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                      {report.timeline.map((entry) => <li className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3" key={entry.id}>
                        <p className="font-semibold text-on-surface">{entry.title} · {entry.status}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{entry.date}{entry.reviewerName ? ` · ${entry.reviewerName}` : ''}</p>
                        <p className="mt-1 text-sm leading-5 text-on-surface-variant">{entry.description}</p>
                      </li>)}
                    </ol> : <p className="mt-2 text-sm text-on-surface-variant">No history returned for this complaint.</p>}
                  </section>
                  <section aria-labelledby={`status-heading-${report.id}`}>
                    <h3 className="font-bold text-on-surface" id={`status-heading-${report.id}`}>Update status</h3>
                    {allowed.length === 0 ? <p className="mt-2 text-sm text-on-surface-variant">This complaint is in a terminal state. The service will enforce whether any further action is permitted.</p> : <>
                      <label className="mt-3 block text-sm font-medium text-on-surface-variant">Next valid status<select className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface" onChange={(event) => setNextStatus(event.target.value)} value={nextStatus}><option value="">Choose a status</option>{allowed.map((status) => <option key={status}>{status}</option>)}</select></label>
                      {(nextStatus === 'Rejected' || nextStatus === 'Needs Information' || nextStatus === 'Resolved') && <label className="mt-3 block text-sm font-medium text-on-surface-variant">Reason (required)<textarea className="mt-1 min-h-20 w-full rounded-lg border border-outline-variant bg-surface p-3 text-sm text-on-surface" onChange={(event) => setReason(event.target.value)} value={reason} /> </label>}
                      <button className="mt-3 min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary hover:bg-primary-container disabled:opacity-50" disabled={!nextStatus || saving} onClick={() => submitStatus(report)} type="button">{saving ? 'Saving…' : 'Record status change'}</button>
                    </>}
                  </section>
                  <section aria-labelledby={`note-heading-${report.id}`}>
                    <h3 className="font-bold text-on-surface" id={`note-heading-${report.id}`}>Internal authority note</h3>
                    <p className="mt-1 text-xs leading-5 text-on-surface-variant">This note is sent to a restricted endpoint and must never be returned to citizen responses.</p>
                    {notesLoading && activeReportId === report.id && <p aria-live="polite" className="mt-2 text-sm text-on-surface-variant">Loading restricted notes…</p>}
                    {internalNotes[report.id]?.length ? <ol className="mt-3 space-y-2">{internalNotes[report.id].map((entry) => <li className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-3" key={entry.id}><p className="whitespace-pre-wrap text-sm leading-5 text-on-surface">{entry.note}</p><p className="mt-1 text-xs text-outline">{entry.author} · {entry.createdAt}</p></li>)}</ol> : !notesLoading && <p className="mt-2 text-sm text-on-surface-variant">No internal notes recorded.</p>}
                    <label className="sr-only" htmlFor={`note-${report.id}`}>Internal note</label>
                    <textarea className="mt-3 min-h-24 w-full rounded-lg border border-outline-variant bg-surface p-3 text-sm text-on-surface" id={`note-${report.id}`} onChange={(event) => setNote(event.target.value)} placeholder="Write an internal review note" value={note} />
                    <button className="mt-2 min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-50" disabled={note.trim().length < 2 || saving} onClick={() => submitNote(report)} type="button">{saving ? 'Saving…' : 'Save internal note'}</button>
                  </section>
                </div>}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export function AccessDenied({ message, onNavigate }: { message: string; onNavigate: (screen: Screen) => void }) {
  return (
    <main className="flex min-h-[55vh] items-center justify-center bg-surface px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-7 text-center shadow-sm sm:p-10" role="alert">
        <span aria-hidden="true" className="material-symbols-outlined text-4xl text-error">lock</span>
        <h1 className="mt-3 text-2xl font-bold text-on-surface">Access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{message}</p>
        <div className="mt-6 flex justify-center">
          <button className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary hover:bg-primary-container" onClick={() => onNavigate('home')} type="button">Return to home</button>
        </div>
      </section>
    </main>
  );
}

