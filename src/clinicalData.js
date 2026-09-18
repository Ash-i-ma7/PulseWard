// clinicalData.js
// Demo patient data and protocol-correct NEWS2 / MEWS early warning score calculators.
// All patient data below is MOCKED demo data for the PulseWard dashboard. No real
// clinical records, telemetry, or external clinical integration is used.

export const INITIAL_PATIENTS = [
  {
    id: 'P-101',
    name: 'Eleanor Vance',
    age: 72,
    gender: 'F',
    room: 'ICU-302',
    ward: 'Cardiology Ward',
    diagnosis: 'Acute Myocardial Infarction / Post-PCI',
    attending: 'Dr. Marcus Vance, MD',
    admissionDate: '2026-06-12',
    status: 'critical', // stable, monitoring, warning, critical
    vitals: {
      hr: 128,
      bpSys: 168,
      bpDia: 96,
      respRate: 28,
      spo2: 91,
      spo2Scale2: false,
      temp: 38.6,
      consciousness: 'U', // A (Alert), V (Voice), P (Pain), U (Unresponsive)
      oxygenSupport: true,
    },
    vitalsHistory: [
      { time: '10:00', hr: 92, bpSys: 130, bpDia: 82, respRate: 18, spo2: 97, temp: 37.0, news: 1 },
      { time: '11:00', hr: 98, bpSys: 138, bpDia: 85, respRate: 20, spo2: 96, temp: 37.2, news: 3 },
      { time: '12:00', hr: 110, bpSys: 150, bpDia: 90, respRate: 24, spo2: 94, temp: 37.9, news: 6 },
      { time: '13:00', hr: 128, bpSys: 168, bpDia: 96, respRate: 28, spo2: 91, temp: 38.6, news: 11 },
    ],
    alerts: [
      { id: 'ALT-501', time: '13:02', type: 'CRITICAL_NEWS', message: 'NEWS2 score surged to 11 (Critical Threshold >= 7)', status: 'active', protocol: 'NEWS2' },
      { id: 'ALT-502', time: '12:58', type: 'HYPER_RESP', message: 'Tachypnea detected: Resp Rate 28 bpm', status: 'acknowledged', protocol: 'NEWS2' },
    ],
    notes: 'Patient showing acute respiratory distress and tachycardia. Rapid response team notified.',
    allergies: ['Penicillin (rash)', 'Iodinated contrast media (anaphylaxis)'],
    medicalHistory: ['Type 2 Diabetes Mellitus (12 years)', 'Hypertension', 'Prior MI (2021)', 'Chronic Kidney Disease Stage 2'],
    currentMedications: [
      { name: 'Aspirin', dose: '75mg', frequency: 'OD' },
      { name: 'Atorvastatin', dose: '40mg', frequency: 'OD (night)' },
      { name: 'Metoprolol', dose: '25mg', frequency: 'BD' },
      { name: 'Insulin Glargine', dose: '18 units', frequency: 'OD (night)' },
    ],
    pastMedications: [
      { name: 'Clopidogrel', note: 'Discontinued post-PCI, switched to Ticagrelor' },
      { name: 'Ramipril', note: 'Stopped 2023 — persistent dry cough' },
    ],
    careLog: [
      { id: 'CL-101-1', author: 'Dr. Marcus Vance', role: 'Physician', text: 'Post-PCI, stable overnight. Continue dual antiplatelet therapy, monitor for bleeding.', timestamp: '2026-06-12T09:15:00' },
    ],
  },
  {
    id: 'P-102',
    name: 'Arthur Pendelton',
    age: 65,
    gender: 'M',
    room: 'MED-204',
    ward: 'Medical Ward',
    diagnosis: 'Severe Pneumonia & Sepsis Risk',
    attending: 'Dr. Sarah Lin, MD',
    admissionDate: '2026-06-14',
    status: 'warning',
    vitals: {
      hr: 112,
      bpSys: 104,
      bpDia: 64,
      respRate: 24,
      spo2: 93,
      spo2Scale2: true, // COPD patient on scale 2 (88-92%)
      temp: 38.2,
      consciousness: 'V',
      oxygenSupport: true,
    },
    vitalsHistory: [
      { time: '10:00', hr: 88, bpSys: 120, bpDia: 78, respRate: 18, spo2: 94, temp: 37.4, news: 2 },
      { time: '11:00', hr: 96, bpSys: 114, bpDia: 72, respRate: 21, spo2: 93, temp: 37.8, news: 4 },
      { time: '12:00', hr: 104, bpSys: 110, bpDia: 68, respRate: 22, spo2: 93, temp: 38.0, news: 5 },
      { time: '13:00', hr: 112, bpSys: 104, bpDia: 64, respRate: 24, spo2: 93, temp: 38.2, news: 6 },
    ],
    alerts: [
      { id: 'ALT-503', time: '13:01', type: 'MEDIUM_RISK', message: 'NEWS2 score reached 6 (Medium Risk)', status: 'active', protocol: 'NEWS2' },
    ],
    notes: 'COPD baseline SpO2 configured to Scale 2 (88-92%). Monitor closely for CO2 retention.',
    allergies: ['Sulfa drugs (rash)'],
    medicalHistory: ['COPD (GOLD Stage 3)', 'Ex-smoker (40 pack-years, quit 2019)', 'Hypertension'],
    currentMedications: [
      { name: 'Amoxicillin-Clavulanate', dose: '625mg', frequency: 'TDS' },
      { name: 'Tiotropium', dose: '18mcg', frequency: 'OD (inhaled)' },
      { name: 'Salbutamol', dose: '2 puffs', frequency: 'PRN' },
      { name: 'Prednisolone', dose: '30mg', frequency: 'OD (tapering)' },
    ],
    pastMedications: [
      { name: 'Doxycycline', note: 'Course completed prior admission, no response' },
    ],
    careLog: [
      { id: 'CL-102-1', author: 'Dr. Sarah Lin', role: 'Physician', text: 'Started empirical antibiotics for suspected pneumonia. Sputum culture pending.', timestamp: '2026-06-14T11:20:00' },
    ],
  },
  {
    id: 'P-103',
    name: 'Margaret Chen',
    age: 58,
    gender: 'F',
    room: 'MED-208',
    ward: 'Medical Ward',
    diagnosis: 'Post-Op Colectomy Recovery',
    attending: 'Dr. James Wilson, MD',
    admissionDate: '2026-06-15',
    status: 'stable',
    vitals: {
      hr: 76,
      bpSys: 122,
      bpDia: 78,
      respRate: 16,
      spo2: 98,
      spo2Scale2: false,
      temp: 36.8,
      consciousness: 'A',
      oxygenSupport: false,
    },
    vitalsHistory: [
      { time: '10:00', hr: 78, bpSys: 124, bpDia: 80, respRate: 16, spo2: 98, temp: 36.7, news: 0 },
      { time: '11:00', hr: 75, bpSys: 120, bpDia: 76, respRate: 16, spo2: 99, temp: 36.8, news: 0 },
      { time: '12:00', hr: 74, bpSys: 122, bpDia: 78, respRate: 15, spo2: 98, temp: 36.8, news: 0 },
      { time: '13:00', hr: 76, bpSys: 122, bpDia: 78, respRate: 16, spo2: 98, temp: 36.8, news: 0 },
    ],
    alerts: [],
    notes: 'Recovery progressing smoothly. Vitals stable across all parameters.',
    allergies: ['No known drug allergies'],
    medicalHistory: ['Diverticulosis', 'Osteoarthritis'],
    currentMedications: [
      { name: 'Paracetamol', dose: '1g', frequency: 'QDS PRN' },
      { name: 'Enoxaparin', dose: '40mg', frequency: 'OD (VTE prophylaxis)' },
    ],
    pastMedications: [],
    careLog: [
      { id: 'CL-103-1', author: 'Dr. James Wilson', role: 'Physician', text: 'POD-3, tolerating oral diet, bowel sounds present. Plan for discharge tomorrow if stable.', timestamp: '2026-06-15T08:40:00' },
    ],
  },
  {
    id: 'P-104',
    name: 'Robert Thorne',
    age: 81,
    gender: 'M',
    room: 'GER-105',
    ward: 'Geriatric Ward',
    diagnosis: 'Congestive Heart Failure Exacerbation',
    attending: 'Dr. Emily Watson, MD',
    admissionDate: '2026-06-11',
    status: 'warning',
    vitals: {
      hr: 104,
      bpSys: 92,
      bpDia: 58,
      respRate: 25,
      spo2: 92,
      spo2Scale2: false,
      temp: 37.1,
      consciousness: 'V',
      oxygenSupport: true,
    },
    vitalsHistory: [
      { time: '10:00', hr: 95, bpSys: 102, bpDia: 64, respRate: 22, spo2: 93, temp: 37.0, news: 4 },
      { time: '11:00', hr: 98, bpSys: 98, bpDia: 60, respRate: 23, spo2: 92, temp: 37.1, news: 5 },
      { time: '12:00', hr: 102, bpSys: 95, bpDia: 59, respRate: 24, spo2: 92, temp: 37.1, news: 6 },
      { time: '13:00', hr: 104, bpSys: 92, bpDia: 58, respRate: 25, spo2: 92, temp: 37.1, news: 7 },
    ],
    alerts: [
      { id: 'ALT-504', time: '13:00', type: 'HYPOTENSION', message: 'Systolic BP dropped to 92 mmHg (Score 2)', status: 'active', protocol: 'NEWS2' },
    ],
    notes: 'Diuresis ongoing. Watch for orthostatic hypotension and renal function.',
    allergies: ['ACE inhibitors (angioedema)'],
    medicalHistory: ['Congestive Heart Failure (EF 35%)', 'Atrial Fibrillation', 'Stage 3 CKD', 'Gout'],
    currentMedications: [
      { name: 'Furosemide', dose: '40mg', frequency: 'BD IV' },
      { name: 'Apixaban', dose: '2.5mg', frequency: 'BD' },
      { name: 'Bisoprolol', dose: '2.5mg', frequency: 'OD' },
      { name: 'Allopurinol', dose: '100mg', frequency: 'OD' },
    ],
    pastMedications: [
      { name: 'Lisinopril', note: 'Stopped — angioedema reaction' },
      { name: 'Spironolactone', note: 'Held due to rising potassium' },
    ],
    careLog: [
      { id: 'CL-104-1', author: 'Dr. Emily Watson', role: 'Physician', text: 'Increasing diuretic dose, daily weights and strict fluid balance. Renal function to be rechecked in AM.', timestamp: '2026-06-11T14:05:00' },
    ],
  },
  {
    id: 'P-105',
    name: 'Sofia Rodriguez',
    age: 42,
    gender: 'F',
    room: 'SURG-412',
    ward: 'Surgical Ward',
    diagnosis: 'Appendectomy Recovery',
    attending: 'Dr. Robert Chen, MD',
    admissionDate: '2026-06-16',
    status: 'stable',
    vitals: {
      hr: 72,
      bpSys: 118,
      bpDia: 76,
      respRate: 14,
      spo2: 99,
      spo2Scale2: false,
      temp: 36.6,
      consciousness: 'A',
      oxygenSupport: false,
    },
    vitalsHistory: [
      { time: '10:00', hr: 74, bpSys: 120, bpDia: 78, respRate: 14, spo2: 99, temp: 36.6, news: 0 },
      { time: '11:00', hr: 72, bpSys: 118, bpDia: 76, respRate: 14, spo2: 99, temp: 36.6, news: 0 },
      { time: '12:00', hr: 70, bpSys: 116, bpDia: 74, respRate: 14, spo2: 100, temp: 36.6, news: 0 },
      { time: '13:00', hr: 72, bpSys: 118, bpDia: 76, respRate: 14, spo2: 99, temp: 36.6, news: 0 },
    ],
    alerts: [],
    notes: 'Pain well controlled with oral analgesia. Ambulating well.',
    allergies: ['Latex (contact dermatitis)'],
    medicalHistory: ['None significant'],
    currentMedications: [
      { name: 'Ibuprofen', dose: '400mg', frequency: 'TDS PRN' },
      { name: 'Paracetamol', dose: '1g', frequency: 'QDS' },
    ],
    pastMedications: [],
    careLog: [],
  },
  {
    id: 'P-106',
    name: 'William Hawkins',
    age: 69,
    gender: 'M',
    room: 'ICU-304',
    ward: 'Cardiology Ward',
    diagnosis: 'Unstable Angina & Hypertension',
    attending: 'Dr. Marcus Vance, MD',
    admissionDate: '2026-06-13',
    status: 'monitoring',
    vitals: {
      hr: 88,
      bpSys: 146,
      bpDia: 92,
      respRate: 18,
      spo2: 95,
      spo2Scale2: false,
      temp: 37.0,
      consciousness: 'A',
      oxygenSupport: false,
    },
    vitalsHistory: [
      { time: '10:00', hr: 84, bpSys: 152, bpDia: 95, respRate: 18, spo2: 95, temp: 37.0, news: 2 },
      { time: '11:00', hr: 86, bpSys: 148, bpDia: 94, respRate: 18, spo2: 95, temp: 37.0, news: 2 },
      { time: '12:00', hr: 87, bpSys: 146, bpDia: 92, respRate: 18, spo2: 95, temp: 37.0, news: 2 },
      { time: '13:00', hr: 88, bpSys: 146, bpDia: 92, respRate: 18, spo2: 95, temp: 37.0, news: 2 },
    ],
    alerts: [],
    notes: 'Titrating antihypertensive medications. Blood pressure trending downwards towards target.',
    allergies: ['No known drug allergies'],
    medicalHistory: ['Hypertension (15 years)', 'Hyperlipidemia', 'Unstable Angina'],
    currentMedications: [
      { name: 'Amlodipine', dose: '10mg', frequency: 'OD' },
      { name: 'Isosorbide Mononitrate', dose: '30mg', frequency: 'OD' },
      { name: 'Rosuvastatin', dose: '20mg', frequency: 'OD (night)' },
    ],
    pastMedications: [
      { name: 'Losartan', note: 'Switched to Amlodipine — inadequate control' },
    ],
    careLog: [
      { id: 'CL-106-1', author: 'Dr. Marcus Vance', role: 'Physician', text: 'BP trending down on current regimen. Continue monitoring, consider stress test if stable.', timestamp: '2026-06-13T10:30:00' },
    ],
  },
  {
    id: 'P-107',
    name: 'Aisha Patel',
    age: 51,
    gender: 'F',
    room: 'MED-210',
    ward: 'Medical Ward',
    diagnosis: 'Acute Diabetic Ketoacidosis (Resolving)',
    attending: 'Dr. Sarah Lin, MD',
    admissionDate: '2026-06-15',
    status: 'monitoring',
    vitals: {
      hr: 94,
      bpSys: 128,
      bpDia: 80,
      respRate: 20,
      spo2: 97,
      spo2Scale2: false,
      temp: 37.2,
      consciousness: 'A',
      oxygenSupport: false,
    },
    vitalsHistory: [
      { time: '10:00', hr: 102, bpSys: 122, bpDia: 76, respRate: 22, spo2: 96, temp: 37.4, news: 3 },
      { time: '11:00', hr: 98, bpSys: 124, bpDia: 78, respRate: 21, spo2: 97, temp: 37.3, news: 2 },
      { time: '12:00', hr: 95, bpSys: 126, bpDia: 80, respRate: 20, spo2: 97, temp: 37.2, news: 1 },
      { time: '13:00', hr: 94, bpSys: 128, bpDia: 80, respRate: 20, spo2: 97, temp: 37.2, news: 1 },
    ],
    alerts: [],
    notes: 'Anion gap closed. Blood glucose stable on insulin protocol.',
    allergies: ['Codeine (nausea)'],
    medicalHistory: ['Type 1 Diabetes Mellitus (18 years)', 'Diabetic retinopathy'],
    currentMedications: [
      { name: 'Insulin Aspart', dose: 'Sliding scale', frequency: 'Pre-meal' },
      { name: 'Insulin Glargine', dose: '22 units', frequency: 'OD (night)' },
      { name: 'IV Normal Saline', dose: '1L', frequency: 'Rate per protocol' },
    ],
    pastMedications: [],
    careLog: [
      { id: 'CL-107-1', author: 'Dr. Sarah Lin', role: 'Physician', text: 'DKA resolved, anion gap closed. Transitioning from IV to subcutaneous insulin.', timestamp: '2026-06-15T16:00:00' },
    ],
  },
  {
    id: 'P-108',
    name: "David O'Connor",
    age: 78,
    gender: 'M',
    room: 'GER-102',
    ward: 'Geriatric Ward',
    diagnosis: 'Aspiration Pneumonia & Delirium',
    attending: 'Dr. Emily Watson, MD',
    admissionDate: '2026-06-10',
    status: 'critical',
    vitals: {
      hr: 122,
      bpSys: 90,
      bpDia: 54,
      respRate: 30,
      spo2: 89,
      spo2Scale2: false,
      temp: 39.1,
      consciousness: 'P', // Responds to Pain
      oxygenSupport: true,
    },
    vitalsHistory: [
      { time: '10:00', hr: 110, bpSys: 100, bpDia: 60, respRate: 26, spo2: 92, temp: 38.5, news: 7 },
      { time: '11:00', hr: 115, bpSys: 96, bpDia: 58, respRate: 28, spo2: 91, temp: 38.8, news: 9 },
      { time: '12:00', hr: 118, bpSys: 92, bpDia: 56, respRate: 29, spo2: 90, temp: 39.0, news: 10 },
      { time: '13:00', hr: 122, bpSys: 90, bpDia: 54, respRate: 30, spo2: 89, temp: 39.1, news: 12 },
    ],
    alerts: [
      { id: 'ALT-505', time: '13:00', type: 'CRITICAL_ALERT', message: 'NEWS2 Score 12 - Immediate ICU transfer and physician evaluation required', status: 'active', protocol: 'NEWS2' },
    ],
    notes: 'Declining neurological and respiratory status. Transfer to ICU initiated.',
    allergies: ['Morphine (severe respiratory depression)', 'Shellfish (anaphylaxis)'],
    medicalHistory: ['Dementia (moderate)', 'Prior CVA (2023, residual left-sided weakness)', 'Recurrent aspiration pneumonia'],
    currentMedications: [
      { name: 'Piperacillin-Tazobactam', dose: '4.5g', frequency: 'TDS IV' },
      { name: 'Paracetamol', dose: '1g', frequency: 'QDS IV' },
      { name: 'Donepezil', dose: '10mg', frequency: 'OD (night)' },
    ],
    pastMedications: [
      { name: 'Risperidone', note: 'Discontinued — increased fall risk' },
    ],
    careLog: [
      { id: 'CL-108-1', author: 'Dr. Emily Watson', role: 'Physician', text: 'Deteriorating respiratory status, escalating oxygen requirement. ICU outreach team informed, transfer arranged.', timestamp: '2026-06-10T13:00:00' },
    ],
  },
];

