'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/session';

const FORM_BASE = 'https://www.lifebacktax.com/form?code=';

function displayName(record) {
  const parts = [];
  const seen = new Set();
  for (const value of [record.firstName, record.middleInitial, record.lastName]) {
    const part = String(value || '').trim();
    const key = part.toLowerCase();
    if (!part || seen.has(key)) continue;
    seen.add(key);
    parts.push(part);
  }
  return parts.join(' ') || '—';
}

function unbounceUrl(code) {
  return `${FORM_BASE}${encodeURIComponent(code)}`;
}

function maskSsn(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  const last4 = (digits || raw).slice(-4);
  return `•••-••-${last4}`;
}

function text(value) {
  const raw = value == null ? '' : String(value).trim();
  return raw || '—';
}

async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch (_err) {
    // Fall through when clipboard permission is denied.
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  if (!copied) throw new Error('copy failed');
}

const DETAIL_FIELDS = [
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Amount owed', 'amountOwed'],
  ['Tax type', 'taxType'],
  ['State', 'stateName'],
  ['Filing type', 'filingType'],
  ['Address', 'address'],
  ['Situation', 'situationDetails'],
  ['Free investigation', 'runInvestigation'],
  ['Date of birth', 'dob'],
  ['Joint filing', 'isJoint'],
  ['Spouse', 'spouseInfo'],
  ['Business / EIN', 'businessEin'],
  ['Submitted', 'dateSubmitted'],
  ['Time', 'timeSubmitted'],
  ['Page', 'pageName'],
  ['Variant', 'variant'],
  ['IP address', 'ipAddress'],
];

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showSsn, setShowSsn] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [notice, setNotice] = useState('');
  const [removingCode, setRemovingCode] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await api('/api/customers');
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setError(data.message || 'Unable to load records');
          return;
        }
        setRecords(Array.isArray(data.customers) ? data.customers : []);
      } catch (_err) {
        if (active) setError('Cannot reach the API. Check that the API project is deployed and NEXT_PUBLIC_API_URL has no extra space.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => {
      const haystack = [
        record.code,
        record.firstName,
        record.middleInitial,
        record.lastName,
        record.email,
        record.phone,
        record.stateName,
        record.taxType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [records, search]);

  async function removeClient(record) {
    const name = displayName(record);
    const confirmed = window.confirm(`Remove ${name} from mailer clients?`);
    if (!confirmed) return;

    setRemovingCode(record.code);
    setError('');
    setNotice('');
    try {
      const response = await api(`/api/customers/${encodeURIComponent(record.code)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Unable to remove that client');
        return;
      }
      setRecords((current) => current.filter((row) => row.code !== record.code));
      setSelected((current) => (current && current.code === record.code ? null : current));
      setNotice(`${name} was removed.`);
    } catch (_err) {
      setError('Cannot reach the API. Check that the API project is deployed and NEXT_PUBLIC_API_URL has no extra space.');
    } finally {
      setRemovingCode('');
    }
  }

  async function onCopy(code) {
    try {
      await copyText(unbounceUrl(code));
      setCopiedCode(code);
      window.setTimeout(() => {
        setCopiedCode((current) => (current === code ? '' : current));
      }, 1600);
    } catch (_err) {
      setError('Could not copy the URL.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Records</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Mailer clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? 'Loading records...' : `${filtered.length} shown of ${records.length}`}
          </p>
        </div>
        <label className="block w-full text-sm font-semibold text-navy sm:max-w-sm">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, phone, or code"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal text-ink outline-none ring-teal placeholder:text-slate-400 focus:ring-2"
          />
        </label>
      </div>

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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-mist text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Tax case</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Form link</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    {records.length === 0 ? 'No records yet. Import a mailer CSV to get started.' : 'No records match that search.'}
                  </td>
                </tr>
              )}
              {filtered.map((record) => {
                const url = unbounceUrl(record.code);
                return (
                  <tr key={record.code} className="border-t border-slate-100 align-top hover:bg-mist/70">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="whitespace-nowrap text-left font-semibold text-navy hover:text-teal"
                        onClick={() => {
                          setSelected(record);
                          setShowSsn(false);
                        }}
                      >
                        {displayName(record)}
                      </button>
                      <p className="mt-1 text-xs text-slate-500">{text(record.filingType)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{text(record.email)}</p>
                      <p className="mt-1 text-slate-500">{text(record.phone)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p>{text(record.amountOwed || record.debtAmount)}</p>
                      <p className="mt-1 text-slate-500">
                        {[record.taxType, record.stateName].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p>{text(record.dateSubmitted)}</p>
                      <p className="mt-1 text-slate-500">{text(record.timeSubmitted)}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-navy">{record.code}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <a href={url} target="_blank" rel="noreferrer" title={url} className="max-w-[180px] truncate text-xs font-semibold text-teal hover:underline">
                          {url}
                        </a>
                        <button
                          type="button"
                          onClick={() => onCopy(record.code)}
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy hover:border-teal"
                        >
                          {copiedCode === record.code ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => removeClient(record)}
                        disabled={removingCode === record.code}
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingCode === record.code ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-30 flex justify-end bg-ink/40" onClick={() => setSelected(null)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Record</p>
                <h2 className="mt-1 text-2xl font-extrabold text-ink">{displayName(selected)}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{selected.code}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full px-3 py-1 text-sm font-semibold text-navy hover:bg-mist">
                Close
              </button>
            </div>

            <dl className="mt-6 space-y-3">
              <div className="rounded-xl bg-mist px-3 py-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">SSN / Tax ID</dt>
                <dd className="mt-1 flex items-center justify-between gap-3 text-sm font-medium">
                  <span>{showSsn ? text(selected.ssn) : maskSsn(selected.ssn)}</span>
                  {selected.ssn ? (
                    <button type="button" className="text-xs font-bold text-teal" onClick={() => setShowSsn((current) => !current)}>
                      {showSsn ? 'Hide' : 'Show'}
                    </button>
                  ) : null}
                </dd>
              </div>
              {DETAIL_FIELDS.map(([label, key]) => (
                <div key={key} className="border-b border-slate-100 pb-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm text-ink">{text(selected[key])}</dd>
                </div>
              ))}
              {selected.noticeFileUrl ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notice file</dt>
                  <dd className="mt-1">
                    <a href={selected.noticeFileUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-teal hover:underline">
                      {selected.noticeFileUrl}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
