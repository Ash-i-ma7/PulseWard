# PulseWard — Early Warning Score Dashboard

A ward-level clinical monitoring dashboard supporting both **NEWS2** and **MEWS**
early warning score protocols, with live-simulated demo patients.

> **This is a demo.** All patients, vitals, and alerts are client-side mock data
> generated in the browser. There is no backend, database, or real clinical
> integration — nothing here should be used for actual patient care.

## Features

- Ward census with risk-ranked patient list, search, ward filter, and risk filter
- NEWS2 / MEWS protocol switch with protocol-correct thresholds, score breakdowns,
  and escalation guidance (not shared/reused between protocols)
- Patient detail view: live vitals, transparent score component breakdown,
  vitals + score trend charts, patient-to-patient navigation
- Alert queue with acknowledge and escalate (RRT) actions
- Ward analytics: risk distribution and average score by ward
- Simulated live telemetry with pause/resume, adjustable interval, and a manual
  "pulse" refresh button
- Responsive layout with a mobile navigation menu, visible keyboard focus states,
  and `prefers-reduced-motion` support

## Getting started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

## Project structure

```
src/
  clinicalData.js   # NEWS2 / MEWS calculators, protocol config, demo patient data
  App.jsx            # Dashboard UI: census, patient detail, alerts, analytics
  main.jsx           # React entry point
  index.css          # Tailwind import, fonts, accessibility & motion styles
index.html
package.json
```

## Notes on the scoring logic

- `calculateNEWS2(vitals)` and `calculateMEWS(vitals)` in `src/clinicalData.js`
  each return `{ protocol, score, riskLevel, breakdown }` using the standard
  NEWS2 and MEWS parameter tables (respiration rate, SpO2, oxygen support/AVPU/
  temperature/blood pressure/heart rate, with MEWS omitting the oxygen-support
  parameter per protocol).
- `getProtocolHistory(patient, protocol)` builds a protocol-aware trend line so
  the NEWS2 and MEWS charts never share a score, and the most recent chart point
  always matches the patient's live current score.
