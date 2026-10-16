import React, { useEffect, useState } from 'react';
import { Screen, ReportItem, SelectedLocation } from '../types';

interface TrackScreenProps {
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  reports: ReportItem[];
  activeReportId: string;
  onOpenInfoModal: (title: string, content: string) => void;
}

export const TrackScreen: React.FC<TrackScreenProps> = ({ reports, activeReportId, onNavigate }) => {
  const [searchInput, setSearchInput] = useState(activeReportId);
  const [currentId, setCurrentId] = useState(activeReportId);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setSearchInput(activeReportId);
    setCurrentId(activeReportId);
    setNotFound(false);
  }, [activeReportId]);

  const report = reports.find((item) => item.id.toUpperCase() === currentId.toUpperCase());

  const handleLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchInput.trim().toUpperCase();
    if (!query) return;
    const match = reports.find((item) => item.id.toUpperCase() === query);
    setNotFound(!match);
    if (match) setCurrentId(match.id);
  };

  return (
    <main className="min-h-[calc(100vh-12rem)] bg-surface px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Citizen portal</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-on-surface">Track your complaint</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Only complaints returned for your signed-in account can be opened. A reference number by itself does not grant access.</p>
          </div>
          <button className="min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-bold text-on-surface hover:bg-surface-container-low" onClick={() => onNavigate('citizen-dashboard', 'back')} type="button">Back to your complaints</button>
        </div>

        <form className="mb-5 flex flex-col gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:flex-row" onSubmit={handleLookup}>
          <label className="sr-only" htmlFor="citizen-report-reference">Complaint reference</label>
          <input autoComplete="off" className="min-h-12 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-3 font-mono text-sm uppercase text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" id="citizen-report-reference" onChange={(event) => setSearchInput(event.target.value)} placeholder="Enter your complaint reference" value={searchInput} />
          <button className="min-h-12 rounded-lg bg-primary px-5 font-bold text-on-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" type="submit">Find my complaint</button>
        </form>

        {notFound && <p aria-live="polite" className="mb-5 rounded-lg bg-error-container p-3 text-sm text-on-error-container">No complaint available for that reference in your account.</p>}
        {!report ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center sm:p-12">
            <span aria-hidden="true" className="material-symbols-outlined text-4xl text-outline">assignment</span>
            <h2 className="mt-3 text-lg font-bold text-on-surface">{reports.length ? 'Choose one of your complaints' : 'No complaints to track yet'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">Your complaint list is loaded from the account-scoped service. Other citizens’ reports and internal authority notes are not available here.</p>
            {reports.length === 0 && <button className="mt-5 min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary hover:bg-primary-container" onClick={() => onNavigate('report-a-problem')} type="button">Submit a complaint</button>}
          </div>
        ) : (
          <article className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
            <div className="border-b border-outline-variant/30 bg-surface-container-low p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm font-bold text-primary">{report.id}</p>
                  <h2 className="mt-1 text-xl font-bold text-on-surface">{report.category}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{report.location} · {report.ward}</p>
                </div>
                <span className="rounded-full bg-secondary-container px-3 py-1.5 text-sm font-bold text-on-secondary-container">{report.status}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-on-surface-variant">{report.siteAssessment}</p>
            </div>

            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_0.9fr]">
              <section>
                <h3 className="font-bold text-on-surface">Status history</h3>
                {report.timeline.length ? (
                  <ol className="mt-4 space-y-4 border-l-2 border-outline-variant pl-5">
                    {report.timeline.map((entry) => (
                      <li className="relative" key={entry.id}>
                        <span aria-hidden="true" className="absolute -left-[1.62rem] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                        <p className="font-semibold text-on-surface">{entry.title}</p>
                        <p className="mt-0.5 text-xs text-outline">{entry.date} · {entry.status}</p>
                        <p className="mt-1 text-sm leading-6 text-on-surface-variant">{entry.description}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm text-on-surface-variant">No status history has been provided.</p>}
              </section>

              <section>
                <h3 className="font-bold text-on-surface">Complaint details</h3>
                <dl className="mt-3 divide-y divide-outline-variant/30 rounded-xl border border-outline-variant/30">
                  <div className="p-3"><dt className="text-xs text-outline">Submitted</dt><dd className="mt-1 text-sm text-on-surface">{report.submittedAt}</dd></div>
                  <div className="p-3"><dt className="text-xs text-outline">Location</dt><dd className="mt-1 text-sm text-on-surface">{report.location}<br />{report.coordinates}</dd></div>
                  <div className="p-3"><dt className="text-xs text-outline">Category</dt><dd className="mt-1 text-sm text-on-surface">{report.category}</dd></div>
                </dl>
                {report.originalImage && <figure className="mt-4">
                  <img alt={`Evidence attached to complaint ${report.id}`} className="max-h-72 w-full rounded-xl border border-outline-variant/30 object-contain" crossOrigin="use-credentials" referrerPolicy="no-referrer" src={report.originalImage} />
                  <figcaption className="mt-1 text-xs text-outline">Private evidence supplied for this complaint.</figcaption>
                </figure>}
                <p className="mt-4 rounded-lg bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant">This view is limited to citizen-visible details supplied by the service. Authority-only notes and actions are not included.</p>
              </section>
            </div>
          </article>
        )}
      </div>
    </main>
  );
};
