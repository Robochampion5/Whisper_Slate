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

export async function joinSession(classCode: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/session/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode }),
  });
  if (!res.ok) throw new Error('Failed to join session');
  const data = await res.json();
  return data.device_token;
}

/**
 * POSTs the raw audio Blob to POST /doubts/audio as multipart/form-data.
 *
 * The server responds immediately (before transcription finishes) with:
 *   { doubtId: string, status: "processing" }
 *
 * The caller should then open the per-device WebSocket
 *   ws://<server>/ws/device/<doubtId>
 * and wait for a PROCESSING_COMPLETE or REVIEW_DECISION event.
 */
export async function uploadAudio(
  audioBlob: Blob,
  sessionCode: string,
  deviceToken: string,
): Promise<{ doubtId: string; status: string }> {
  const form = new FormData();
  // filename extension helps server choose the right temp file suffix
  const ext = audioBlob.type.includes('webm') ? '.webm' : '.wav';
  form.append('audio', audioBlob, `doubt${ext}`);
  form.append('sessionCode', sessionCode);
  form.append('deviceToken', deviceToken);

  const res = await fetch(`${SERVER_URL}/doubts/audio`, {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type header — browser sets it with the correct boundary
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Returns the WebSocket URL for the per-device review channel.
 * The student app connects here after upload to receive the teacher's decision.
 */
export function deviceChannelUrl(doubtId: string): string {
  const base = SERVER_URL.replace(/^http/, 'ws');
  return `${base}/ws/device/${doubtId}`;
}
