// API interactions for Teacher Dashboard

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Starts a new classroom session.
 * @param topics  Optional list of topic keyword phrases typed by the teacher.
 *                Embedded server-side and used for relevance scoring.
 */
export async function startSession(topics?: string[]): Promise<string> {
  const res = await fetch(`${API_BASE}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics: topics ?? [] }),
  });
  if (!res.ok) throw new Error('Failed to start session');
  const data = await res.json();
  return data.sessionCode;
}

export async function stopSession(sessionCode: string): Promise<void> {
  await fetch(`${API_BASE}/session/stop?sessionCode=${sessionCode}`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------

export async function getClusters(sessionCode: string) {
  const res = await fetch(`${API_BASE}/clusters?sessionCode=${sessionCode}`);
  if (!res.ok) throw new Error('Failed to fetch clusters');
  return res.json();
}

// ---------------------------------------------------------------------------
// Moderation queue
// ---------------------------------------------------------------------------

export interface QueueDoubt {
  id: number;
  text: string;
  timestamp: string;
  appropriateness_flag: boolean | null;
  appropriateness_score: number | null;
  relevance_score: number | null;
  relevance_flag: boolean | null;
}

export async function getModerationQueue(sessionCode: string): Promise<QueueDoubt[]> {
  const res = await fetch(`${API_BASE}/doubts/queue?sessionCode=${sessionCode}`);
  if (!res.ok) throw new Error('Failed to fetch moderation queue');
  const data = await res.json();
  return data.queue as QueueDoubt[];
}

export interface ReviewPayload {
  decision: 'accept' | 'reject';
  reason?: string;
  replyText?: string;
  penaltyMinutes?: number;
}

export async function reviewDoubt(doubtId: number, payload: ReviewPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/doubts/${doubtId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Review failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export async function blockDevice(deviceToken: string) {
  await fetch(`${API_BASE}/devices/${deviceToken}/block`, { method: 'POST' });
}

export async function kickDevice(deviceToken: string) {
  await fetch(`${API_BASE}/devices/${deviceToken}/kick`, { method: 'POST' });
}
