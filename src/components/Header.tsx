import React from 'react';
import { Screen, SelectedLocation } from '../types';

interface HeaderProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  onOpenCookieModal: () => void;
  onOpenInfoModal: (title: string, content: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentScreen, onNavigate, onOpenCookieModal, onOpenInfoModal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const openAbout = () => onOpenInfoModal(
    'About CleanMap Tripura',
    'CleanMap Tripura is an independent concept prototype. It is not affiliated with a government body and does not submit official municipal complaints.'
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:min-h-20 sm:px-6 lg:px-8">
        <a
          aria-label="CleanMap Tripura home"
          className="flex min-w-0 items-center gap-2"
          href="/"
          onClick={(event) => { event.preventDefault(); onNavigate('home', 'back'); }}
        >
          <span aria-hidden="true" className="material-symbols-outlined flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">location_city</span>
          <span className="truncate text-base font-bold tracking-tight text-primary sm:text-lg">CleanMap Tripura</span>
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-2 sm:flex">
          <button
            aria-current={currentScreen === 'home' ? 'page' : undefined}
            className="min-h-11 rounded-lg px-4 font-semibold text-on-surface hover:bg-surface-container"
            onClick={() => onNavigate('home', 'back')}
            type="button"
          >Home</button>
          <button className="min-h-11 rounded-lg px-4 font-semibold text-on-surface hover:bg-surface-container" onClick={openAbout} type="button">About</button>
          <button className="min-h-11 rounded-lg px-4 font-semibold text-on-surface hover:bg-surface-container" onClick={onOpenCookieModal} type="button">Privacy</button>
        </nav>

        <button
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container sm:hidden"
          onClick={() => setMobileMenuOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true" className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {mobileMenuOpen && (
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1 border-t border-outline-variant/30 bg-surface px-4 py-3 sm:hidden">
          <button className="min-h-11 rounded-lg px-3 text-left font-semibold text-on-surface hover:bg-surface-container" onClick={() => { onNavigate('home', 'back'); setMobileMenuOpen(false); }} type="button">Home</button>
          <button className="min-h-11 rounded-lg px-3 text-left font-semibold text-on-surface hover:bg-surface-container" onClick={() => { openAbout(); setMobileMenuOpen(false); }} type="button">About</button>
          <button className="min-h-11 rounded-lg px-3 text-left font-semibold text-on-surface hover:bg-surface-container" onClick={() => { onOpenCookieModal(); setMobileMenuOpen(false); }} type="button">Privacy information</button>
        </nav>
      )}
    </header>
  );
};

