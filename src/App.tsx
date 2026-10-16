/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Screen, ReportItem, TransitionDirection, SelectedLocation, AuthSession } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CookieModal } from './components/CookieModal';
import { InfoModal } from './components/InfoModal';
import { HomeScreen } from './screens/HomeScreen';
import { ReportScreen } from './screens/ReportScreen';
import { TrackScreen } from './screens/TrackScreen';
import { LoginScreen } from './screens/LoginScreen';
import { AccessDenied, AuthorityDashboard, CitizenDashboard } from './screens/PortalScreens';
import { cleanMapApi, isApiConfigured } from './utils/api';

function getScreenFromPath(pathname: string, hash: string): Screen {
  const cleanPath = pathname.toLowerCase();
  const cleanHash = hash.replace('#', '').toLowerCase();

  if (cleanPath.startsWith('/authority') || cleanHash.startsWith('authority-')) {
    return cleanPath.includes('dashboard') || cleanHash === 'authority-dashboard' ? 'authority-dashboard' : 'authority-login';
  }
  if (cleanPath.startsWith('/citizen') || cleanHash.startsWith('citizen-')) {
    return cleanPath.includes('dashboard') || cleanHash === 'citizen-dashboard' ? 'citizen-dashboard' : 'citizen-login';
  }

  if (cleanPath.includes('report-a-problem') || cleanHash === 'report-a-problem') {
    return 'report-a-problem';
  }
  if (cleanPath.includes('track-a-report') || cleanHash === 'track-a-report') {
    return 'track-a-report';
  }
  if (cleanPath === '/home' || cleanHash === 'home') {
    return 'home';
  }
  return 'citizen-login';
}

