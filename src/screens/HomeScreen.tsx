import React from 'react';
import { ReportItem, Screen, SelectedLocation } from '../types';

interface HomeScreenProps {
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  onOpenInfoModal: (title: string, content: string) => void;
  reports: ReportItem[];
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onOpenInfoModal, reports }) => (
  <main className="min-h-[calc(100vh-12rem)] bg-surface px-4 py-8 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <section className="overflow-hidden rounded-3xl bg-primary p-6 text-on-primary sm:p-10 lg:p-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">CleanMap Tripura · Citizen portal</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">A clear way to report local cleanliness issues.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 sm:text-base">Submit a complaint, choose a location, and follow its status from your account. Reports are not official complaints to Agartala Municipal Corporation.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="min-h-12 rounded-xl bg-white px-5 font-bold text-primary transition hover:bg-secondary-container focus:outline-none focus:ring-2 focus:ring-white" onClick={() => onNavigate('report-a-problem')} type="button">Submit a complaint</button>
              <button className="min-h-12 rounded-xl border border-white/40 px-5 font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white" onClick={() => onOpenInfoModal('About CleanMap', 'CleanMap is an independent civic complaint prototype. It is not affiliated with a government body and has not been certified as legally compliant.')} type="button">About this service</button>
            </div>
          </div>
          <div aria-hidden="true" className="hidden h-44 w-44 items-center justify-center rounded-full border border-white/20 bg-white/10 lg:flex">
            <span className="material-symbols-outlined text-8xl text-white/90">location_city</span>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Your account</p>
            <h2 className="mt-1 text-2xl font-bold text-on-surface">Your recent complaints</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Only account-scoped records returned by the service appear here.</p>
          </div>
          <button className="min-h-10 rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary/5" onClick={() => onNavigate('citizen-dashboard')} type="button">View all</button>
        </div>
        {reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
            <span aria-hidden="true" className="material-symbols-outlined text-4xl text-outline">assignment</span>
            <h3 className="mt-2 font-bold text-on-surface">No complaints to show</h3>
            <p className="mt-1 text-sm text-on-surface-variant">When you submit a complaint, its status will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {reports.slice(0, 4).map((report) => (
              <article className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm" key={report.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs font-bold text-primary">{report.id}</p>
                    <h3 className="mt-1 font-bold text-on-surface">{report.category}</h3>
                    <p className="mt-1 truncate text-sm text-on-surface-variant">{report.location}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary-container px-2.5 py-1 text-xs font-bold text-on-secondary-container">{report.status}</span>
                </div>
                <button className="mt-3 min-h-10 rounded-lg px-2 text-sm font-bold text-primary hover:bg-primary/5" onClick={() => onNavigate('track-a-report', 'forward', report.id)} type="button">View status</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['edit_location_alt', 'Describe the issue', 'Choose a category and add a short description.'],
          ['map', 'Set the location', 'Use the map pin or enter the location manually.'],
          ['timeline', 'Follow your report', 'Review the latest citizen-visible status from your account.'],
        ].map(([icon, title, detail]) => (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5" key={title}>
            <span aria-hidden="true" className="material-symbols-outlined text-2xl text-primary">{icon}</span>
            <h3 className="mt-2 font-bold text-on-surface">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">{detail}</p>
          </div>
        ))}
      </section>
    </div>
  </main>
);
