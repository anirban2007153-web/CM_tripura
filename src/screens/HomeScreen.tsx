import React from 'react';
import { ReportItem, Screen, SelectedLocation } from '../types';

interface HomeScreenProps {
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  onOpenInfoModal: (title: string, content: string) => void;
  reports: ReportItem[];
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenInfoModal }) => (
  <main className="min-h-[calc(100vh-12rem)] bg-surface px-4 py-12 sm:px-6 sm:py-20">
    <div className="mx-auto max-w-5xl">
      <section className="rounded-3xl bg-primary px-6 py-12 text-on-primary sm:px-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">CleanMap Tripura · Concept preview</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">A clearer picture of cleanliness in our communities.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
          CleanMap is an idea for helping people document local cleanliness concerns, understand where they happen, and follow progress over time.
        </p>
        <button
          className="mt-8 min-h-12 rounded-xl border border-white/50 px-5 font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
          onClick={() => onOpenInfoModal('About CleanMap Tripura', 'CleanMap Tripura is an independent concept prototype. It is not affiliated with a government body, does not submit official municipal complaints, and does not guarantee a response.')}
          type="button"
        >
          About this idea
        </button>
      </section>

      <section aria-labelledby="how-it-could-work" className="mt-12 sm:mt-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">The idea</p>
        <h2 className="mt-2 text-2xl font-bold text-on-surface sm:text-3xl" id="how-it-could-work">A simple community feedback loop</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['edit_location_alt', 'Document', 'Describe a cleanliness concern and mark its location.'],
            ['map', 'See the area', 'Build a clearer picture of recurring issues across the community.'],
            ['timeline', 'Follow progress', 'Keep a record of updates so changes are easier to understand.'],
          ].map(([icon, title, detail], index) => (
            <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6" key={title}>
              <span aria-hidden="true" className="material-symbols-outlined text-2xl text-primary">{icon}</span>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-on-surface-variant">0{index + 1}</p>
              <h3 className="mt-1 font-bold text-on-surface">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-10 border-t border-outline-variant/30 pt-5 text-sm leading-6 text-on-surface-variant">
        This is a concept preview. Public reporting and account features are not available here. Supabase-backed authentication and protected data services remain connected for the application’s future use.
      </p>
    </div>
  </main>
);

