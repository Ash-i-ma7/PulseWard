import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  Activity, HeartPulse, Wind, Thermometer, Gauge, Brain, AlertTriangle, Bell, BellRing,
  LayoutGrid, BarChart3, Search, Pause, Play, Zap, ChevronRight, ChevronLeft,
  Menu, X, CheckCircle2, ArrowUpCircle, Radio, Clock, User,
} from 'lucide-react';
import {
  INITIAL_PATIENTS, calculateNEWS2, calculateMEWS, getProtocolHistory,
  PROTOCOL_CONFIG, WARDS,
} from './clinicalData';

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
  const tickRef = useRef(null);

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
    if (!simRunning) return undefined;
    tickRef.current = setInterval(runTick, simIntervalMs);
    return () => clearInterval(tickRef.current);
  }, [simRunning, simIntervalMs, runTick]);

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
  }

  function manualPulse() {
    runTick();
    toast.info('Manual vitals refresh triggered');
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans">
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
          />
        )}

        {view === 'alerts' && (
          <AlertsQueue alerts={allAlerts} onAcknowledge={acknowledgeAlert} onEscalate={escalateAlert} onOpenPatient={openPatient} />
        )}

        {view === 'analytics' && <Analytics patients={patientsWithScore} protocol={protocol} cfg={cfg} simRunning={simRunning} />}
      </main>

      <footer className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2 text-xs text-slate-600 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
        Demo data notice: all patients, vitals and alerts are simulated for demonstration. No real clinical records are used.
      </footer>
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
}) {
  const navItems = [
    { key: 'overview', label: 'Ward Census', icon: LayoutGrid },
    { key: 'alerts', label: 'Alert Queue', icon: Bell, badge: activeAlertCount },
    { key: 'analytics', label: 'Ward Analytics', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-[#070b14]/90 border-b border-slate-800/80">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight leading-none">PulseWard</h1>
              <p className="text-[11px] text-slate-500 leading-none mt-1">Early Warning Score Monitor</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                data-testid={`nav-${item.key}-btn`}
                onClick={() => setView(item.key)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === item.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
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
          </div>

          <button
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
            data-testid="mobile-nav-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-[#070b14] px-4 py-4 space-y-4" data-testid="mobile-nav-menu">
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
                  view === item.key ? 'bg-slate-800 text-white' : 'text-slate-400'
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
        </div>
      )}
    </header>
  );
}

function ProtocolSwitch({ protocol, setProtocol, fullWidth }) {
  return (
    <div className={`flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 ${fullWidth ? 'w-full' : ''}`} data-testid="protocol-switch">
      {['NEWS2', 'MEWS'].map((p) => (
        <button
          key={p}
          data-testid={`protocol-${p.toLowerCase()}-btn`}
          onClick={() => setProtocol(p)}
          className={`${fullWidth ? 'flex-1' : 'px-3.5'} py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors ${
            protocol === p ? 'bg-cyan-600 text-white shadow shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function SimControls({ simRunning, setSimRunning, simIntervalMs, setSimIntervalMs, onManualPulse, fullWidth }) {
  return (
    <div className={`flex items-center gap-2 ${fullWidth ? 'w-full' : ''}`}>
      <button
        data-testid="sim-pause-resume-btn"
        onClick={() => setSimRunning((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
          simRunning ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-900 text-slate-400'
        }`}
      >
        {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {simRunning ? 'Live' : 'Paused'}
      </button>

      <select
        data-testid="sim-interval-select"
        value={simIntervalMs}
        onChange={(e) => setSimIntervalMs(Number(e.target.value))}
        className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        <option value={3000}>3s interval</option>
        <option value={5000}>5s interval</option>
        <option value={10000}>10s interval</option>
        <option value={20000}>20s interval</option>
      </select>

      <button
        data-testid="manual-pulse-btn"
        onClick={onManualPulse}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
      >
        <Zap className="w-3.5 h-3.5" />
        Pulse
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OVERVIEW
// ---------------------------------------------------------------------------
function Overview({ patients, totalCount, protocol, cfg, search, setSearch, wardFilter, setWardFilter, riskFilter, setRiskFilter, onOpenPatient }) {
  const riskCounts = { Critical: 0, Medium: 0, 'Low-Medium': 0, Low: 0 };
  patients.forEach((p) => (riskCounts[p.riskLevel] = (riskCounts[p.riskLevel] || 0) + 1));

  const riskFilterOptions = protocol === 'MEWS' ? ['All', 'Critical', 'Medium', 'Low'] : ['All', 'Critical', 'Medium', 'Low-Medium', 'Low'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Ward Census</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalCount} patients &middot; sorted by {protocol} risk &middot; {cfg.fullName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label="Critical" value={riskCounts.Critical} risk="Critical" />
        <StatPill label="Medium" value={riskCounts.Medium} risk="Medium" />
        {protocol === 'NEWS2' && <StatPill label="Low-Medium" value={riskCounts['Low-Medium']} risk="Low-Medium" />}
        <StatPill label="Stable" value={riskCounts.Low} risk="Low" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="patient-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, room or diagnosis..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>
        <select
          data-testid="ward-filter-select"
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {WARDS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <select
          data-testid="risk-filter-select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {riskFilterOptions.map((r) => (
            <option key={r} value={r}>{r === 'All' ? 'All Risk Levels' : r}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5" data-testid="patient-list">
        {patients.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            No patients match the current filters.
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
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function PatientRow({ patient, protocol, onClick }) {
  const s = RISK_STYLES[patient.riskLevel];
  return (
    <button
      data-testid={`patient-row-${patient.id}`}
      onClick={onClick}
      className={`w-full text-left bg-slate-900/80 hover:bg-slate-900 border ${s.border} rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 transition-colors group`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${s.dot} ${patient.riskLevel === 'Critical' ? 'animate-pulse' : ''} shrink-0`} />

      <div className="min-w-[160px] flex-1">
        <p className="font-semibold text-white text-sm">{patient.name}</p>
        <p className="text-xs text-slate-500">{patient.room} &middot; {patient.ward}</p>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 font-mono">
        <VitalChip icon={HeartPulse} value={`${patient.vitals.hr}`} unit="bpm" />
        <VitalChip icon={Wind} value={`${patient.vitals.respRate}`} unit="rpm" />
        <VitalChip icon={Gauge} value={`${patient.vitals.spo2}`} unit="%" />
        <VitalChip icon={Thermometer} value={`${patient.vitals.temp.toFixed(1)}`} unit="°C" />
      </div>

      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${s.bg} ${s.border} border`}>
        <span className={`text-lg font-bold font-mono ${s.text}`}>{patient.score}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${s.text}`}>{patient.riskLevel}</span>
      </div>

      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 shrink-0" />
    </button>
  );
}

function VitalChip({ icon: Icon, value, unit }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="w-3.5 h-3.5 text-slate-600" />
      {value}<span className="text-slate-600">{unit}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// PATIENT DETAIL
// ---------------------------------------------------------------------------
function PatientDetail({ patient, allPatients, protocol, cfg, onSelectPatient, onBack, onAcknowledge, onEscalate }) {
  const s = RISK_STYLES[patient.riskLevel];
  const history = useMemo(() => getProtocolHistory(patient, protocol), [patient, protocol]);
  const currentIndex = allPatients.findIndex((p) => p.id === patient.id);

  function stepPatient(dir) {
    const next = allPatients[(currentIndex + dir + allPatients.length) % allPatients.length];
    onSelectPatient(next.id);
  }

  return (
    <div className="space-y-6" data-testid="patient-detail-view">
      <div className="flex items-center gap-3">
        <button onClick={onBack} data-testid="back-to-census-btn" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
          <ChevronLeft className="w-4 h-4" /> Ward Census
        </button>
      </div>

      <div className={`rounded-2xl border ${s.border} bg-slate-900/70 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => stepPatient(-1)} data-testid="prev-patient-btn" className="p-2 rounded-lg hover:bg-slate-800 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-display text-xl font-bold text-white">{patient.name}</h2>
              <p className="text-sm text-slate-500">
                {patient.age}{patient.gender} &middot; {patient.room} &middot; {patient.ward} &middot; Admitted {patient.admissionDate}
              </p>
              <p className="text-sm text-slate-400 mt-1">{patient.diagnosis}</p>
              <p className="text-xs text-slate-600 mt-0.5">{patient.attending}</p>
            </div>
            <button onClick={() => stepPatient(1)} data-testid="next-patient-btn" className="p-2 rounded-lg hover:bg-slate-800 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <select
            data-testid="patient-selector-dropdown"
            value={patient.id}
            onChange={(e) => onSelectPatient(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
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
          <VitalCard icon={HeartPulse} label="Heart Rate" value={patient.vitals.hr} unit="bpm" tone="rose" />
          <VitalCard icon={Wind} label="Resp Rate" value={patient.vitals.respRate} unit="rpm" tone="sky" />
          <VitalCard icon={Gauge} label="SpO2" value={patient.vitals.spo2} unit="%" tone="emerald" />
          <VitalCard icon={Thermometer} label="Temperature" value={patient.vitals.temp.toFixed(1)} unit="°C" tone="amber" />
          <VitalCard icon={Activity} label="Blood Pressure" value={`${patient.vitals.bpSys}/${patient.vitals.bpDia}`} unit="mmHg" tone="violet" />
          <VitalCard icon={Brain} label="Consciousness" value={patient.breakdown.consciousness.value} unit="" tone="cyan" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartCard title="Heart Rate & Respiration Trend" subtitle="Last 6 telemetry points" icon={HeartPulse}>
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

          <ChartCard title={`SpO2 & ${protocol} Score Trend`} subtitle="Escalation tracker" icon={Activity}>
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
                  label={{ value: `Critical >=${cfg.criticalThreshold}`, fill: '#ef4444', fontSize: 10 }}
                />
                <Line yAxisId="left" type="monotone" dataKey="spo2" stroke="#34d399" strokeWidth={2.5} name="SpO2 (%)" dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="protocolScore" stroke="#f59e0b" strokeWidth={3} name={`${protocol} Score`} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {patient.notes && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-1.5">Clinical Notes</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{patient.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <ScoreBreakdown breakdown={patient.breakdown} cfg={cfg} score={patient.score} riskLevel={patient.riskLevel} protocol={protocol} />

          {patient.alerts.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-rose-400" /> Patient Alerts
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
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">{title}</h3>
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
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${toneMap[tone]}`} />
        {label}
      </div>
      <p className="font-mono font-bold text-white text-lg leading-none">
        {value}<span className="text-xs text-slate-500 ml-1 font-normal">{unit}</span>
      </p>
    </div>
  );
}

function ScoreBreakdown({ breakdown, cfg, score, riskLevel, protocol }) {
  const s = RISK_STYLES[riskLevel];
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5" data-testid="score-breakdown-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{protocol} Component Breakdown</h3>
        <span className={`text-sm font-bold font-mono ${s.text}`}>{score} pts</span>
      </div>
      <div className="space-y-1.5">
        {Object.values(breakdown).map((b) => (
          <div key={b.label} className="flex items-center justify-between py-1.5 border-b border-slate-800/70 last:border-0">
            <div>
              <p className="text-xs text-slate-400">{b.label}</p>
              <p className="text-sm text-slate-200 font-mono">{b.value}</p>
            </div>
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                b.score >= 3 ? 'bg-rose-500/20 text-rose-400' : b.score >= 2 ? 'bg-amber-500/20 text-amber-400' : b.score >= 1 ? 'bg-yellow-400/10 text-yellow-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {b.score}
            </span>
          </div>
        ))}
      </div>

      <div className={`mt-4 p-3 rounded-xl ${s.bg} border ${s.border}`}>
        <p className={`text-xs font-bold uppercase tracking-wide ${s.text} mb-1`}>{riskLevel} &mdash; Escalation Guidance</p>
        <p className="text-xs text-slate-300 leading-relaxed">{cfg.escalation[riskLevel] || cfg.escalation.Low}</p>
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
// ALERTS QUEUE
// ---------------------------------------------------------------------------
function AlertsQueue({ alerts, onAcknowledge, onEscalate, onOpenPatient }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-white">Alert Queue</h2>
        <p className="text-sm text-slate-500 mt-0.5">{alerts.filter((a) => a.status === 'active').length} active of {alerts.length} total alerts</p>
      </div>

      <div className="space-y-2.5" data-testid="alerts-list">
        {alerts.length === 0 && (
          <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            No alerts have been raised.
          </div>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3.5 flex flex-wrap items-center gap-3">
            <button onClick={() => onOpenPatient(a.patientId)} className="flex items-center gap-2 min-w-[180px] text-left">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-white">{a.patientName}</p>
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
  const statusStyles = {
    active: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
    acknowledged: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    escalated: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  };
  return (
    <div className={`flex-1 flex flex-wrap items-center gap-3 ${compact ? 'p-2.5 rounded-lg bg-slate-950/50' : ''}`}>
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <AlertTriangle className={`w-4 h-4 shrink-0 ${alert.status === 'active' ? 'text-rose-400' : 'text-slate-600'}`} />
        <div>
          <p className="text-sm text-slate-200">{alert.message}</p>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> {alert.time} &middot; {alert.protocol}
          </p>
        </div>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${statusStyles[alert.status]}`}>
        {alert.status}
      </span>
      {alert.status === 'active' && (
        <div className="flex items-center gap-2">
          <button
            data-testid={`acknowledge-${alert.id}-btn`}
            onClick={onAcknowledge}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-400"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
          </button>
          <button
            data-testid={`escalate-${alert.id}-btn`}
            onClick={onEscalate}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" /> Escalate / RRT
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
        <h2 className="font-display text-2xl font-bold text-white">Ward Analytics</h2>
        <p className="text-sm text-slate-500 mt-0.5">{cfg.fullName} risk distribution across {patients.length} patients</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill label="Critical" value={riskCounts.Critical} risk="Critical" />
        <StatPill label="Medium" value={riskCounts.Medium} risk="Medium" />
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <p className="text-2xl font-bold font-mono text-cyan-400">{avgScore}</p>
          <p className="text-xs text-slate-400 mt-0.5">Average Score</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${simRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <p className={`text-sm font-bold ${simRunning ? 'text-emerald-400' : 'text-slate-500'}`}>{simRunning ? 'Live Telemetry' : 'Paused'}</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Simulated demo feed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Risk Distribution" subtitle={protocol} icon={PieIconWrap}>
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

        <ChartCard title="Average Score by Ward" subtitle={protocol} icon={BarChart3}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="ward" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                {wardData.map((entry, i) => (
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
