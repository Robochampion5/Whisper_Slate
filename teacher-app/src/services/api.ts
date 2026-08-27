// API interactions for Teacher Dashboard

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Starts a new classroom session.
 * @param topics  Optional list of topic keyword phrases typed by the teacher.
 *                Stored as raw strings; embedded at confirm-topics time (§14.3).
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
// Slides (§14)
// ---------------------------------------------------------------------------

export interface SlideChunk {
  id: number;
  index: number;
  raw_text: string;
  preview: string;          // first 120 chars of raw_text
  enriched_text: string | null;
  source_filename: string;
  char_count: number;
  included: boolean;
}

/**
 * Upload a .pdf or .pptx file and receive extracted slide chunks for review.
 * Replaces any previous upload for this session.
 */
export async function uploadSlides(sessionCode: string, file: File): Promise<SlideChunk[]> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/session/${sessionCode}/slides`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.chunks as SlideChunk[];
}

/**
 * Save the teacher's checkbox selections (included/excluded per slide).
 */
export async function updateSlideSelections(
  sessionCode: string,
  selections: { id: number; included: boolean }[],
): Promise<void> {
  await fetch(`${API_BASE}/session/${sessionCode}/slides`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chunks: selections }),
  });
}

/**
 * Finalise the topic reference set for the session:
 * embeds included slide chunks + typed keyword phrases in one batch.
 * After this call, relevance scoring is live for all subsequent doubts.
 */
export async function confirmTopics(sessionCode: string): Promise<{ vectorCount: number }> {
  const res = await fetch(`${API_BASE}/session/${sessionCode}/confirm-topics`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Confirm failed (${res.status})`);
  }
  return res.json();
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
