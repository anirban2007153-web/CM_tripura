import React from 'react';

interface CookieModalProps {
  isOpen: boolean;
  onClose: () => void;
  showBanner: boolean;
  onDismissBanner: () => void;
}

export const CookieModal: React.FC<CookieModalProps> = ({ isOpen, onClose, showBanner, onDismissBanner }) => (
  <>
    {showBanner && (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/30 bg-surface p-4 shadow-lg" role="region" aria-label="Service privacy information">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="max-w-4xl text-sm text-on-surface-variant">
            This service uses a backend session cookie when you sign in. Choosing a location may send its coordinates to OpenStreetMap Nominatim for address lookup. No optional analytics choice is implemented.
          </p>
          <div className="flex gap-2">
            <button className="min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-semibold text-on-surface" type="button" onClick={onClose}>Privacy information</button>
            <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary" type="button" onClick={onDismissBanner}>Dismiss</button>
          </div>
        </div>
      </div>
    )}
    {isOpen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-information-title">
        <section className="w-full max-w-xl rounded-xl bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-on-surface" id="privacy-information-title">Privacy information</h2>
            <button className="min-h-11 min-w-11 rounded-lg text-on-surface" onClick={onClose} type="button" aria-label="Close privacy information">×</button>
          </div>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">Sign-in uses an HTTP-only session cookie issued by the backend. Complaint data and optional evidence are sent to the configured CleanMap service. When you request an address lookup, the selected coordinates are sent to OpenStreetMap Nominatim. No analytics or cookie preference controls are implemented.</p>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">A complete privacy notice and retention policy have not been published. This prototype has not been legally reviewed or certified.</p>
          <div className="mt-5 flex justify-end"><button className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary" onClick={onClose} type="button">Close</button></div>
        </section>
      </div>
    )}
  </>
);