// --- NEWS2 ---
// Parameters: Resp Rate, SpO2 Scale 1/2, Air/Oxygen, Systolic BP, Pulse, Consciousness (AVPU), Temperature
export function calculateNEWS2(vitals) {
  let score = 0;
  const breakdown = {};

  // 1. Respiration Rate
  const rr = vitals.respRate;
  let rrScore = 0;
  if (rr <= 8) rrScore = 3;
  else if (rr <= 11) rrScore = 1;
  else if (rr <= 20) rrScore = 0;
  else if (rr <= 24) rrScore = 2;
  else rrScore = 3;
  breakdown.respRate = { value: `${rr} /min`, score: rrScore, label: 'Respiration Rate' };
  score += rrScore;

  // 2. SpO2 (Scale 1: standard; Scale 2: hypercapnic respiratory failure, target 88-92%)
  const spo2 = vitals.spo2;
  let spo2Score = 0;
  if (vitals.spo2Scale2) {
    if (spo2 <= 83) spo2Score = 3;
    else if (spo2 <= 85) spo2Score = 2;
    else if (spo2 <= 87) spo2Score = 1;
    else if (spo2 <= 92) spo2Score = vitals.oxygenSupport ? 0 : 0;
    else if (spo2 <= 94) spo2Score = vitals.oxygenSupport ? 1 : 0;
    else if (spo2 <= 96) spo2Score = vitals.oxygenSupport ? 2 : 0;
    else spo2Score = vitals.oxygenSupport ? 3 : 0;
  } else {
    if (spo2 <= 91) spo2Score = 3;
    else if (spo2 <= 93) spo2Score = 2;
    else if (spo2 <= 95) spo2Score = 1;
    else spo2Score = 0;
  }
  breakdown.spo2 = { value: `${spo2}%${vitals.spo2Scale2 ? ' (Scale 2)' : ''}`, score: spo2Score, label: 'Oxygen Saturation (SpO2)' };
  score += spo2Score;

  // 3. Air or Oxygen
  const o2Score = vitals.oxygenSupport ? 2 : 0;
  breakdown.oxygenSupport = { value: vitals.oxygenSupport ? 'Supplemental Oxygen' : 'Room Air', score: o2Score, label: 'Air or Oxygen' };
  score += o2Score;

  // 4. Systolic Blood Pressure
  const sbp = vitals.bpSys;
  let sbpScore = 0;
  if (sbp <= 90) sbpScore = 3;
  else if (sbp <= 100) sbpScore = 2;
  else if (sbp <= 110) sbpScore = 1;
  else if (sbp <= 219) sbpScore = 0;
  else sbpScore = 3;
  breakdown.bpSys = { value: `${sbp} mmHg`, score: sbpScore, label: 'Systolic Blood Pressure' };
  score += sbpScore;

  // 5. Heart Rate / Pulse
  const hr = vitals.hr;
  let hrScore = 0;
  if (hr <= 40) hrScore = 3;
  else if (hr <= 50) hrScore = 1;
  else if (hr <= 90) hrScore = 0;
  else if (hr <= 110) hrScore = 1;
  else if (hr <= 130) hrScore = 2;
  else hrScore = 3;
  breakdown.hr = { value: `${hr} bpm`, score: hrScore, label: 'Heart Rate / Pulse' };
  score += hrScore;

  // 6. Consciousness (AVPU) - anything other than Alert scores 3
  const c = vitals.consciousness;
  const cScore = c === 'A' ? 0 : 3;
  breakdown.consciousness = { value: avpuLabel(c), score: cScore, label: 'Level of Consciousness (AVPU)' };
  score += cScore;

  // 7. Temperature
  const temp = vitals.temp;
  let tempScore = 0;
  if (temp <= 35.0) tempScore = 3;
  else if (temp <= 36.0) tempScore = 1;
  else if (temp <= 38.0) tempScore = 0;
  else if (temp <= 39.0) tempScore = 1;
  else tempScore = 2;
  breakdown.temp = { value: `${temp.toFixed(1)}°C`, score: tempScore, label: 'Temperature' };
  score += tempScore;

  const hasRedFlag = Object.values(breakdown).some((b) => b.score === 3);
  let riskLevel = 'Low';
  if (score >= 7 || hasRedFlag) riskLevel = 'Critical';
  else if (score >= 5) riskLevel = 'Medium';
  else if (score >= 1) riskLevel = 'Low-Medium';

  return { protocol: 'NEWS2', score, riskLevel, breakdown };
}

