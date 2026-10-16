import React from 'react';
import { Screen, SelectedLocation } from '../types';

interface FooterProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  onOpenInfoModal: (title: string, content: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenInfoModal }) => (
  <footer className="mt-auto border-t border-outline-variant/30 bg-surface-container-low">
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div>
        <p className="font-bold text-primary">CleanMap Tripura</p>
        <p className="mt-1">An independent concept prototype. Not affiliated with any government body.</p>
      </div>
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
        <button className="min-h-11 text-left underline-offset-4 hover:text-on-surface hover:underline" onClick={() => onNavigate('home', 'back')} type="button">Home</button>
        <button className="min-h-11 text-left underline-offset-4 hover:text-on-surface hover:underline" onClick={() => onOpenInfoModal('Privacy and data use', 'This concept preview does not accept public reports. Supabase-backed authentication and protected data services are retained for future use.')} type="button">Privacy status</button>
        <button className="min-h-11 text-left underline-offset-4 hover:text-on-surface hover:underline" onClick={() => onOpenInfoModal('Prototype status', 'CleanMap is an independent concept prototype. It does not submit official municipal complaints or guarantee a response.')} type="button">About this prototype</button>
      </nav>
    </div>
  </footer>
);

