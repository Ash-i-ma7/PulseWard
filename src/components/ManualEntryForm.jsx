import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

// Plausible physiological ranges used for soft validation — values outside
// these still submit (a real reading occasionally is extreme) but the field
// is flagged so the clinician double-checks before confirming.
const RANGES = {
  hr: [20, 220],
  respRate: [4, 60],
  bpSys: [40, 260],
  bpDia: [20, 160],
  spo2: [50, 100],
  temp: [30, 43],
};

const DEFAULTS = { hr: '', respRate: '', bpSys: '', bpDia: '', spo2: '', temp: '', oxygenSupport: false, consciousness: 'A' };

export default function ManualEntryForm({ patient, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function isOutOfRange(field, value) {
    if (!RANGES[field] || value === '') return false;
    const [min, max] = RANGES[field];
    return Number(value) < min || Number(value) > max;
  }

  function validate() {
    const nextErrors = {};
    for (const field of ['hr', 'respRate', 'bpSys', 'bpDia', 'spo2', 'temp']) {
      if (form[field] === '' || Number.isNaN(Number(form[field]))) {
        nextErrors[field] = 'required';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        hr: Number(form.hr),
        respRate: Number(form.respRate),
        bpSys: Number(form.bpSys),
        bpDia: Number(form.bpDia),
        spo2: Number(form.spo2),
        temp: Number(form.temp),
        oxygenSupport: form.oxygenSupport,
        consciousness: form.consciousness,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const consciousnessOptions = [
    { value: 'A', label: t('manualEntry.consciousnessAlert') },
    { value: 'C', label: t('manualEntry.consciousnessConfusion') },
    { value: 'V', label: t('manualEntry.consciousnessVoice') },
    { value: 'P', label: t('manualEntry.consciousnessPain') },
    { value: 'U', label: t('manualEntry.consciousnessUnresponsive') },
  ];

  const numberField = (field, labelKey, step = '1') => (
    <div>
      <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" htmlFor={`me-${field}`}>{t(labelKey)}</label>
      <input
        id={`me-${field}`}
        data-testid={`manual-entry-${field}`}
        type="number"
        step={step}
        value={form[field]}
        onChange={(e) => update(field, e.target.value)}
        className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
          errors[field] ? 'border-rose-500' : isOutOfRange(field, form[field]) ? 'border-amber-500' : 'border-slate-200 dark:border-slate-800'
        }`}
      />
      {isOutOfRange(field, form[field]) && !errors[field] && (
        <p className="text-[11px] text-amber-400 mt-1">{t('manualEntry.outOfRangeWarning')}</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{t('manualEntry.title')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('manualEntry.subtitle', { name: patient.name })}</p>
          </div>
          <button onClick={onClose} data-testid="manual-entry-close-btn" className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {Object.keys(errors).length > 0 && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {t('manualEntry.validationError')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {numberField('hr', 'manualEntry.heartRate')}
            {numberField('respRate', 'manualEntry.respRate')}
            {numberField('bpSys', 'manualEntry.bpSys')}
            {numberField('bpDia', 'manualEntry.bpDia')}
            {numberField('spo2', 'manualEntry.spo2')}
            {numberField('temp', 'manualEntry.temp', '0.1')}
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1" htmlFor="me-consciousness">{t('manualEntry.consciousness')}</label>
            <select
              id="me-consciousness"
              data-testid="manual-entry-consciousness"
              value={form.consciousness}
              onChange={(e) => update('consciousness', e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              {consciousnessOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              data-testid="manual-entry-oxygen-support"
              checked={form.oxygenSupport}
              onChange={(e) => update('oxygenSupport', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            {t('manualEntry.oxygenSupport')}
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              {t('manualEntry.cancel')}
            </button>
            <button
              type="submit"
              data-testid="manual-entry-submit-btn"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 text-slate-900 dark:text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? t('manualEntry.submitting') : t('manualEntry.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