// --- MEWS (Modified Early Warning Score) ---
// Parameters: Systolic BP, Heart Rate, Respiratory Rate, Temperature, AVPU Consciousness
export function calculateMEWS(vitals) {
  let score = 0;
  const breakdown = {};

  // 1. Systolic BP
  const sbp = vitals.bpSys;
  let sbpScore = 0;
  if (sbp <= 70) sbpScore = 3;
  else if (sbp <= 80) sbpScore = 2;
  else if (sbp <= 100) sbpScore = 1;
  else if (sbp <= 199) sbpScore = 0;
  else sbpScore = 2;
  breakdown.bpSys = { value: `${sbp} mmHg`, score: sbpScore, label: 'Systolic Blood Pressure' };
  score += sbpScore;

  // 2. Heart Rate
  const hr = vitals.hr;
  let hrScore = 0;
  if (hr <= 40) hrScore = 2;
  else if (hr <= 50) hrScore = 1;
  else if (hr <= 100) hrScore = 0;
  else if (hr <= 110) hrScore = 1;
  else if (hr <= 129) hrScore = 2;
  else hrScore = 3;
  breakdown.hr = { value: `${hr} bpm`, score: hrScore, label: 'Heart Rate' };
  score += hrScore;

  // 3. Respiratory Rate
  const rr = vitals.respRate;
  let rrScore = 0;
  if (rr < 9) rrScore = 2;
  else if (rr <= 14) rrScore = 0;
  else if (rr <= 20) rrScore = 1;
  else if (rr <= 29) rrScore = 2;
  else rrScore = 3;
  breakdown.respRate = { value: `${rr} /min`, score: rrScore, label: 'Respiration Rate' };
  score += rrScore;

  // 4. Temperature
  const temp = vitals.temp;
  let tempScore = 0;
  if (temp < 35.0) tempScore = 2;
  else if (temp <= 38.4) tempScore = 0;
  else tempScore = 2;
  breakdown.temp = { value: `${temp.toFixed(1)}°C`, score: tempScore, label: 'Temperature' };
  score += tempScore;

  // 5. AVPU
  const c = vitals.consciousness;
  let cScore = 0;
  if (c === 'A') cScore = 0;
  else if (c === 'V') cScore = 1;
  else if (c === 'P') cScore = 2;
  else cScore = 3;
  breakdown.consciousness = { value: avpuLabel(c), score: cScore, label: 'AVPU Consciousness' };
  score += cScore;

  const hasRedFlag = Object.values(breakdown).some((b) => b.score >= 3);
  let riskLevel = 'Low';
  if (score >= 5 || hasRedFlag) riskLevel = 'Critical';
  else if (score >= 3) riskLevel = 'Medium';

  return { protocol: 'MEWS', score, riskLevel, breakdown };
}

