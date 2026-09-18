import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer } from 'lucide-react';

// Print-optimized patient report. Deliberately light-background/black-text —
// the dark dashboard theme is unreadable when printed, so this renders as its
// own self-contained layout rather than reusing dashboard styling.
//
// The print mechanism: everything on the page is hidden via @media print
// except the .pw-print-area subtree, which is repositioned to fill the page.
// This is a plain browser print (no PDF library dependency) — good enough for
// "print to PDF" via the browser's own print dialog, which covers the vast
// majority of real usage without adding a heavier dependency.
export default function PrintReport({ patient, protocol, cfg, history, onClose }) {
  const { t } = useTranslation();

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto pw-print-modal-backdrop">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .pw-print-area, .pw-print-area * { visibility: visible; }
          .pw-print-area {
            position: absolute; top: 0; left: 0; width: 100%;
            background: white; color: black; padding: 24px;
          }
          .pw-no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white text-black rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="pw-no-print flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">{t('patient.printReport')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              data-testid="print-confirm-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700"
            >
              <Printer className="w-4 h-4" /> {t('patient.printReport')}
            </button>
            <button onClick={onClose} data-testid="print-close-btn" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="pw-print-area p-8">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div>
              <h1 className="text-xl font-bold">PulseWard</h1>
              <p className="text-xs text-slate-600">{t('print.generatedAt')}: {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right text-xs text-amber-700 font-semibold border border-amber-500 bg-amber-50 rounded px-2 py-1">
              {t('print.demoWatermark')}
            </div>
          </div>

          <h2 className="text-lg font-bold mb-2">{patient.name}</h2>
          <table className="w-full text-sm mb-4">
            <tbody>
              <tr><td className="py-0.5 text-slate-600 w-40">{t('print.room')}</td><td className="py-0.5 font-medium">{patient.room}</td></tr>
              <tr><td className="py-0.5 text-slate-600">{t('print.ward')}</td><td className="py-0.5 font-medium">{patient.ward}</td></tr>
              <tr><td className="py-0.5 text-slate-600">{t('print.diagnosis')}</td><td className="py-0.5 font-medium">{patient.diagnosis}</td></tr>
              <tr><td className="py-0.5 text-slate-600">{t('print.attending')}</td><td className="py-0.5 font-medium">{patient.attending}</td></tr>
              <tr><td className="py-0.5 text-slate-600">{t('print.admissionDate')}</td><td className="py-0.5 font-medium">{patient.admissionDate}</td></tr>
              <tr><td className="py-0.5 text-slate-600">{t('print.protocol')}</td><td className="py-0.5 font-medium">{protocol} ({cfg.fullName})</td></tr>
            </tbody>
          </table>

          {patient.allergies && patient.allergies.length > 0 && !(patient.allergies.length === 1 && /no known/i.test(patient.allergies[0])) && (
            <div className="mb-4 p-3 border-2 border-red-600 rounded-lg bg-red-50">
              <p className="text-xs font-bold uppercase text-red-700 mb-1">{t('clinical.allergies')}</p>
              <p className="text-sm font-semibold text-red-800">{patient.allergies.join('; ')}</p>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4 p-3 border-2 border-slate-900 rounded-lg">
            <span className="text-3xl font-bold">{patient.score}</span>
            <div>
              <p className="font-bold">{patient.riskLevel}</p>
              <p className="text-xs text-slate-600">{t('print.currentScore')} &mdash; {protocol}</p>
            </div>
          </div>

          <h3 className="font-bold text-sm mb-1.5 mt-4">{t('print.componentBreakdown')}</h3>
          <table className="w-full text-sm mb-4 border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-600">
                <th className="py-1 font-medium">Parameter</th>
                <th className="py-1 font-medium">Value</th>
                <th className="py-1 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(patient.breakdown).map((b) => (
                <tr key={b.label} className="border-b border-slate-100">
                  <td className="py-1">{b.label}</td>
                  <td className="py-1">{String(b.value)}</td>
                  <td className="py-1 text-right font-mono">{b.score}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-bold text-sm mb-1.5 mt-4">{t('print.recentTrend')}</h3>
          <table className="w-full text-sm mb-4 border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-600">
                <th className="py-1 font-medium">Time</th>
                <th className="py-1 font-medium">HR</th>
                <th className="py-1 font-medium">RR</th>
                <th className="py-1 font-medium">SpO2</th>
                <th className="py-1 font-medium">Temp</th>
                <th className="py-1 font-medium text-right">{protocol} Score</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1">{h.time}</td>
                  <td className="py-1">{h.hr}</td>
                  <td className="py-1">{h.respRate}</td>
                  <td className="py-1">{h.spo2}%</td>
                  <td className="py-1">{h.temp}°C</td>
                  <td className="py-1 text-right font-mono">{h.protocolScore}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-bold text-sm mb-1.5 mt-4">{t('print.alertHistory')}</h3>
          {patient.alerts.length === 0 ? (
            <p className="text-sm text-slate-500">{t('print.noAlertHistory')}</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <tbody>
                {patient.alerts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-1 text-slate-600 w-20">{a.time}</td>
                    <td className="py-1">{a.message}</td>
                    <td className="py-1 text-right capitalize">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="font-bold text-sm mb-1.5 mt-4">{t('clinical.medicalHistory')}</h3>
          {(!patient.medicalHistory || patient.medicalHistory.length === 0) ? (
            <p className="text-sm text-slate-500">{t('clinical.noHistory')}</p>
          ) : (
            <ul className="text-sm mb-2 list-disc pl-5">
              {patient.medicalHistory.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}

          <h3 className="font-bold text-sm mb-1.5 mt-4">{t('clinical.currentMedications')}</h3>
          {(!patient.currentMedications || patient.currentMedications.length === 0) ? (
            <p className="text-sm text-slate-500">{t('clinical.noCurrentMeds')}</p>
          ) : (
            <table className="w-full text-sm mb-2 border-collapse">
              <tbody>
                {patient.currentMedications.map((m, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1">{m.name}</td>
                    <td className="py-1 text-right text-slate-600">{m.dose} &middot; {m.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="font-bold text-sm mb-1.5 mt-4">{t('careLog.title')}</h3>
          {(!patient.careLog || patient.careLog.length === 0) ? (
            <p className="text-sm text-slate-500">{t('careLog.noEntries')}</p>
          ) : (
            <div className="text-sm space-y-2">
              {[...patient.careLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((entry) => (
                <div key={entry.id} className="border-b border-slate-100 pb-1.5">
                  <p className="text-xs text-slate-500">
                    {entry.author} ({entry.role}) &middot; {new Date(entry.timestamp).toLocaleString()}
                  </p>
                  <p>{entry.text}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-6 pt-3 border-t border-slate-200">
            {t('print.demoWatermark')}
          </p>
        </div>
      </div>
    </div>
  );
}
