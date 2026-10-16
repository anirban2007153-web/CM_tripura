import React from 'react';
import { Screen, SelectedLocation } from '../types';

interface HeaderProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, direction?: 'forward' | 'back', reportId?: string, location?: SelectedLocation) => void;
  onOpenCookieModal: () => void;
  onOpenInfoModal: (title: string, content: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenCookieModal,
  onOpenInfoModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Top Disclaimer Strip - Responsive padding and stacking for smartphones */}
      <div className="w-full bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 sm:px-6 lg:px-8 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-label-sm font-label-sm gap-1">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="material-symbols-outlined text-sm sm:text-base flex-shrink-0">info</span>
          <span className="line-clamp-2 sm:line-clamp-none">
            <strong>INDEPENDENT CIVIC PROTOTYPE:</strong> CleanMap Tripura is not affiliated with Agartala Municipal Corporation or another government body.
          </span>
        </div>
        <a
          className="underline whitespace-nowrap hover:text-on-tertiary-fixed cursor-pointer self-start sm:self-auto py-0.5 sm:py-0 text-xs sm:text-label-sm font-semibold"
              data-path="prototype-limitations"
          href="#prototype-limitations"
          onClick={(e) => {
            e.preventDefault();
            onOpenInfoModal(
              'Prototype Limitations & Disclaimers',
              'CleanMap Tripura is an independent civic prototype and is not affiliated with Agartala Municipal Corporation. It does not file official complaints or dispatch municipal services.'
            );
          }}
        >
              About this prototype
        </a>
      </div>

      {/* Main Bar */}
      <div className="h-16 sm:h-20 w-full px-3 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-space-lg min-w-0">
          {/* Logo element: target for //header//a[@data-path='home'] */}
          <a
            className="flex items-center gap-2 cursor-pointer min-w-0"
            data-path="home"
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home', 'back');
            }}
          >
            <img
              alt="CleanMap Tripura Logo"
              className="h-7 sm:h-8 w-auto object-contain flex-shrink-0"
              src="https://lh3.googleusercontent.com/aida/AEtjO1X5i3Spf1W-tQBXkxkretcab9EYz4SkH9RetCRbvdiU1ryv4T6AQyiVui9cfQhTV7D6uZro9wgYCOSPZ_PBdvYSOqS5aayZPOYBLeE9ENi8d7VB1F_GFQjs7Ck8gITF_WiSwyDvTAmvvfqx0bpX6LIc9pGn9VWMICU2fwBXXiL4WLykatSpJu_6h1QcD4Hy9eLJIrSVznXqXdixFzjhLeiyOQk_VtbWd1rC9PCLHpKM3ML1KclhzGkHoxg"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-sm sm:text-headline-sm text-primary font-bold tracking-tight truncate">
                CleanMap Tripura
              </span>
              <span className="font-label-sm text-[10px] sm:text-label-sm text-on-surface-variant font-medium truncate hidden xs:block">
                Agartala Cleanliness Evidence Trail
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav
            className="hidden xl:flex items-center gap-space-xs ml-space-md"
            data-active-classes="bg-primary-container text-on-primary-container font-bold rounded-lg"
          >
            <a
              aria-current={currentScreen === 'home' ? 'page' : undefined}
              className={`px-3 py-2 transition-colors rounded-lg font-title-md text-title-md ${
                currentScreen === 'home'
                  ? 'bg-primary-container text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              data-path="home"
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('home', 'back');
              }}
            >
              Home
            </a>

            <a
              aria-current={currentScreen === 'report-a-problem' ? 'page' : undefined}
              className={`px-3 py-2 transition-colors rounded-lg font-title-md text-title-md ${
                currentScreen === 'report-a-problem'
                  ? 'bg-primary-container text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              data-path="report-a-problem"
              href="#report-a-problem"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('report-a-problem', 'forward');
              }}
            >
              Report a Problem
            </a>

            <a
              aria-current={currentScreen === 'track-a-report' ? 'page' : undefined}
              className={`px-3 py-2 transition-colors rounded-lg font-title-md text-title-md ${
                currentScreen === 'track-a-report'
                  ? 'bg-primary-container text-on-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              data-path="track-a-report"
              href="#track-a-report"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('track-a-report', 'forward');
              }}
            >
              Track a Report
            </a>

            <a
              className="px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-title-md text-title-md rounded-lg cursor-pointer"
              data-path="authority-login"
              href="/authority/login"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('authority-login');
              }}
            >
              Authority Portal
            </a>

            <a
              className="px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-title-md text-title-md rounded-lg cursor-pointer"
              data-path="about"
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                onOpenInfoModal(
                  'About CleanMap Tripura',
                  'CleanMap Tripura is an independent community prototype. It is not a government service, and it has not been certified as legally compliant.'
                );
              }}
            >
              About
            </a>
          </nav>
        </div>

        {/* Right utility items */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Privacy information */}
          <button
            className="hidden sm:flex px-2.5 py-1.5 bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface text-label-md font-label-md rounded-lg transition-colors items-center gap-1 cursor-pointer border border-outline-variant/20 min-h-[44px]"
            type="button"
            onClick={onOpenCookieModal}
          >
            <span className="material-symbols-outlined text-base">info</span>
            <span>Privacy information</span>
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <button className="min-h-10 rounded-lg border border-outline-variant px-3 text-xs font-bold text-on-surface hover:bg-surface-container-low" onClick={() => onNavigate('citizen-login')} type="button">Citizen login</button>
            <button className="min-h-10 rounded-lg bg-primary px-3 text-xs font-bold text-on-primary hover:bg-primary-container" onClick={() => onNavigate('authority-login')} type="button">Authority login</button>
          </div>

          {/* Mobile Menu Button - min 44x44px touch target */}
          <button
            className="xl:hidden w-11 h-11 flex items-center justify-center text-on-surface hover:bg-surface-container rounded-lg cursor-pointer"
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="material-symbols-outlined text-2xl">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-outline-variant/30 bg-surface px-4 py-3 flex flex-col gap-1.5 shadow-lg max-h-[calc(100vh-120px)] overflow-y-auto">
          <button
            className={`text-left px-3.5 py-2.5 rounded-lg font-title-md min-h-[44px] flex items-center gap-2 cursor-pointer ${
              currentScreen === 'home'
                ? 'bg-primary-container text-on-primary font-bold'
                : 'text-on-surface hover:bg-surface-container'
            }`}
            onClick={() => {
              onNavigate('home', 'back');
              setMobileMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined text-lg">home</span>
            <span>Home</span>
          </button>

          <button
            className={`text-left px-3.5 py-2.5 rounded-lg font-title-md min-h-[44px] flex items-center gap-2 cursor-pointer ${
              currentScreen === 'report-a-problem'
                ? 'bg-primary-container text-on-primary font-bold'
                : 'text-on-surface hover:bg-surface-container'
            }`}
            onClick={() => {
              onNavigate('report-a-problem', 'forward');
              setMobileMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined text-lg">add_location_alt</span>
            <span>Report a Problem</span>
          </button>

          <button
            className={`text-left px-3.5 py-2.5 rounded-lg font-title-md min-h-[44px] flex items-center gap-2 cursor-pointer ${
              currentScreen === 'track-a-report'
                ? 'bg-primary-container text-on-primary font-bold'
                : 'text-on-surface hover:bg-surface-container'
            }`}
            onClick={() => {
              onNavigate('track-a-report', 'forward');
              setMobileMenuOpen(false);
            }}
          >
            <span className="material-symbols-outlined text-lg">search_check</span>
            <span>Track a Report</span>
          </button>

          <button className="text-left px-3.5 py-2.5 rounded-lg font-title-md min-h-[44px] flex items-center gap-2 cursor-pointer text-on-surface hover:bg-surface-container" onClick={() => { onNavigate('citizen-login'); setMobileMenuOpen(false); }} type="button">
            <span className="material-symbols-outlined text-lg">person</span><span>Citizen Login</span>
          </button>
          <button className="text-left px-3.5 py-2.5 rounded-lg font-title-md min-h-[44px] flex items-center gap-2 cursor-pointer text-on-surface hover:bg-surface-container" onClick={() => { onNavigate('authority-login'); setMobileMenuOpen(false); }} type="button">
            <span className="material-symbols-outlined text-lg">admin_panel_settings</span><span>Authority Login</span>
          </button>

          <button
            className="text-left px-3.5 py-2.5 rounded-lg font-title-md min-h-[44px] flex items-center gap-2 cursor-pointer text-on-surface hover:bg-surface-container"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenInfoModal(
                'About CleanMap Tripura',
                'CleanMap Tripura is an independent community prototype. It is not a government service, and it has not been certified as legally compliant.'
              );
            }}
          >
            <span className="material-symbols-outlined text-lg">info</span>
            <span>About</span>
          </button>

          <div className="border-t border-outline-variant/30 my-1 pt-2 flex flex-col gap-2">
            <button
              className="text-left px-3.5 py-2.5 bg-surface-container-low hover:bg-surface-container rounded-lg font-title-md text-xs sm:text-title-md min-h-[44px] flex items-center gap-2 cursor-pointer text-on-surface"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCookieModal();
              }}
            >
              <span className="material-symbols-outlined text-base">info</span>
              <span>Privacy information</span>
            </button>

          </div>
        </div>
      )}
    </header>
  );
};
