// API interactions for Teacher Dashboard

const API_BASE = 'http://localhost:8000';

export async function startSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/session/start`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start session');
  const data = await res.json();
  return data.sessionCode;
}

export async function stopSession(sessionCode: string): Promise<void> {
  await fetch(`${API_BASE}/session/stop?sessionCode=${sessionCode}`, { method: 'POST' });
}

export async function getClusters(sessionCode: string) {
  const res = await fetch(`${API_BASE}/clusters?sessionCode=${sessionCode}`);
  if (!res.ok) throw new Error('Failed to fetch clusters');
  return res.json();
}

export async function blockDevice(deviceToken: string) {
  await fetch(`${API_BASE}/devices/${deviceToken}/block`, { method: 'POST' });
}

export async function kickDevice(deviceToken: string) {
  await fetch(`${API_BASE}/devices/${deviceToken}/kick`, { method: 'POST' });
}
