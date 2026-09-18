import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Cloud } from 'lucide-react';

// Opt-in "Live" mode: point the dashboard at a real backend instance and log
// in as a real user. Demo mode (the default) needs none of this — this panel
// only matters once a real backend from pulseward-backend/ is deployed.
export default function DataSourcePanel({ onClose, onConnect }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('http://localhost:4000');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | connecting | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('connecting');
    setErrorMsg('');
    try {
      await onConnect(url, email, password);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || t('dataSource.connectionFailed'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400" /> {t('dataSource.label')}
          </h2>
          <button onClick={onClose} data-testid="data-source-close-btn" className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <p className="text-xs text-slate-500">
            Connect to a running PulseWard backend (see <code className="text-slate-500 dark:text-slate-400">pulseward-backend/</code>) to
            replace the local demo simulator with real data and real-time updates. Leave this closed to keep using
            demo mode — no backend required.
          </p>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" htmlFor="ds-url">Backend URL</label>
            <input
              id="ds-url"
              data-testid="data-source-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" htmlFor="ds-email">Email</label>
            <input
              id="ds-email"
              data-testid="data-source-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nurse@pulseward.demo"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" htmlFor="ds-password">Password</label>
            <input
              id="ds-password"
              data-testid="data-source-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>

          {status === 'error' && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{errorMsg}</p>
          )}
          {status === 'connecting' && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('dataSource.connecting')}</p>
          )}

          <button
            type="submit"
            data-testid="data-source-connect-btn"
            disabled={status === 'connecting'}
            className="w-full py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-slate-900 dark:text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
}
