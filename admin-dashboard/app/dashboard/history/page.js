'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/session';

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [removingId, setRemovingId] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await api('/api/imports');
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setError(data.message || 'Unable to load import history');
          return;
        }
        setImports(Array.isArray(data.imports) ? data.imports : []);
      } catch (_err) {
        if (active) setError('Cannot reach the API. Confirm the backend is running on port 5000.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function removeSheet(item) {
    const name = item.filename || 'this sheet';
    const confirmed = window.confirm(`Remove ${name} from history? Client records that exist only in this sheet will also be removed.`);
    if (!confirmed) return;

    setRemovingId(item._id);
    setError('');
    setNotice('');
    try {
      const response = await api(`/api/imports/${item._id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Unable to remove that sheet');
        return;
      }
      setImports((current) => current.filter((row) => row._id !== item._id));
      const removed = data.removedCustomers || 0;
      setNotice(
        removed
          ? `Sheet removed. ${removed} client record${removed === 1 ? '' : 's'} deleted.`
          : 'Sheet removed from history.'
      );
    } catch (_err) {
      setError('Cannot reach the API. Confirm the backend is running on port 5000.');
    } finally {
      setRemovingId('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">History</p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">Import history</h1>
        <p className="mt-1 text-sm text-slate-500">
          {loading ? 'Loading history...' : `${imports.length} upload${imports.length === 1 ? '' : 's'}`}
        </p>
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
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-mist text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 font-semibold">By</th>
                <th className="px-4 py-3 font-semibold">Rows</th>
                <th className="px-4 py-3 font-semibold">Inserted</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Generated</th>
                <th className="px-4 py-3 font-semibold">Skipped</th>
                <th className="px-4 py-3 font-semibold">Sheet</th>
              </tr>
            </thead>
            <tbody>
              {!loading && imports.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    No imports yet. Upload a CSV from the Import page.
                  </td>
                </tr>
              )}
              {imports.map((item) => (
                <tr key={item._id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-navy">{formatWhen(item.created_at)}</td>
                  <td className="px-4 py-4">{item.filename || 'upload.csv'}</td>
                  <td className="px-4 py-4">{item.username || '—'}</td>
                  <td className="px-4 py-4">{item.totalRows ?? 0}</td>
                  <td className="px-4 py-4">{item.inserted ?? 0}</td>
                  <td className="px-4 py-4">{item.updated ?? 0}</td>
                  <td className="px-4 py-4">{item.generatedCodes ?? 0}</td>
                  <td className="px-4 py-4">{item.skipped ?? 0}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => removeSheet(item)}
                      disabled={removingId === item._id}
                      className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removingId === item._id ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
