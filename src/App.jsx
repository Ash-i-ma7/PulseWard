import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Activity, HeartPulse, Wind, Thermometer, Gauge, Brain, AlertTriangle, Bell, BellRing,
  LayoutGrid, BarChart3, Search, Pause, Play, Zap, ChevronRight, ChevronLeft,
  Menu, X, CheckCircle2, ArrowUpCircle, Radio, Clock, User, Languages, ClipboardEdit, Printer, Cloud, CloudOff,
  Sun, Moon, Pill, History, ShieldAlert, StickyNote, Plus,
} from 'lucide-react';
import {
  INITIAL_PATIENTS, calculateNEWS2, calculateMEWS, getProtocolHistory,
  PROTOCOL_CONFIG, WARDS,
} from './clinicalData';
import ManualEntryForm from './components/ManualEntryForm';
import PrintReport from './components/PrintReport';
import DataSourcePanel from './components/DataSourcePanel';
import * as api from './api/client';

const RISK_STYLES = {
  Critical: { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/40', dot: 'bg-rose-500', ring: 'ring-rose-500/30' },
  Medium: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40', dot: 'bg-amber-500', ring: 'ring-amber-500/30' },
  'Low-Medium': { text: 'text-yellow-300', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', dot: 'bg-yellow-400', ring: 'ring-yellow-400/20' },
  Low: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', dot: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
};

function riskFor(protocol, vitals) {
  const result = protocol === 'MEWS' ? calculateMEWS(vitals) : calculateNEWS2(vitals);
  return result;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function jitter(value, magnitude, min, max) {
  const delta = (Math.random() - 0.5) * 2 * magnitude;
  return clamp(Math.round((value + delta) * 10) / 10, min, max);
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Simulate one physiologic tick for a patient, biased toward its current trend ---
function simulateVitalsTick(vitals) {
  const trending = vitals.hr > 100 || vitals.respRate > 22 || vitals.spo2 < 94;
  const drift = trending ? (Math.random() < 0.6 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);

  return {
    ...vitals,
    hr: jitter(vitals.hr + drift * 1.5, 3, 38, 175),
    bpSys: jitter(vitals.bpSys - drift * 0.8, 4, 70, 220),
    bpDia: jitter(vitals.bpDia - drift * 0.4, 3, 40, 130),
    respRate: jitter(vitals.respRate + drift * 0.5, 1.5, 8, 36),
    spo2: clamp(jitter(vitals.spo2 - drift * 0.4, 1, 82, 100), 82, 100),
    temp: clamp(jitter(vitals.temp + drift * 0.05, 0.15, 34.5, 41),34.5,41),
  };
}

function App() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('pulseward_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [patients, setPatients] = useState(() => deepClone(INITIAL_PATIENTS));
  const [protocol, setProtocol] = useState('NEWS2');
  const [view, setView] = useState('overview');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('All Wards');
  const [riskFilter, setRiskFilter] = useState('All');
  const [simRunning, setSimRunning] = useState(true);
  const [simIntervalMs, setSimIntervalMs] = useState(5000);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [manualEntryPatient, setManualEntryPatient] = useState(null);
  const [printPatient, setPrintPatient] = useState(null);
  const [dataSourcePanelOpen, setDataSourcePanelOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const tickRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('pulseward_theme', theme);
  }, [theme]);

  const cfg = PROTOCOL_CONFIG[protocol];

  const runTick = useCallback(() => {
    setPatients((prev) =>
      prev.map((p) => {
        const newVitals = simulateVitalsTick(p.vitals);
        const news2 = calculateNEWS2(newVitals).score;
        const now = new Date();
        const newHistoryPoint = {
          time: formatTime(now),
          hr: newVitals.hr,
          bpSys: newVitals.bpSys,
          bpDia: newVitals.bpDia,
          respRate: newVitals.respRate,
          spo2: newVitals.spo2,
          temp: newVitals.temp,
          news: news2,
        };
        const vitalsHistory = [...p.vitalsHistory.slice(-5), newHistoryPoint];

        const prevRisk = riskFor(protocol, p.vitals).riskLevel;
        const nextRisk = riskFor(protocol, newVitals).riskLevel;
        let alerts = p.alerts;
        if (nextRisk === 'Critical' && prevRisk !== 'Critical') {
          const scoreNow = riskFor(protocol, newVitals).score;
          alerts = [
            {
              id: `ALT-${Date.now()}-${p.id}`,
              time: formatTime(now),
              type: 'CRITICAL_ESCALATION',
              message: `${protocol} score reached ${scoreNow} (${cfg.criticalLabel})`,
              status: 'active',
              protocol,
            },
            ...alerts,
          ];
          toast.error(`${p.name}: new critical alert (${protocol} ${scoreNow})`, { duration: 4000 });
        }

        return { ...p, vitals: newVitals, vitalsHistory, alerts };
      })
    );
  }, [protocol, cfg]);

  useEffect(() => {
    if (!simRunning || liveMode) return undefined;
    tickRef.current = setInterval(runTick, simIntervalMs);
    return () => clearInterval(tickRef.current);
  }, [simRunning, simIntervalMs, runTick, liveMode]);

  const patientsWithScore = useMemo(
    () =>
      patients.map((p) => {
        const result = riskFor(protocol, p.vitals);
        return { ...p, score: result.score, riskLevel: result.riskLevel, breakdown: result.breakdown };
      }),
    [patients, protocol]
  );

  const riskOrder = { Critical: 0, Medium: 1, 'Low-Medium': 2, Low: 3 };
  const sortedPatients = useMemo(
    () => [...patientsWithScore].sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.score - a.score),
    [patientsWithScore]
  );

  const filteredPatients = useMemo(() => {
    return sortedPatients.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.room.toLowerCase().includes(search.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(search.toLowerCase());
      const matchesWard = wardFilter === 'All Wards' || p.ward === wardFilter;
      const matchesRisk = riskFilter === 'All' || p.riskLevel === riskFilter;
      return matchesSearch && matchesWard && matchesRisk;
    });
  }, [sortedPatients, search, wardFilter, riskFilter]);

  const allAlerts = useMemo(() => {
    const flat = [];
    patientsWithScore.forEach((p) => {
      p.alerts.forEach((a) => flat.push({ ...a, patientId: p.id, patientName: p.name, room: p.room }));
    });
    return flat.sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));
  }, [patientsWithScore]);

  const activeAlertCount = allAlerts.filter((a) => a.status === 'active').length;

  const selectedPatient = useMemo(
    () => patientsWithScore.find((p) => p.id === selectedPatientId) || null,
    [patientsWithScore, selectedPatientId]
  );

  function openPatient(id) {
    setSelectedPatientId(id);
    setView('detail');
    setMobileNavOpen(false);
  }

  function acknowledgeAlert(patientId, alertId) {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, alerts: p.alerts.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)) }
          : p
      )
    );
    toast.success('Alert acknowledged');
    if (liveMode) {
      api.acknowledgeAlert(alertId).catch((err) => toast.error(`Failed to sync to backend: ${err.message}`));
    }
  }

  function escalateAlert(patientId, alertId) {
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? { ...p, alerts: p.alerts.map((a) => (a.id === alertId ? { ...a, status: 'escalated' } : a)) }
          : p
      )
    );
    toast.warning('Rapid Response Team notified', { icon: <ArrowUpCircle className="w-4 h-4" /> });
    if (liveMode) {
      api.escalateAlert(alertId).catch((err) => toast.error(`Failed to sync to backend: ${err.message}`));
    }
  }

  function manualPulse() {
    runTick();
    toast.info(t('sim.manualRefreshTriggered'));
  }

  // Called by ManualEntryForm on submit. In Live mode, writes through to the
  // real backend (which does the scoring); in Demo mode, applies the entry to
  // local state using the same scoring functions the backend uses.
  async function submitManualObservation(patientId, vitalsInput) {
    if (liveMode) {
      const result = await api.submitManualVitals(patientId, vitalsInput);
      toast.success(t('manualEntry.success'));
      // The realtime 'vitals:update' event also fires and will merge this
      // into state (see subscribeLive below); this optimistic update just
      // avoids a visible lag waiting for the round-trip.
      mergeVitalsUpdate(patientId, result.observation);
      return result;
    }
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const now = new Date();
        const news2 = calculateNEWS2({ ...vitalsInput, spo2Scale2: p.vitals.spo2Scale2 }).score;
        const newHistoryPoint = {
          time: formatTime(now),
          hr: vitalsInput.hr, bpSys: vitalsInput.bpSys, bpDia: vitalsInput.bpDia,
          respRate: vitalsInput.respRate, spo2: vitalsInput.spo2, temp: vitalsInput.temp, news: news2,
        };
        return {
          ...p,
          vitals: { ...p.vitals, ...vitalsInput },
          vitalsHistory: [...p.vitalsHistory.slice(-5), newHistoryPoint],
        };
      })
    );
    toast.success(t('manualEntry.success'));
  }

  // Merge one backend vitals_observation row into local patient state —
  // shared by the optimistic update above and the realtime socket handler.
  function mergeVitalsUpdate(patientId, observation) {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== String(patientId)) return p;
        const newPoint = {
          time: formatTime(new Date(observation.recorded_at)),
          hr: Number(observation.hr), bpSys: Number(observation.bp_sys), bpDia: Number(observation.bp_dia),
          respRate: Number(observation.resp_rate), spo2: Number(observation.spo2), temp: Number(observation.temp),
          news: observation.news2_score,
        };
        const newVitals = {
          hr: Number(observation.hr), bpSys: Number(observation.bp_sys), bpDia: Number(observation.bp_dia),
          respRate: Number(observation.resp_rate), spo2: Number(observation.spo2), temp: Number(observation.temp),
          spo2Scale2: p.vitals.spo2Scale2, oxygenSupport: observation.oxygen_support, consciousness: observation.consciousness,
        };
        const alreadyHavePoint = p.vitalsHistory.some((h) => h.time === newPoint.time && h.hr === newPoint.hr);
        return {
          ...p,
          vitals: newVitals,
          vitalsHistory: alreadyHavePoint ? p.vitalsHistory : [...p.vitalsHistory.slice(-5), newPoint],
        };
      })
    );
  }

  async function addCareLogEntry(patientId, entry) {
    if (liveMode) {
      const saved = await api.addCareLogEntry(patientId, entry);
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, careLog: [...(p.careLog || []), saved] } : p))
      );
      toast.success(t('careLog.entrySaved'));
      return;
    }
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const newEntry = {
          id: `CL-${Date.now()}`,
          author: entry.author,
          role: entry.role,
          text: entry.text,
          timestamp: new Date().toISOString(),
        };
        return { ...p, careLog: [...(p.careLog || []), newEntry] };
      })
    );
    toast.success(t('careLog.entrySaved'));
  }

  // Fetches the real ward list + patient list + recent vitals history + open
  // alerts from the backend and maps them into the same shape the UI already
  // renders for Demo-mode patients, so every existing view (census, detail,
  // charts, alerts, analytics) works unmodified against real data.
  async function loadLivePatients() {
    const [wards, backendPatients, allAlerts] = await Promise.all([
      api.fetchWards(),
      api.fetchPatients(),
      api.fetchAlerts(),
    ]);
    const wardNameById = Object.fromEntries(wards.map((w) => [w.id, w.name]));
    const alertsByPatient = {};
    allAlerts.forEach((a) => {
      (alertsByPatient[a.patient_id] ||= []).push(a);
    });

    const mapped = await Promise.all(
      backendPatients.map(async (p) => {
        let historyRows = [];
        try {
          historyRows = await api.fetchPatientVitalsHistory(p.id, 6);
        } catch {
          historyRows = [];
        }

        const vitalsHistory = historyRows.map((row) => ({
          time: formatTime(new Date(row.recorded_at)),
          hr: Number(row.hr), bpSys: Number(row.bp_sys), bpDia: Number(row.bp_dia),
          respRate: Number(row.resp_rate), spo2: Number(row.spo2), temp: Number(row.temp),
          news: row.news2_score,
        }));

        const last = historyRows[historyRows.length - 1];
        const vitals = last
          ? {
              hr: Number(last.hr), bpSys: Number(last.bp_sys), bpDia: Number(last.bp_dia),
              respRate: Number(last.resp_rate), spo2: Number(last.spo2), temp: Number(last.temp),
              spo2Scale2: p.spo2Scale === 2, oxygenSupport: last.oxygen_support, consciousness: last.consciousness,
            }
          : {
              // No observations recorded for this patient yet — plausible
              // placeholder so the UI has something to render until the
              // first manual entry or sensor reading arrives.
              hr: 75, bpSys: 120, bpDia: 80, respRate: 16, spo2: 98, temp: 37.0,
              spo2Scale2: p.spo2Scale === 2, oxygenSupport: false, consciousness: 'A',
            };

        const alerts = (alertsByPatient[p.id] || []).map((a) => ({
          id: String(a.id), time: formatTime(new Date(a.created_at)),
          type: a.risk_level === 'Critical' ? 'CRITICAL_ESCALATION' : 'ALERT',
          message: a.message, status: a.status, protocol: a.protocol,
        }));

        return {
          id: String(p.id),
          name: p.name, age: p.age, gender: p.gender, room: p.room,
          ward: wardNameById[p.wardId] || 'Unassigned Ward',
          diagnosis: p.diagnosis, attending: p.attending, admissionDate: p.admissionDate,
          notes: p.notes,
          allergies: p.allergies || [], medicalHistory: p.medicalHistory || [],
          currentMedications: p.currentMedications || [], pastMedications: p.pastMedications || [],
          careLog: [], // loaded on demand when the patient detail view opens
          vitals,
          vitalsHistory: vitalsHistory.length ? vitalsHistory : [{ time: formatTime(new Date()), ...vitals, news: 0 }],
          alerts,
        };
      })
    );

    setPatients(mapped);
  }

  // Live realtime updates: merges backend WebSocket events into the same
  // local state shape, so the census/detail/alerts views update immediately
  // without polling.
  function subscribeLive() {
    api.subscribeRealtime({
      onVitalsUpdate: ({ patientId, observation }) => mergeVitalsUpdate(patientId, observation),
      onAlertNew: (alert) => {
        setPatients((prev) =>
          prev.map((p) => {
            if (p.id !== String(alert.patient_id)) return p;
            const newAlert = {
              id: String(alert.id), time: formatTime(new Date(alert.created_at)),
              type: 'CRITICAL_ESCALATION', message: alert.message, status: alert.status, protocol: alert.protocol,
            };
            if (p.alerts.some((a) => a.id === newAlert.id)) return p;
            return { ...p, alerts: [newAlert, ...p.alerts] };
          })
        );
        toast.error(`New critical alert: ${alert.message}`, { duration: 5000 });
      },
      onAlertUpdated: (alert) => {
        setPatients((prev) =>
          prev.map((p) => ({
            ...p,
            alerts: p.alerts.map((a) => (a.id === String(alert.id) ? { ...a, status: alert.status } : a)),
          }))
        );
      },
    });
  }

  async function connectLiveMode(url, email, password) {
    await api.connect(url);
    await api.login(email, password);
    await loadLivePatients();
    subscribeLive();
    setLiveMode(true);
    setDataSourcePanelOpen(false);
    toast.success(t('dataSource.connected'));
  }

  function disconnectLiveMode() {
    api.logout();
    setLiveMode(false);
    setPatients(deepClone(INITIAL_PATIENTS));
  }

  // In Live mode, the patient detail view's care log starts empty (fetched
  // lazily rather than upfront for every patient in the census, to avoid an
  // N+1 request storm on connect). Load it the first time a patient is opened.
  useEffect(() => {
    if (!liveMode || !selectedPatientId) return;
    const current = patients.find((p) => p.id === selectedPatientId);
    if (current && current.careLog && current.careLog.length > 0) return;
    api
      .fetchCareLog(selectedPatientId)
      .then((entries) => {
        setPatients((prev) => prev.map((p) => (p.id === selectedPatientId ? { ...p, careLog: entries } : p)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, selectedPatientId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans">
      <Toaster theme="dark" richColors position="top-right" />
      <TopBar
        protocol={protocol}
        setProtocol={setProtocol}
        view={view}
        setView={setView}
        activeAlertCount={activeAlertCount}
        simRunning={simRunning}
        setSimRunning={setSimRunning}
        simIntervalMs={simIntervalMs}
        setSimIntervalMs={setSimIntervalMs}
        onManualPulse={manualPulse}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        liveMode={liveMode}
        onOpenDataSource={() => setDataSourcePanelOpen(true)}
        onDisconnectLive={disconnectLiveMode}
        theme={theme}
        setTheme={setTheme}
      />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'overview' && (
          <Overview
            patients={filteredPatients}
            totalCount={patients.length}
            protocol={protocol}
            cfg={cfg}
            search={search}
            setSearch={setSearch}
            wardFilter={wardFilter}
            setWardFilter={setWardFilter}
            riskFilter={riskFilter}
            setRiskFilter={setRiskFilter}
            onOpenPatient={openPatient}
          />
        )}

        {view === 'detail' && selectedPatient && (
          <PatientDetail
            patient={selectedPatient}
            allPatients={sortedPatients}
            protocol={protocol}
            cfg={cfg}
            onSelectPatient={(id) => setSelectedPatientId(id)}
            onBack={() => setView('overview')}
            onAcknowledge={acknowledgeAlert}
            onEscalate={escalateAlert}
            onOpenManualEntry={() => setManualEntryPatient(selectedPatient)}
            onOpenPrintReport={() => setPrintPatient(selectedPatient)}
            onAddCareLogEntry={(entry) => addCareLogEntry(selectedPatient.id, entry)}
          />
        )}

        {view === 'alerts' && (
          <AlertsQueue alerts={allAlerts} onAcknowledge={acknowledgeAlert} onEscalate={escalateAlert} onOpenPatient={openPatient} />
        )}

        {view === 'analytics' && <Analytics patients={patientsWithScore} protocol={protocol} cfg={cfg} simRunning={simRunning} />}
      </main>

      <footer className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2 text-xs text-slate-500 dark:text-slate-600 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
        {t('footer.demoNotice')}
      </footer>

      {manualEntryPatient && (
        <ManualEntryForm
          patient={manualEntryPatient}
          onClose={() => setManualEntryPatient(null)}
          onSubmit={async (vitals) => {
            await submitManualObservation(manualEntryPatient.id, vitals);
            setManualEntryPatient(null);
          }}
        />
      )}

      {printPatient && (
        <PrintReport
          patient={printPatient}
          protocol={protocol}
          cfg={cfg}
          history={getProtocolHistory(printPatient, protocol)}
          onClose={() => setPrintPatient(null)}
        />
      )}

      {dataSourcePanelOpen && (
        <DataSourcePanel
          onClose={() => setDataSourcePanelOpen(false)}
          onConnect={connectLiveMode}
        />
      )}
    </div>
  );
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// TOP BAR
// ---------------------------------------------------------------------------
function TopBar({
  protocol, setProtocol, view, setView, activeAlertCount, simRunning, setSimRunning,
  simIntervalMs, setSimIntervalMs, onManualPulse, mobileNavOpen, setMobileNavOpen,
  liveMode, onOpenDataSource, onDisconnectLive, theme, setTheme,
}) {
  const { t } = useTranslation();
  const navItems = [
    { key: 'overview', label: t('nav.wardCensus'), icon: LayoutGrid },
    { key: 'alerts', label: t('nav.alertQueue'), icon: Bell, badge: activeAlertCount },
    { key: 'analytics', label: t('nav.wardAnalytics'), icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/90 dark:bg-[#070b14]/90 border-b border-slate-200 dark:border-slate-800/80">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight leading-none">{t('app.name')}</h1>
              <p className="text-[11px] text-slate-500 leading-none mt-1">{t('app.tagline')}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                data-testid={`nav-${item.key}-btn`}
                onClick={() => setView(item.key)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === item.key ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-slate-900 dark:text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
            <SimControls
              simRunning={simRunning}
              setSimRunning={setSimRunning}
              simIntervalMs={simIntervalMs}
              setSimIntervalMs={setSimIntervalMs}
              onManualPulse={onManualPulse}
            />
            <DataSourceButton liveMode={liveMode} onOpen={onOpenDataSource} onDisconnect={onDisconnectLive} />
            <LanguageSwitcher />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>

          <button
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
            data-testid="mobile-nav-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b14] px-4 py-4 space-y-4" data-testid="mobile-nav-menu">
          <div className="grid grid-cols-3 gap-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                data-testid={`mobile-nav-${item.key}-btn`}
                onClick={() => {
                  setView(item.key);
                  setMobileNavOpen(false);
                }}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium ${
                  view === item.key ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
          <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} fullWidth />
          <SimControls
            simRunning={simRunning}
            setSimRunning={setSimRunning}
            simIntervalMs={simIntervalMs}
            setSimIntervalMs={setSimIntervalMs}
            onManualPulse={onManualPulse}
            fullWidth
          />
          <div className="flex items-center gap-2">
            <DataSourceButton liveMode={liveMode} onOpen={onOpenDataSource} onDisconnect={onDisconnectLive} fullWidth />
            <LanguageSwitcher fullWidth />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        </div>
      )}
    </header>
  );
}

function DataSourceButton({ liveMode, onOpen, onDisconnect, fullWidth }) {
  const { t } = useTranslation();
  return (
    <button
      data-testid="data-source-btn"
      onClick={liveMode ? onDisconnect : onOpen}
      title={liveMode ? t('dataSource.live') : t('dataSource.demo')}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${fullWidth ? 'flex-1 justify-center' : ''} ${
        liveMode ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'
      }`}
    >
      {liveMode ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
      {liveMode ? t('dataSource.live') : t('dataSource.demo')}
    </button>
  );
}

function LanguageSwitcher({ fullWidth }) {
  const { t, i18n } = useTranslation();
  return (
    <select
      data-testid="language-select"
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t('language.label')}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${fullWidth ? 'flex-1' : ''}`}
    >
      <option value="en">{t('language.en')}</option>
      <option value="hi">{t('language.hi')}</option>
      <option value="mr">{t('language.mr')}</option>
    </select>
  );
}

function ThemeToggle({ theme, setTheme }) {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  return (
    <button
      data-testid="theme-toggle-btn"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-cyan-300 transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function ProtocolSwitch({ protocol, setProtocol, fullWidth }) {
  return (
    <div className={`flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 ${fullWidth ? 'w-full' : ''}`} data-testid="protocol-switch">
      {['NEWS2', 'MEWS'].map((p) => (
        <button
          key={p}
          data-testid={`protocol-${p.toLowerCase()}-btn`}
          onClick={() => setProtocol(p)}
          className={`${fullWidth ? 'flex-1' : 'px-3.5'} py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors ${
            protocol === p ? 'bg-cyan-600 text-slate-900 dark:text-white shadow shadow-cyan-600/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function SimControls({ simRunning, setSimRunning, simIntervalMs, setSimIntervalMs, onManualPulse, fullWidth }) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-2 ${fullWidth ? 'w-full' : ''}`}>
      <button
        data-testid="sim-pause-resume-btn"
        onClick={() => setSimRunning((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
          simRunning ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400'
        }`}
      >
        {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {simRunning ? t('sim.live') : t('sim.paused')}
      </button>

      <select
        data-testid="sim-interval-select"
        value={simIntervalMs}
        onChange={(e) => setSimIntervalMs(Number(e.target.value))}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        <option value={3000}>{t('sim.interval3s')}</option>
        <option value={5000}>{t('sim.interval5s')}</option>
        <option value={10000}>{t('sim.interval10s')}</option>
        <option value={20000}>{t('sim.interval20s')}</option>
      </select>

      <button
        data-testid="manual-pulse-btn"
        onClick={onManualPulse}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
      >
        <Zap className="w-3.5 h-3.5" />
        {t('sim.pulse')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OVERVIEW
// ---------------------------------------------------------------------------
function Overview({ patients, totalCount, protocol, cfg, search, setSearch, wardFilter, setWardFilter, riskFilter, setRiskFilter, onOpenPatient }) {
  const { t } = useTranslation();
  const riskCounts = { Critical: 0, Medium: 0, 'Low-Medium': 0, Low: 0 };
  patients.forEach((p) => (riskCounts[p.riskLevel] = (riskCounts[p.riskLevel] || 0) + 1));

  const riskFilterOptions = protocol === 'MEWS' ? ['All', 'Critical', 'Medium', 'Low'] : ['All', 'Critical', 'Medium', 'Low-Medium', 'Low'];
  const riskLabels = { Critical: t('overview.critical'), Medium: t('overview.medium'), 'Low-Medium': t('overview.lowMedium'), Low: t('overview.stable') };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{t('overview.title')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('overview.subtitle', { count: totalCount, protocol, fullName: cfg.fullName })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label={t('overview.critical')} value={riskCounts.Critical} risk="Critical" />
        <StatPill label={t('overview.medium')} value={riskCounts.Medium} risk="Medium" />
        {protocol === 'NEWS2' && <StatPill label={t('overview.lowMedium')} value={riskCounts['Low-Medium']} risk="Low-Medium" />}
        <StatPill label={t('overview.stable')} value={riskCounts.Low} risk="Low" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="patient-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('overview.searchPlaceholder')}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>
        <select
          data-testid="ward-filter-select"
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {WARDS.map((w) => (
            <option key={w} value={w}>{w === 'All Wards' ? t('overview.allWards') : w}</option>
          ))}
        </select>
        <select
          data-testid="risk-filter-select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {riskFilterOptions.map((r) => (
            <option key={r} value={r}>{r === 'All' ? t('overview.allRiskLevels') : riskLabels[r]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5" data-testid="patient-list">
        {patients.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            {t('overview.noResults')}
          </div>
        )}
        {patients.map((p) => (
          <PatientRow key={p.id} patient={p} protocol={protocol} onClick={() => onOpenPatient(p.id)} />
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value, risk }) {
  const s = RISK_STYLES[risk];
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
      <p className={`text-2xl font-bold font-mono ${s.text}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function PatientRow({ patient, protocol, onClick }) {
  const s = RISK_STYLES[patient.riskLevel];
  return (
    <button
      data-testid={`patient-row-${patient.id}`}
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900 border ${s.border} rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 transition-colors group`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${s.dot} ${patient.riskLevel === 'Critical' ? 'animate-pulse' : ''} shrink-0`} />

      <div className="min-w-[160px] flex-1">
        <p className="font-semibold text-slate-900 dark:text-white text-sm">{patient.name}</p>
        <p className="text-xs text-slate-500">{patient.room} &middot; {patient.ward}</p>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
        <VitalChip icon={HeartPulse} value={`${patient.vitals.hr}`} unit="bpm" />
        <VitalChip icon={Wind} value={`${patient.vitals.respRate}`} unit="rpm" />
        <VitalChip icon={Gauge} value={`${patient.vitals.spo2}`} unit="%" />
        <VitalChip icon={Thermometer} value={`${patient.vitals.temp.toFixed(1)}`} unit="°C" />
      </div>

      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${s.bg} ${s.border} border`}>
        <span className={`text-lg font-bold font-mono ${s.text}`}>{patient.score}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${s.text}`}>{patient.riskLevel}</span>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-600 group-hover:text-slate-700 dark:hover:text-slate-300 shrink-0" />
    </button>
  );
}

function VitalChip({ icon: Icon, value, unit }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-600" />
      {value}<span className="text-slate-500 dark:text-slate-600">{unit}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// PATIENT DETAIL
// ---------------------------------------------------------------------------
function PatientDetail({ patient, allPatients, protocol, cfg, onSelectPatient, onBack, onAcknowledge, onEscalate, onOpenManualEntry, onOpenPrintReport, onAddCareLogEntry }) {
  const { t } = useTranslation();
  const s = RISK_STYLES[patient.riskLevel];
  const history = useMemo(() => getProtocolHistory(patient, protocol), [patient, protocol]);
  const currentIndex = allPatients.findIndex((p) => p.id === patient.id);

  function stepPatient(dir) {
    const next = allPatients[(currentIndex + dir + allPatients.length) % allPatients.length];
    onSelectPatient(next.id);
  }

  return (
    <div className="space-y-6" data-testid="patient-detail-view">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} data-testid="back-to-census-btn" className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
          <ChevronLeft className="w-4 h-4" /> {t('patient.backToCensus')}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenManualEntry}
            data-testid="manual-entry-btn"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
          >
            <ClipboardEdit className="w-3.5 h-3.5" /> {t('patient.manualEntry')}
          </button>
          <button
            onClick={onOpenPrintReport}
            data-testid="print-report-btn"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
          >
            <Printer className="w-3.5 h-3.5" /> {t('patient.printReport')}
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border ${s.border} bg-white dark:bg-slate-900/70 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => stepPatient(-1)} data-testid="prev-patient-btn" className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{patient.name}</h2>
              <p className="text-sm text-slate-500">
                {patient.age}{patient.gender} &middot; {patient.room} &middot; {patient.ward} &middot; {t('patient.admitted')} {patient.admissionDate}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{patient.diagnosis}</p>
              <p className="text-xs text-slate-500 dark:text-slate-600 mt-0.5">{patient.attending}</p>
            </div>
            <button onClick={() => stepPatient(1)} data-testid="next-patient-btn" className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <select
            data-testid="patient-selector-dropdown"
            value={patient.id}
            onChange={(e) => onSelectPatient(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {allPatients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} &mdash; {p.room}</option>
            ))}
          </select>

          <div className={`flex flex-col items-center justify-center px-5 py-3 rounded-xl ${s.bg} border ${s.border}`}>
            <span className={`text-3xl font-bold font-mono ${s.text}`} data-testid="patient-current-score">{patient.score}</span>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${s.text}`}>{protocol} &middot; {patient.riskLevel}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <VitalCard icon={HeartPulse} label={t('patient.heartRate')} value={patient.vitals.hr} unit="bpm" tone="rose" />
          <VitalCard icon={Wind} label={t('patient.respRate')} value={patient.vitals.respRate} unit="rpm" tone="sky" />
          <VitalCard icon={Gauge} label={t('patient.spo2')} value={patient.vitals.spo2} unit="%" tone="emerald" />
          <VitalCard icon={Thermometer} label={t('patient.temperature')} value={patient.vitals.temp.toFixed(1)} unit="°C" tone="amber" />
          <VitalCard icon={Activity} label={t('patient.bloodPressure')} value={`${patient.vitals.bpSys}/${patient.vitals.bpDia}`} unit="mmHg" tone="violet" />
          <VitalCard icon={Brain} label={t('patient.consciousness')} value={patient.breakdown.consciousness.value} unit="" tone="cyan" />
        </div>
      </div>

      {patient.allergies && patient.allergies.length > 0 && !(patient.allergies.length === 1 && /no known/i.test(patient.allergies[0])) && (
        <div
          data-testid="allergy-banner"
          className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-500/10 px-5 py-4 flex items-start gap-3"
        >
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400 mb-1">{t('clinical.allergies')}</p>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((a, i) => (
                <span key={i} className="text-sm font-semibold text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 rounded-lg px-2.5 py-1">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartCard title={t('charts.hrRespTrend')} subtitle={t('charts.last6Points')} icon={HeartPulse}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[30, 175]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="hr" stroke="#fb7185" strokeWidth={2.5} name="Heart Rate (bpm)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="respRate" stroke="#38bdf8" strokeWidth={2.5} name="Resp Rate (rpm)" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t('charts.spo2ScoreTrend', { protocol })} subtitle={t('charts.escalationTracker')} icon={Activity}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={11} domain={[80, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} domain={[0, 15]} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine
                  yAxisId="right"
                  y={cfg.criticalThreshold}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: t('charts.criticalThreshold', { threshold: cfg.criticalThreshold }), fill: '#ef4444', fontSize: 10 }}
                />
                <Line yAxisId="left" type="monotone" dataKey="spo2" stroke="#34d399" strokeWidth={2.5} name="SpO2 (%)" dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="protocolScore" stroke="#f59e0b" strokeWidth={3} name={`${protocol} Score`} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {patient.notes && (
            <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">{t('patient.clinicalNotes')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{patient.notes}</p>
            </div>
          )}

          <ClinicalHistoryCard patient={patient} />
          <CareLog patient={patient} onAddEntry={(entry) => onAddCareLogEntry(entry)} />
        </div>

        <div className="space-y-6">
          <ScoreBreakdown breakdown={patient.breakdown} cfg={cfg} score={patient.score} riskLevel={patient.riskLevel} protocol={protocol} />

          {patient.alerts.length > 0 && (
            <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-rose-400" /> {t('patient.patientAlerts')}
              </h3>
              <div className="space-y-2">
                {patient.alerts.map((a) => (
                  <AlertItem key={a.id} alert={a} onAcknowledge={() => onAcknowledge(patient.id, a.id)} onEscalate={() => onEscalate(patient.id, a.id)} compact />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = { backgroundColor: '#0a0f1a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' };

function ChartCard({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">{subtitle}</span>
      </div>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}

function VitalCard({ icon: Icon, label, value, unit, tone }) {
  const toneMap = {
    rose: 'text-rose-400', sky: 'text-sky-400', emerald: 'text-emerald-400',
    amber: 'text-amber-400', violet: 'text-violet-400', cyan: 'text-cyan-400',
  };
  return (
    <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${toneMap[tone]}`} />
        {label}
      </div>
      <p className="font-mono font-bold text-slate-900 dark:text-white text-lg leading-none">
        {value}<span className="text-xs text-slate-500 ml-1 font-normal">{unit}</span>
      </p>
    </div>
  );
}

function ScoreBreakdown({ breakdown, cfg, score, riskLevel, protocol }) {
  const { t } = useTranslation();
  const s = RISK_STYLES[riskLevel];
  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5" data-testid="score-breakdown-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('breakdown.componentBreakdown', { protocol })}</h3>
        <span className={`text-sm font-bold font-mono ${s.text}`}>{score} {t('breakdown.points')}</span>
      </div>
      <div className="space-y-1.5">
        {Object.values(breakdown).map((b) => (
          <div key={b.label} className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800/70 last:border-0">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{b.label}</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 font-mono">{b.value}</p>
            </div>
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                b.score >= 3 ? 'bg-rose-500/20 text-rose-400' : b.score >= 2 ? 'bg-amber-500/20 text-amber-400' : b.score >= 1 ? 'bg-yellow-400/10 text-yellow-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {b.score}
            </span>
          </div>
        ))}
      </div>

      <div className={`mt-4 p-3 rounded-xl ${s.bg} border ${s.border}`}>
        <p className={`text-xs font-bold uppercase tracking-wide ${s.text} mb-1`}>{riskLevel} &mdash; {t('breakdown.escalationGuidance')}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{cfg.escalation[riskLevel] || cfg.escalation.Low}</p>
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-slate-500">
        <p><span className="text-rose-400 font-medium">{cfg.criticalLabel}</span></p>
        <p><span className="text-amber-400 font-medium">{cfg.mediumLabel}</span></p>
        <p><span className="text-emerald-400 font-medium">{cfg.lowLabel}</span></p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CLINICAL HISTORY: medical history + current/past medications
// ---------------------------------------------------------------------------
function ClinicalHistoryCard({ patient }) {
  const { t } = useTranslation();
  const history = patient.medicalHistory || [];
  const currentMeds = patient.currentMedications || [];
  const pastMeds = patient.pastMedications || [];

  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5" data-testid="clinical-history-card">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-violet-500 dark:text-violet-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('clinical.medicalHistory')}</h3>
      </div>
      {history.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('clinical.noHistory')}</p>
      ) : (
        <ul className="space-y-1.5 mb-5">
          {history.map((h, i) => (
            <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('clinical.currentMedications')}</h3>
      </div>
      {currentMeds.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t('clinical.noCurrentMeds')}</p>
      ) : (
        <div className="space-y-1.5 mb-5">
          {currentMeds.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <span className="text-slate-800 dark:text-slate-200 font-medium">{m.name}</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">{m.dose} &middot; {m.frequency}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('clinical.pastMedications')}</h3>
      </div>
      {pastMeds.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('clinical.noPastMeds')}</p>
      ) : (
        <div className="space-y-1.5">
          {pastMeds.map((m, i) => (
            <div key={i} className="text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <span className="text-slate-700 dark:text-slate-300 font-medium">{m.name}</span>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{t('clinical.discontinuedNote')}: {m.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CARE LOG: timestamped free-text entries from nurses/physicians
// ---------------------------------------------------------------------------
function CareLog({ patient, onAddEntry }) {
  const { t, i18n } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [author, setAuthor] = useState('');
  const [role, setRole] = useState('Nurse');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const entries = [...(patient.careLog || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const roleLabels = { Nurse: t('careLog.roleNurse'), Physician: t('careLog.rolePhysician'), Other: t('careLog.roleOther') };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!author.trim() || !text.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setSubmitting(true);
    try {
      await onAddEntry({ author: author.trim(), role, text: text.trim() });
      setText('');
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  function formatTimestamp(iso) {
    try {
      return new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5" data-testid="care-log-card">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('careLog.title')}</h3>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          data-testid="care-log-add-toggle-btn"
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-500"
        >
          <Plus className="w-3.5 h-3.5" /> {t('careLog.addEntry')}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">{t('careLog.subtitle')}</p>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
          {error && (
            <p className="text-xs text-rose-500 dark:text-rose-400">{t('careLog.validationError')}</p>
          )}
          <div className="flex gap-2">
            <input
              data-testid="care-log-author-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={t('careLog.authorName')}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <select
              data-testid="care-log-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              <option value="Nurse">{t('careLog.roleNurse')}</option>
              <option value="Physician">{t('careLog.rolePhysician')}</option>
              <option value="Other">{t('careLog.roleOther')}</option>
            </select>
          </div>
          <textarea
            data-testid="care-log-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('careLog.entryPlaceholder')}
            rows={3}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {t('careLog.cancel')}
            </button>
            <button
              type="submit"
              data-testid="care-log-submit-btn"
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? t('careLog.submitting') : t('careLog.submit')}
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('careLog.noEntries')}</p>
      ) : (
        <div className="space-y-3" data-testid="care-log-entries">
          {entries.map((entry) => (
            <div key={entry.id} className="pb-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {entry.author} <span className="text-xs font-normal text-slate-500 dark:text-slate-500">&middot; {roleLabels[entry.role] || entry.role}</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ALERTS QUEUE
// ---------------------------------------------------------------------------
function AlertsQueue({ alerts, onAcknowledge, onEscalate, onOpenPatient }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{t('alerts.title')}</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('alerts.activeOfTotal', { active: alerts.filter((a) => a.status === 'active').length, total: alerts.length })}
        </p>
      </div>

      <div className="space-y-2.5" data-testid="alerts-list">
        {alerts.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            {t('alerts.noAlerts')}
          </div>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-3">
            <button onClick={() => onOpenPatient(a.patientId)} className="flex items-center gap-2 min-w-[180px] text-left">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.patientName}</p>
                <p className="text-xs text-slate-500">{a.room}</p>
              </div>
            </button>
            <AlertItem alert={a} onAcknowledge={() => onAcknowledge(a.patientId, a.id)} onEscalate={() => onEscalate(a.patientId, a.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertItem({ alert, onAcknowledge, onEscalate, compact }) {
  const { t } = useTranslation();
  const statusStyles = {
    active: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
    acknowledged: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    escalated: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  };
  const statusLabels = { active: t('alerts.active'), acknowledged: t('alerts.acknowledged'), escalated: t('alerts.escalated') };
  return (
    <div className={`flex-1 flex flex-wrap items-center gap-3 ${compact ? 'p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/50' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <AlertTriangle className={`w-4 h-4 shrink-0 ${alert.status === 'active' ? 'text-rose-400' : 'text-slate-500 dark:text-slate-600'}`} />
        <div>
          <p className="text-sm text-slate-800 dark:text-slate-200">{alert.message}</p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> {alert.time} &middot; {alert.protocol}
          </p>
        </div>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${statusStyles[alert.status]}`}>
        {statusLabels[alert.status]}
      </span>
      {alert.status === 'active' && (
        <div className="flex items-center gap-2">
          <button
            data-testid={`acknowledge-${alert.id}-btn`}
            onClick={onAcknowledge}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {t('alerts.acknowledge')}
          </button>
          <button
            data-testid={`escalate-${alert.id}-btn`}
            onClick={onEscalate}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" /> {t('alerts.escalate')}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANALYTICS
// ---------------------------------------------------------------------------
function Analytics({ patients, protocol, cfg, simRunning }) {
  const { t } = useTranslation();
  const riskCounts = { Critical: 0, Medium: 0, 'Low-Medium': 0, Low: 0 };
  patients.forEach((p) => (riskCounts[p.riskLevel] = (riskCounts[p.riskLevel] || 0) + 1));

  const riskData = Object.entries(riskCounts)
    .filter(([k]) => protocol === 'MEWS' ? k !== 'Low-Medium' : true)
    .map(([name, value]) => ({ name, value }));

  const riskColorMap = { Critical: '#f43f5e', Medium: '#f59e0b', 'Low-Medium': '#facc15', Low: '#10b981' };

  const wardMap = {};
  patients.forEach((p) => {
    if (!wardMap[p.ward]) wardMap[p.ward] = { ward: p.ward, total: 0, count: 0 };
    wardMap[p.ward].total += p.score;
    wardMap[p.ward].count += 1;
  });
  const wardData = Object.values(wardMap).map((w) => ({ ward: w.ward.replace(' Ward', ''), avgScore: Math.round((w.total / w.count) * 10) / 10 }));

  const avgScore = Math.round((patients.reduce((sum, p) => sum + p.score, 0) / patients.length) * 10) / 10;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{t('analytics.title')}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{t('analytics.subtitle', { fullName: cfg.fullName, count: patients.length })}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label={t('overview.critical')} value={riskCounts.Critical} risk="Critical" />
        <StatPill label={t('overview.medium')} value={riskCounts.Medium} risk="Medium" />
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-4 py-3">
          <p className="text-2xl font-bold font-mono text-cyan-400">{avgScore}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('analytics.averageScore')}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 px-4 py-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${simRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-500 dark:text-slate-600'}`} />
            <p className={`text-sm font-bold ${simRunning ? 'text-emerald-400' : 'text-slate-500'}`}>{simRunning ? t('analytics.liveTelemetry') : t('analytics.pausedTelemetry')}</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{t('analytics.simulatedFeed')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('analytics.riskDistribution')} subtitle={protocol} icon={PieIconWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {riskData.map((entry) => (
                  <Cell key={entry.name} fill={riskColorMap[entry.name]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('analytics.avgScoreByWard')} subtitle={protocol} icon={BarChart3}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="ward" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>                {wardData.map((entry, i) => (
                  <Cell key={entry.ward} fill={['#38bdf8', '#a78bfa', '#f472b6', '#34d399'][i % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function PieIconWrap(props) {
  return <BarChart3 {...props} />;
}

export default App;
