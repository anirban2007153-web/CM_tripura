import React, { useState } from 'react';
import { ApiError, cleanMapApi, isApiConfigured } from '../utils/api';
import { AuthSession, UserRole } from '../types';

interface LoginScreenProps {
  role: UserRole;
  onNavigate: (screen: 'citizen-login' | 'authority-login') => void;
  onAuthenticated: (session: AuthSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ role, onNavigate, onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const isAuthority = role === 'authority';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const session = creatingAccount
        ? await cleanMapApi.registerCitizen(displayName.trim(), email.trim(), password)
        : await cleanMapApi.signIn(email.trim(), password, role);
      if (session.user.role !== role) {
        await cleanMapApi.signOut();
        setError('This account is not authorized for this portal.');
        return;
      }
      onAuthenticated(session);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setError('Email or password was not accepted.');
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError('This account does not have access to this portal.');
      } else {
        setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-12rem)] bg-surface px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-xl lg:grid-cols-2">
        <section className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-primary p-7 text-on-primary sm:p-10 lg:min-h-[620px]">
          <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full border-[48px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-32 -left-28 h-96 w-96 rounded-full border-[56px] border-secondary-container/20" />
          <div className="relative flex items-center gap-3">
            <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-3xl">location_city</span>
            <div>
              <p className="font-bold tracking-tight">CleanMap Tripura</p>
              <p className="text-xs text-white/75">Agartala cleanliness evidence trail</p>
            </div>
          </div>
          <div className="relative max-w-md py-8">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <span className="material-symbols-outlined text-base">{isAuthority ? 'admin_panel_settings' : 'groups'}</span>
              {isAuthority ? 'Authority workspace' : 'Citizen portal'}
            </span>
            <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
              {isAuthority ? 'Review civic reports with care.' : 'Make local issues visible. Help move them forward.'}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-white/80">
              {isAuthority
                ? 'Sign in with an authority account provisioned through an approved administrative process.'
                : 'Sign in to submit a civic complaint and follow the status of your own reports.'}
            </p>
          </div>
          <p className="relative text-xs leading-5 text-white/65">Independent community prototype. Reports here are not official complaints to Agartala Municipal Corporation.</p>
        </section>

        <section className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-secondary">{isAuthority ? 'Authority access' : 'Citizen access'}</p>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">{isAuthority ? 'Authority sign in' : 'Citizen sign in'}</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">Your access is verified by the CleanMap service. This page does not grant or store roles in the browser.</p>
            </div>

            {!isApiConfigured && (
              <div className="mb-5 rounded-xl border border-tertiary/30 bg-tertiary-fixed/50 p-3 text-sm leading-5 text-on-tertiary-fixed-variant">
                Sign-in is unavailable because the trusted authentication service has not been configured. No demo account or local sign-in is provided.
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              {creatingAccount && <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">Full name</span>
                <input autoComplete="name" className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/15" disabled={!isApiConfigured || isSubmitting} maxLength={100} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
              </label>}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">Email address</span>
                <span className="flex items-center rounded-xl border border-outline-variant bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <span aria-hidden="true" className="material-symbols-outlined mr-2 text-xl text-outline">mail</span>
                  <input autoComplete="username" className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-outline" disabled={!isApiConfigured || isSubmitting} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-on-surface">Password</span>
                <span className="flex items-center rounded-xl border border-outline-variant bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <span aria-hidden="true" className="material-symbols-outlined mr-2 text-xl text-outline">lock</span>
                  <input autoComplete={creatingAccount ? 'new-password' : 'current-password'} className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-outline" disabled={!isApiConfigured || isSubmitting} minLength={creatingAccount ? 12 : undefined} onChange={(event) => setPassword(event.target.value)} placeholder={creatingAccount ? 'At least 12 characters' : 'Enter your password'} required type="password" value={password} />
                </span>
              </label>

              {error && <p aria-live="polite" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

              <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-on-primary shadow-sm transition hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={!isApiConfigured || isSubmitting} type="submit">
                {isSubmitting ? (creatingAccount ? 'Creating account…' : 'Verifying access…') : creatingAccount ? 'Create citizen account' : 'Sign in'}
                {!isSubmitting && <span aria-hidden="true" className="material-symbols-outlined text-lg">arrow_forward</span>}
              </button>
            </form>

            {!isAuthority && <button className="mt-3 min-h-11 w-full rounded-lg px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-primary" disabled={isSubmitting} onClick={() => { setCreatingAccount((value) => !value); setError(''); }} type="button">
              {creatingAccount ? 'Already have an account? Sign in' : 'Create a citizen account'}
            </button>}

            <div className="my-6 flex items-center gap-3 text-xs text-outline">
              <span className="h-px flex-1 bg-outline-variant/70" />
              <span>CHOOSE A PORTAL</span>
              <span className="h-px flex-1 bg-outline-variant/70" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button aria-current={!isAuthority ? 'page' : undefined} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${!isAuthority ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`} onClick={() => onNavigate('citizen-login')} type="button">Citizen portal</button>
              <button aria-current={isAuthority ? 'page' : undefined} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition ${isAuthority ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`} onClick={() => onNavigate('authority-login')} type="button">Authority portal</button>
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-outline">
              {isAuthority
                ? 'Authority accounts are provisioned by a trusted administrator. Public authority registration is disabled.'
                : creatingAccount ? 'Public account creation only creates citizen accounts. Authority access requires separate trusted provisioning.' : 'Citizen account registration is available through the trusted CleanMap service.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
