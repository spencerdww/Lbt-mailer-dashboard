'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { TOKEN_KEY, isTokenValid, readPayload } from '../lib/session';

const NAV = [
  {
    href: '/dashboard',
    label: 'Records',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/import',
    label: 'Import',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/admins',
    label: 'Admins',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 19c1.2-3 3.4-4.5 7-4.5S17.8 16 19 19" strokeLinecap="round" />
      </svg>
    ),
  },
];

function isActive(pathname, href) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token || !isTokenValid(token)) {
      window.localStorage.removeItem(TOKEN_KEY);
      router.replace('/');
      return;
    }
    setUsername(readPayload(token)?.username || '');
    setReady(true);
  }, [router]);

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    router.replace('/');
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-mist text-sm font-medium text-navy">
        Checking session...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-mist text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-navy text-white md:flex">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal text-sm font-extrabold text-white">
              LB
            </div>
            <div>
              <p className="text-base font-extrabold leading-none">LifeBack Tax</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">Data desk</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? 'bg-teal text-white' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-xs text-slate-300">Signed in as</p>
          <p className="truncate text-sm font-semibold">{username}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-full border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-extrabold text-navy">LifeBack Tax</p>
            <button type="button" onClick={logout} className="text-sm font-semibold text-teal">
              Logout
            </button>
          </div>
          <nav className="flex gap-2 px-3 pb-3">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    active ? 'bg-navy text-white' : 'bg-mist text-navy'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