function avpuLabel(c) {
  if (c === 'A') return 'Alert (A)';
  if (c === 'V') return 'Voice (V)';
  if (c === 'P') return 'Pain (P)';
  return 'Unresponsive (U)';
}

// Protocol-level configuration used throughout the UI so thresholds, filters and
// escalation guidance always match the currently selected protocol.
export const PROTOCOL_CONFIG = {
  NEWS2: {
    label: 'NEWS2',
    fullName: 'National Early Warning Score 2',
    criticalThreshold: 7,
    mediumThreshold: 5,
    criticalLabel: 'Critical (>=7 or any red-flag parameter)',
    mediumLabel: 'Medium (5-6)',
    lowLabel: 'Low (0-4)',
    escalation: {
      Critical: 'Escalate to the rapid response / ICU outreach team immediately. Continuous monitoring required.',
      Medium: 'Increase observation frequency to hourly and inform the registrar or nurse in charge.',
      'Low-Medium': 'Increase observation frequency and reassess within the next round.',
      Low: 'Continue routine observations per ward schedule.',
    },
  },
  MEWS: {
    label: 'MEWS',
    fullName: 'Modified Early Warning Score',
    criticalThreshold: 5,
    mediumThreshold: 3,
    criticalLabel: 'Critical (>=5 or any red-flag parameter)',
    mediumLabel: 'Medium (3-4)',
    lowLabel: 'Low (0-2)',
    escalation: {
      Critical: 'Escalate to the rapid response team and attending physician immediately.',
      Medium: 'Increase observation frequency and notify the nurse in charge.',
      Low: 'Continue routine observations per ward schedule.',
    },
  },
};

