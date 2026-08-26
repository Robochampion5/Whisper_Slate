/**
 * Mock APIs for Phase 1 MVP
 * These will be replaced by actual on-device model calls (Whisper/MiniLM) 
 * and local network server calls in later phases.
 */

// We will define the local server URL here or use an env var
const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/ping`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function mockLogin(_email: string, _password: string):Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 500))
}

export async function joinSession(classCode: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/session/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode })
  });
  if (!res.ok) throw new Error('Failed to join session');
  const data = await res.json();
  return data.device_token;
}

export async function sendDoubt(
  text: string, 
  embedding: number[], 
  sessionCode: string, 
  deviceToken: string
): Promise<void> {
  const res = await fetch(`${SERVER_URL}/doubts`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Device-Token': deviceToken
    },
    body: JSON.stringify({ 
      text, 
      embedding, 
      sessionCode, 
      timestamp: new Date().toISOString() 
    })
  });
  if (!res.ok) throw new Error('Failed to send doubt');
}
