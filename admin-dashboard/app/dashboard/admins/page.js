'use client';

import { useState } from 'react';
import { api } from '../../lib/session';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-ink outline-none ring-teal placeholder:text-slate-400 focus:ring-2';

export default function AdminsPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Unable to create the admin account');
        return;
      }
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setNotice(`Admin account created for ${data.username}. They can sign in with that username.`);
    } catch (_err) {
      setError('Cannot reach the API. Confirm the backend is running on port 5000.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Admins</p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">Create admin account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Add another person who can sign in to this dashboard. This form is only available after login.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-navy">
          Username
          <input
            className={fieldClass}
            autoComplete="off"
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
              autoComplete="new-password"
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
          className="w-full rounded-full bg-teal px-4 py-3 font-bold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Please wait...' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