// Estimate a plausible AVPU state for an earlier history point from its NEWS2 score,
// since only the current AVPU state is recorded in the demo vitals object.
function estimateConsciousness(newsScoreAtPoint, isLatest, currentConsciousness) {
  if (isLatest) return currentConsciousness;
  if (newsScoreAtPoint >= 9) return 'U';
  if (newsScoreAtPoint >= 6) return 'P';
  if (newsScoreAtPoint >= 3) return 'V';
  return 'A';
}

// Builds a protocol-aware score trend for a patient: NEWS2 uses the recorded score
// directly, MEWS is recalculated per point with MEWS-specific rules so the two
// protocols never share the same trend line or thresholds.
export function getProtocolHistory(patient, protocol) {
  const points = patient.vitalsHistory;
  return points.map((point, idx) => {
    const isLatest = idx === points.length - 1;
    // The latest point always reflects the patient's live vitals object exactly,
    // so the end of the trend line never drifts from the score shown elsewhere
    // in the UI (this class of mismatch was a defect in an earlier build).
    const snapshot = isLatest
      ? patient.vitals
      : {
          hr: point.hr,
          bpSys: point.bpSys,
          bpDia: point.bpDia,
          respRate: point.respRate,
          spo2: point.spo2,
          temp: point.temp,
          spo2Scale2: patient.vitals.spo2Scale2,
          oxygenSupport: point.news >= 5,
          consciousness: estimateConsciousness(point.news, false, patient.vitals.consciousness),
        };
    const news2Score = isLatest ? calculateNEWS2(snapshot).score : point.news;
    const mewsScore = calculateMEWS(snapshot).score;
    return {
      ...point,
      news2Score,
      mewsScore,
      protocolScore: protocol === 'MEWS' ? mewsScore : news2Score,
    };
  });
}

export function getRiskLevel(protocol, score, breakdown) {
  const cfg = PROTOCOL_CONFIG[protocol];
  const hasRedFlag = Object.values(breakdown || {}).some((b) => b.score >= 3);
  if (score >= cfg.criticalThreshold || hasRedFlag) return 'Critical';
  if (score >= cfg.mediumThreshold) return 'Medium';
  if (protocol === 'NEWS2' && score >= 1) return 'Low-Medium';
  return 'Low';
}

export const WARDS = ['All Wards', 'Cardiology Ward', 'Medical Ward', 'Geriatric Ward', 'Surgical Ward'];
