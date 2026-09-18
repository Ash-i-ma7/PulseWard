// Lightweight API client for the optional PulseWard backend connection.
//
// The frontend works fully standalone in "Demo" mode (the original
// client-side simulator) with no backend required. "Live" mode is opt-in:
// the user supplies a backend URL and logs in, and from that point on
// patient data, vitals, and alerts are read from and written to the real
// backend instead of local state, with real-time updates over WebSocket.
//
// This keeps the hackathon-demo experience zero-setup while making the real
// full-stack path available without a rebuild.

import { io } from 'socket.io-client';

let baseUrl = null;
let accessToken = null;
let socket = null;

function authHeaders() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }
  return data;
}

export async function connect(url) {
  baseUrl = url.replace(/\/$/, '');
  const health = await request('/health');
  if (health.status !== 'ok') throw new Error('Backend did not report healthy status.');
  return true;
}

export async function login(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  accessToken = data.accessToken;
  return data.user;
}

export function logout() {
  accessToken = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export async function fetchWards() {
  return request('/api/wards');
}

export async function fetchPatients(wardId) {
  const qs = wardId ? `?wardId=${wardId}` : '';
  return request(`/api/patients${qs}`);
}

export async function fetchPatientVitalsHistory(patientId, limit = 20) {
  return request(`/api/patients/${patientId}/vitals?limit=${limit}`);
}

export async function fetchAlerts() {
  return request('/api/alerts');
}

export async function submitManualVitals(patientId, vitals) {
  return request(`/api/patients/${patientId}/vitals`, {
    method: 'POST',
    body: JSON.stringify(vitals),
  });
}

export async function acknowledgeAlert(alertId) {
  return request(`/api/alerts/${alertId}/acknowledge`, { method: 'PATCH' });
}

export async function escalateAlert(alertId) {
  return request(`/api/alerts/${alertId}/escalate`, { method: 'PATCH' });
}

export async function fetchCareLog(patientId) {
  return request(`/api/patients/${patientId}/care-log`);
}

export async function addCareLogEntry(patientId, entry) {
  return request(`/api/patients/${patientId}/care-log`, {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function updateClinicalHistory(patientId, data) {
  return request(`/api/patients/${patientId}/clinical-history`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Subscribes to real-time updates. onVitalsUpdate/onAlertNew/onAlertUpdated
// are called with the raw event payloads from the backend.
export function subscribeRealtime({ onVitalsUpdate, onAlertNew, onAlertUpdated }) {
  if (!baseUrl || !accessToken) throw new Error('Must connect() and login() before subscribing to realtime updates.');
  socket = io(baseUrl, { auth: { token: accessToken } });
  if (onVitalsUpdate) socket.on('vitals:update', onVitalsUpdate);
  if (onAlertNew) socket.on('alert:new', onAlertNew);
  if (onAlertUpdated) socket.on('alert:updated', onAlertUpdated);
  return socket;
}

export function isConnected() {
  return Boolean(baseUrl && accessToken);
}
