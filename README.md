# PulseWard — Early Warning Score Dashboard

A ward-level clinical monitoring dashboard supporting both **NEWS2** and
**MEWS** early warning score protocols, with a multi-language UI, manual
vitals entry, printable patient reports, and an optional connection to the
real PulseWard backend.

> **Works standalone with zero setup.** By default this runs entirely in
> "Demo" mode: simulated patients, no backend, no database. Switching to
> "Live" mode connects it to a real deployment of `pulseward-backend/` — see
> that project's README for setup.

## Features

- **Dark / light theme toggle** — switchable from the top bar, persisted to
  localStorage, respects system preference on first load. Distinct accessible
  colors in both modes (not just an inverted palette).
- **Patient allergies, medical history, and medications** — a prominent
  allergy banner on the patient detail view (suppressed when there's nothing
  to flag), plus a Clinical History card listing medical history, current
  medications, and past/discontinued medications with the reason noted.
- **Care Log** — timestamped free-text entries from nurses and physicians,
  with author name, role, and an auto-generated timestamp; listed newest
  first, included in the printable report.
- Ward census with risk-ranked patient list, search, ward filter, and risk filter
- NEWS2 / MEWS protocol switch with protocol-correct thresholds, score breakdowns,
  and escalation guidance (not shared/reused between protocols)
- Patient detail view: live vitals, transparent score component breakdown,
  vitals + score trend charts, patient-to-patient navigation
- **Manual vitals entry** — record a full observation round for any patient,
  with soft validation flagging physiologically implausible values
- **Printable patient report** — a dedicated print-optimized (light
  background, black text) layout with patient info, score breakdown, recent
  trend, and alert history, watermarked as demo data
- **Multi-language UI** — English, Hindi (हिंदी), and Marathi (मराठी), switchable
  live from the top bar. Clinical terminology (SpO2, AVPU states, etc.) is
  intentionally left untranslated — see "Design decisions" below.
- **Demo / Live data source toggle** — log in to a running `pulseward-backend/`
  instance from the top bar to replace the simulator with real data. Once
  connected: the ward census and patient details load from the real backend,
  manual entries and alert acknowledge/escalate actions write through to it,
  new vitals and alerts from other users/devices appear live via WebSocket
  without a page refresh, and the care log loads and saves through the real
  API. Disconnecting returns to Demo mode's local simulator.
- Alert queue with acknowledge and escalate (RRT) actions
- Ward analytics: risk distribution and average score by ward
- Simulated live telemetry (Demo mode) with pause/resume, adjustable interval,
  and a manual "pulse" refresh button
- Responsive layout with a mobile navigation menu, visible keyboard focus
  states, and `prefers-reduced-motion` support

## Getting started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`). This works
immediately with no backend — Demo mode is the default.

### Connecting to the real backend (optional)

1. Set up and start `pulseward-backend/` (see its README) — run migrations
   and the seed script so at least the demo `admin@pulseward.demo` /
   `nurse@pulseward.demo` accounts exist.
2. In the dashboard, click the "Demo" button in the top bar.
3. Enter the backend URL (default `http://localhost:4000`) and log in.
4. The ward census, patient detail, and alert queue now show real data from
   the backend. Manual entries, alert acknowledge/escalate, and care log
   entries write through to it. New observations and alerts — from another
   browser tab, `curl`, or a real device hitting the sensor ingestion
   endpoint — appear automatically via WebSocket, no refresh needed.

This was verified end-to-end against a real running backend: creating a
patient via the API, submitting a manual vitals reading that crosses the
critical threshold, confirming the auto-generated alert appears, and
acknowledging/escalating it — all through the same HTTP calls this frontend
makes.

### What Live mode does not yet do

- **New patients must be admitted through the API directly** (e.g. `curl`,
  Postman, or a future admin screen) — there's no "Add Patient" form in the
  UI yet. The dashboard displays whatever patients already exist on the
  backend.
- **The Clinical History card is read-only in the UI.** The backend has a
  working `PATCH /patients/:id/clinical-history` endpoint (see backend
  README), but there's no edit form wired to it yet — allergies/medications
  shown are whatever the patient was created or last updated with via the API.
- **The local demo simulator is fully paused in Live mode** (no fake random-walk
  vitals) — everything shown is real data from the backend, or nothing, if no
  observations exist yet for a patient.
- **Sensor ingestion adapters beyond `generic_json`** are not implemented
  (see backend README) — this is a backend-side gap, not specific to the
  frontend.

### Production build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

## Project structure

```
src/
  clinicalData.js         # NEWS2 / MEWS calculators, protocol config, demo patient data
  App.jsx                  # Dashboard UI: census, patient detail, alerts, analytics
  main.jsx                 # React entry point
  index.css                # Tailwind import, fonts, accessibility & motion styles
  api/
    client.js              # Backend API client + WebSocket subscription (Live mode)
  components/
    ManualEntryForm.jsx     # Manual vitals entry modal
    PrintReport.jsx         # Print-optimized patient report
    DataSourcePanel.jsx     # Demo/Live connection panel
  i18n/
    index.js                # i18next configuration
    locales/en.json          # English (base language)
    locales/hi.json          # Hindi
    locales/mr.json          # Marathi
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
- **In Live mode, the frontend does not recompute scores** — it displays
  whatever the backend returns, since the backend (`pulseward-backend/src/scoring/`)
  is the single source of truth once a real deployment exists. The frontend
  copy of the scoring logic is only used in Demo mode.

## Design decisions

- **Clinical terminology is not translated**, even in Hindi/Marathi views.
  Parameter names (SpO2, AVPU/ACVPU states like "A"/"V"/"P"/"U", numeric vital
  values) stay in their standard English clinical form. Clinicians are
  trained on this standardized terminology, and inventing translated versions
  of standardized medical abbreviations risks introducing ambiguity or error.
  Only UI chrome — navigation, buttons, filter labels, guidance copy — is
  translated. See `src/i18n/index.js` for where this is enforced.
- **Printing uses the browser's native print dialog**, not a PDF-generation
  library. This keeps the dependency footprint small and lets users "print to
  PDF" through their browser, which covers the large majority of real usage.
- **The Demo/Live toggle keeps the hackathon-demo experience zero-setup**
  while making the real full-stack path available without a rebuild — nobody
  reviewing this project needs to stand up a database just to see the
  dashboard work.
