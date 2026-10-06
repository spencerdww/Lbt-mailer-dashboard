'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/session';

const COLUMNS = [
  'code',
  'first_name',
  'middle_initial',
  'last_name',
  'email',
  'phone_number',
  'amount_owed',
  'tax_type',
  'state_name',
  'filing_type',
  'address',
  'situation_details',
  'ssn',
  'dob',
  'Notice_File_URL',
];

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);

  async function onUpload(event) {
    event.preventDefault();
    if (!file) {
      setStatus({ type: 'error', text: 'Choose a CSV file first.' });
      return;
    }

    setUploading(true);
    setStatus({ type: 'info', text: 'Importing...' });

    try {
      const body = new FormData();
      body.append('file', file);
      const response = await api('/api/customers/upload', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus({ type: 'error', text: data.message || 'Import failed' });
        return;
      }

      const details = [`Inserted ${data.inserted ?? 0}`, `updated ${data.updated ?? 0}`];
      if (data.generatedCodes) {
        details.push(`generated ${data.generatedCodes} code${data.generatedCodes === 1 ? '' : 's'}`);
      }
      if (data.skipped) details.push(`skipped ${data.skipped}`);
      setStatus({ type: 'success', text: `Import completed! ${details.join(', ')}.` });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (_err) {
      setStatus({ type: 'error', text: 'Import failed. The API could not be reached.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Import</p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">Upload a mailer export</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use the CSV exported from the LifeBack Tax form. <span className="font-semibold text-navy">code</span> is the match key.
          A row without a code receives a new 12-character id. Uploading the same code again updates that record.
        </p>
      </div>

      <form onSubmit={onUpload} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-teal/50 bg-mist px-6 py-10 text-center">
          <span className="rounded-full bg-teal px-4 py-2 text-sm font-bold text-white">Choose CSV</span>
          <span className="mt-3 text-sm text-slate-500">{file ? file.name : 'No file chosen'}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
          />
        </label>

        <button
          type="submit"
          disabled={uploading}
          className="mt-5 w-full rounded-full bg-navy px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? 'Importing...' : 'Import CSV'}
        </button>

        {status && (
          <p
            role="status"
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              status.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : status.type === 'success'
                  ? 'border-teal/30 bg-teal/10 text-navy'
                  : 'border-slate-200 bg-mist text-navy'
            }`}
          >
            {status.text}
            {status.type === 'success' && (
              <button type="button" className="ml-2 font-bold text-teal" onClick={() => router.push('/dashboard')}>
                View records
              </button>
            )}
          </p>
        )}
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-ink">Columns this import understands</h2>
        <p className="mt-1 text-sm text-slate-500">
          Extra Unbounce columns such as date_submitted, ip_address, page_name, and variant are stored with the record.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {COLUMNS.map((column) => (
            <li key={column} className="rounded-full bg-mist px-3 py-1 font-mono text-xs text-navy">
              {column}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
