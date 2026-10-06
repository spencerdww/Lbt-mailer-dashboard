'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, TOKEN_KEY, isTokenValid } from './lib/session';

function BrandMark({ light = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-extrabold ${light ? 'bg-white text-navy' : 'bg-navy text-white'}`}>
        LB
      </div>
      <div>
        <p className={`text-lg font-extrabold leading-none tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
          LifeBack Tax
        </p>
        <p className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${light ? 'text-teal' : 'text-teal'}`}>
          Tax Relief
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token && isTokenValid(token)) router.replace('/dashboard');
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/auth/setup`)
      .then((response) => response.json())
      .then((data) => {
        if (active) setNeedsSetup(Boolean(data.needsSetup));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (needsSetup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      if (needsSetup) {
        const created = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        const createdBody = await created.json().catch(() => ({}));
        if (!created.ok) {
          setError(createdBody.message || 'Unable to create the first admin');
          return;
        }
        setNeedsSetup(false);
        setPassword('');
        setConfirmPassword('');
        setNotice('First admin created. Sign in to continue.');
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || 'Request failed');
        return;
      }

      if (!data.token) {
        setError('Login did not return a token');
        return;
      }

      window.localStorage.setItem(TOKEN_KEY, data.token);
      router.push('/dashboard');
    } catch (_err) {
      setError('Cannot reach the API. Confirm the backend is running on port 5000.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-ink outline-none ring-teal placeholder:text-slate-400 focus:ring-2';

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy px-12 py-12 text-white lg:flex">
        <BrandMark light />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal">Mailer records</p>
          <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight">
            Are you ready to manage every form lead in one place?
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-200">
            Import the LifeBack Tax mailer export, search client records, and keep a history of every file the data team uploads.
          </p>
        </div>
        <p className="text-sm text-slate-300">21622 Plummer St., Suite 201, Chatsworth, CA</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <h2 className="mt-8 text-3xl font-extrabold tracking-tight text-ink lg:mt-0">
            {needsSetup ? 'Create the first admin' : 'Sign in'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {needsSetup
              ? 'This database has no admin yet. Create one, then sign in. Later admins are added from the dashboard.'
              : 'Private access for the LifeBack Tax data team.'}
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-semibold text-navy">
              Username
              <input
                className={fieldClass}
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>

            <label className="block text-sm font-semibold text-navy">
              Password
              <span className="relative mt-1.5 block">
                <input
                  className={`${fieldClass} mt-0 pr-16`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={needsSetup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 text-xs font-semibold text-teal"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            {needsSetup && (
              <label className="block text-sm font-semibold text-navy">
                Confirm password
                <input
                  className={fieldClass}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </label>
            )}

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            {notice && (
              <p className="rounded-xl border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-navy" role="status">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-teal px-4 py-3 font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Please wait...' : needsSetup ? 'Create admin' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