function getPathForScreen(screen: Screen): string {
  switch (screen) {
    case 'login':
    case 'citizen-login':
      return '/citizen/login';
    case 'authority-login':
      return '/authority/login';
    case 'citizen-dashboard':
      return '/citizen/dashboard';
    case 'authority-dashboard':
      return '/authority/dashboard';
    case 'access-denied':
      return '/access-denied';
    case 'report-a-problem':
      return '/report-a-problem';
    case 'track-a-report':
      return '/track-a-report';
    case 'home':
      return '/home';
    default:
      return '/citizen/login';
  }
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    return getScreenFromPath(window.location.pathname, window.location.hash);
  });
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('forward');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated' | 'unavailable'>('loading');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [authorityFilters, setAuthorityFilters] = useState<URLSearchParams>(new URLSearchParams());
  const [activeReportId, setActiveReportId] = useState<string>(() =>
    new URLSearchParams(window.location.search).get('ref') || ''
  );
  const [prefilledLocation, setPrefilledLocation] = useState<SelectedLocation | null>(null);

  // Modals
  const [cookieModalOpen, setCookieModalOpen] = useState<boolean>(false);
  const [showCookieBanner, setShowCookieBanner] = useState<boolean>(true);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);

  // Sync with browser back / forward navigation
  useEffect(() => {
    const syncLocation = () => {
      const targetScreen = getScreenFromPath(window.location.pathname, window.location.hash);
      const urlParams = new URLSearchParams(window.location.search);
      const refFromUrl = urlParams.get('ref');
      setActiveReportId(refFromUrl || '');
      setTransitionDirection('back');
      setCurrentScreen(targetScreen);
    };

    window.addEventListener('popstate', syncLocation);
    window.addEventListener('hashchange', syncLocation);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('hashchange', syncLocation);
    };
  }, []);

  const navigateTo = useCallback(
    (
      screen: Screen,
      direction: TransitionDirection = 'forward',
      reportId?: string,
      location?: SelectedLocation
    ) => {
      setTransitionDirection(direction);
      if (reportId) {
        setActiveReportId(reportId);
      }
      if (location) {
        setPrefilledLocation(location);
      }

      const targetPath = getPathForScreen(screen);
      const trackedReportId = reportId || (screen === 'track-a-report' ? activeReportId : undefined);
      const searchParam = trackedReportId ? `?ref=${encodeURIComponent(trackedReportId)}` : '';
      const fullUrl = `${targetPath}${searchParam}`;

      // Update browser history
      try {
        window.history.pushState({ screen, reportId: trackedReportId }, '', fullUrl);
      } catch {
        // Fallback for sandboxed iframes
        window.location.hash = screen;
      }

      setCurrentScreen(screen);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [activeReportId]
  );

  // Restore only a trusted server session; browser state never determines a user's role.
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      if (!isApiConfigured) {
        setAuthStatus('unavailable');
        return;
      }
      try {
        const restored = await cleanMapApi.getSession();
        if (isMounted) {
          setSession(restored);
          setAuthStatus('authenticated');
        }
      } catch (err) {
        if (!isMounted) return;
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
          setAuthStatus('unauthenticated');
        } else {
          setAuthStatus('unavailable');
        }
      }
    }
    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // The backend applies citizen ownership and authority jurisdiction filters.
  useEffect(() => {
    if (!session) {
      setReports([]);
      return;
    }
    let isMounted = true;
    setReportsLoading(true);
    setReportsError(null);
    const load = session.user.role === 'citizen'
      ? cleanMapApi.getCitizenComplaints()
      : cleanMapApi.getAuthorityComplaints(authorityFilters);
    load.then((items) => {
      if (isMounted) setReports(items);
    }).catch((error) => {
      if (!isMounted) return;
      setReports([]);
      setReportsError(error instanceof Error ? error.message : 'Could not load complaints.');
      if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 401) {
        setSession(null);
        setAuthStatus('unauthenticated');
      }
    }).finally(() => {
      if (isMounted) setReportsLoading(false);
    });
    return () => { isMounted = false; };
  }, [session, authorityFilters]);

  const handleAddReport = useCallback(
    async (newReport: ReportItem, imageFile?: File | Blob | null) => {
      const formData = new FormData();
      formData.append('complaint', JSON.stringify({
        category: newReport.category,
        description: newReport.siteAssessment,
        location: newReport.location,
        ward: newReport.ward,
        latitude: newReport.lat,
        longitude: newReport.lng,
        severity: newReport.severity,
        locationNotes: newReport.locationNotes,
      }));
      if (imageFile) formData.append('evidence', imageFile, 'evidence-upload');
      const created = await cleanMapApi.createComplaint(formData);
      setReports((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setActiveReportId(created.id);
      return created;
    },
    []
  );

  const completeSignIn = useCallback((newSession: AuthSession) => {
    setSession(newSession);
    setReports([]);
    setAuthStatus('authenticated');
    const target: Screen = newSession.user.role === 'authority' ? 'authority-dashboard' : 'citizen-dashboard';
    setCurrentScreen(target);
    window.history.replaceState({ screen: target }, '', getPathForScreen(target));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await cleanMapApi.signOut();
      setSignOutError(null);
      setSession(null);
      setReports([]);
      setAuthStatus('unauthenticated');
      navigateTo('citizen-login', 'back');
    } catch (error) {
      setSignOutError(error instanceof Error ? `Sign-out could not be confirmed: ${error.message}` : 'Sign-out could not be confirmed. Please try again.');
    }
  }, [navigateTo]);

  const openInfoModal = useCallback((title: string, content: string) => {
    setInfoModal({ title, content });
  }, []);

  const citizenOnly = ['citizen-dashboard', 'home', 'report-a-problem', 'track-a-report'].includes(currentScreen);
  const authorityOnly = currentScreen === 'authority-dashboard';
  const needsSession = citizenOnly || authorityOnly;
  const roleMismatch = Boolean(session && ((citizenOnly && session.user.role !== 'citizen') || (authorityOnly && session.user.role !== 'authority')));

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-body-md text-body-md overflow-x-hidden selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={navigateTo}
        onOpenCookieModal={() => setCookieModalOpen(true)}
        onOpenInfoModal={openInfoModal}
      />

      {/* Screen Container with directional push/push_back animation class */}
      <div
        key={currentScreen}
        className={`flex-1 w-full transition-all duration-300 ${
          transitionDirection === 'forward'
            ? 'animate-in fade-in slide-in-from-right-4'
            : 'animate-in fade-in slide-in-from-left-4'
        }`}
      >
        {currentScreen === 'login' && <LoginScreen role="citizen" onNavigate={navigateTo} onAuthenticated={completeSignIn} />}
        {(currentScreen === 'citizen-login' || currentScreen === 'authority-login') && (
          <LoginScreen role={currentScreen === 'authority-login' ? 'authority' : 'citizen'} onNavigate={navigateTo} onAuthenticated={completeSignIn} />
        )}

        {needsSession && authStatus === 'loading' && (
          <main className="flex min-h-[55vh] items-center justify-center bg-surface px-4" aria-live="polite">Checking your secure session…</main>
        )}
        {needsSession && authStatus !== 'loading' && (!session || roleMismatch) && (
          <AccessDenied
            message={roleMismatch ? 'Your account does not have permission to open this portal.' : authStatus === 'unavailable' ? 'The trusted authentication service is not configured or is unavailable. Protected complaint data remains closed.' : 'Please sign in to continue.'}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'citizen-dashboard' && session?.user.role === 'citizen' && (
          <CitizenDashboard user={session.user} reports={reports} loading={reportsLoading} loadError={reportsError} onNavigate={navigateTo} onSignOut={signOut} signOutError={signOutError} />
        )}
        {currentScreen === 'authority-dashboard' && session?.user.role === 'authority' && (
          <AuthorityDashboard
            user={session.user}
            reports={reports}
            loading={reportsLoading}
            loadError={reportsError}
            onNavigate={navigateTo}
            onSignOut={signOut}
            signOutError={signOutError}
            onFilterChange={setAuthorityFilters}
          />
        )}

        {currentScreen === 'home' && session?.user.role === 'citizen' && (
          <HomeScreen
            onNavigate={navigateTo}
            onOpenInfoModal={openInfoModal}
            reports={reports}
          />
        )}

        {currentScreen === 'report-a-problem' && session?.user.role === 'citizen' && (
          <ReportScreen
            onAddReport={handleAddReport}
            onNavigate={navigateTo}
            onOpenInfoModal={openInfoModal}
            prefilledLocation={prefilledLocation}
          />
        )}

        {currentScreen === 'track-a-report' && session?.user.role === 'citizen' && (
          <TrackScreen
            activeReportId={activeReportId}
            onNavigate={navigateTo}
            onOpenInfoModal={openInfoModal}
            reports={reports}
          />
        )}
      </div>

      {/* Footer */}
      <Footer
        currentScreen={currentScreen}
        onNavigate={navigateTo}
        onOpenInfoModal={openInfoModal}
      />

      {/* Cookie Banner & Preferences Modal */}
      <CookieModal
        isOpen={cookieModalOpen}
        onClose={() => setCookieModalOpen(false)}
        onDismissBanner={() => setShowCookieBanner(false)}
        showBanner={showCookieBanner}
      />

      {/* Auxiliary Information Modal */}
      <InfoModal
        content={infoModal?.content || null}
        onClose={() => setInfoModal(null)}
        title={infoModal?.title || null}
      />
    </div>
  );
}
