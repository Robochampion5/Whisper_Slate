// v2 architecture: all AI processing has moved server-side (see Project_spec.md §13).
// The client only records audio and uploads the raw Blob.

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/ping`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export interface AuthLoginResponse {
  token: string;
  user_id: number;
  college_id: string;
}

export async function authLogin(collegeId: string, password: string): Promise<AuthLoginResponse> {
  const res = await fetch(`${SERVER_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ college_id: collegeId, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Penalty response shape — returned as the 403 detail on penalised requests
// ---------------------------------------------------------------------------

export interface PenaltyError {
  error: 'penalized';
  remainingSeconds: number;
}

function isPenaltyDetail(body: unknown): body is PenaltyError {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as PenaltyError).error === 'penalized'
  );
}

// ---------------------------------------------------------------------------
// Session join
// ---------------------------------------------------------------------------

export async function joinSession(classCode: string): Promise<string> {
  // Include JWT from localStorage if available (for authenticated joins)
  const authToken = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${SERVER_URL}/session/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode }),
  });

  if (res.status === 403) {
    // Penalised device attempting to rejoin — surface as a structured error
    const body = await res.json().catch(() => null);
    if (isPenaltyDetail(body)) throw Object.assign(new Error('penalized'), body);
  }

  if (!res.ok) throw new Error('Failed to join session');
  const data = await res.json();
  return data.device_token;
}

// ---------------------------------------------------------------------------
// Audio upload
// ---------------------------------------------------------------------------

/**
 * POSTs the raw audio Blob to POST /doubts/audio as multipart/form-data.
 *
 * Returns { doubtId, status: "processing" } on success.
 *
 * Throws a PenaltyError-shaped Error if the server returns 403 penalized.
 * For rate limit (429), throws Error with status and retryAfter properties.
 *
 * @param transcriptOverride Optional pre-transcribed text from the preview screen.
 *   When provided, the server uses this instead of transcribing the audio.
 */
export async function uploadAudio(
  audioBlob: Blob,
  sessionCode: string,
  deviceToken: string,
  transcriptOverride?: string,
): Promise<{ doubtId: string; status: string }> {
  const form = new FormData();
  const ext = audioBlob.type.includes('webm') ? '.webm' : '.wav';
  form.append('audio', audioBlob, `doubt${ext}`);
  form.append('sessionCode', sessionCode);
  form.append('deviceToken', deviceToken);
  if (transcriptOverride) {
    form.append('transcriptOverride', transcriptOverride);
  }

  const res = await fetch(`${SERVER_URL}/doubts/audio`, {
    method: 'POST',
    body: form,
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (isPenaltyDetail(body)) throw Object.assign(new Error('penalized'), body);
    throw new Error('Forbidden');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // Include status and retry-after for rate limit handling
    const retryAfter = res.headers.get('retry-after');
    const err = new Error(`Upload failed (${res.status}): ${text}`);
    (err as any).status = res.status;
    if (retryAfter) (err as any).retryAfter = parseInt(retryAfter, 10);
    throw err;
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// WebSocket URLs
// ---------------------------------------------------------------------------

/**
 * Per-doubt channel — used by AwaitingReviewScreen for immediate response.
 * Keyed by the server-generated opaque doubtId.
 */
export function deviceChannelUrl(doubtId: string): string {
  const base = SERVER_URL.replace(/^http/, 'ws');
  return `${base}/ws/device/${doubtId}`;
}

/**
 * Standing per-device channel — maintained for the whole session.
 * The student app connects here after join() and receives REVIEW_DECISION
 * events even after the doubt-scoped channel has closed.
 * Keyed by the raw deviceToken (hashed server-side).
 */
export function studentChannelUrl(deviceToken: string): string {
  const base = SERVER_URL.replace(/^http/, 'ws');
  return `${base}/ws/student/${encodeURIComponent(deviceToken)}`;
}

// ---------------------------------------------------------------------------
// Reconnect / resync fallback
// ---------------------------------------------------------------------------

export interface MyDoubtsResponse {
  latestDoubt: {
    id: number;
    status: 'processing' | 'pending_review' | 'accepted' | 'rejected';
    reviewReason: string | null;
    penaltySeconds: number;
    penaltyExpiresAt: string | null;
  } | null;
  activePenalty: {
    remainingSeconds: number;
    expiresAt: string;
  } | null;
}

/**
 * Called on app load when a stored deviceToken exists, to recover the state
 * of any outstanding doubt and any active penalty (§13.4 step 6 plan).
 */
export async function getMyDoubts(deviceToken: string): Promise<MyDoubtsResponse> {
  const res = await fetch(
    `${SERVER_URL}/doubts/mine?deviceToken=${encodeURIComponent(deviceToken)}`,
  );
  if (!res.ok) throw new Error('Failed to fetch my doubts');
  return res.json();
}

// ---------------------------------------------------------------------------
// Legacy / mock
// ---------------------------------------------------------------------------

export function mockLogin(_email: string, _password: string): Promise<void> {
  return Promise.resolve();
}
