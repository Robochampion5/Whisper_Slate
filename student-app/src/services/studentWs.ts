/**
 * studentWs.ts — Standing per-device WebSocket client (§13.2 step 8).
 *
 * Maintains a persistent connection to /ws/student/{deviceToken} for the
 * duration of the session.  Reconnects automatically with exponential
 * back-off on unexpected drops.
 *
 * Usage:
 *   const ws = new StudentWs(deviceToken, onMessage);
 *   ws.connect();
 *   // ...
 *   ws.disconnect(); // call when leaving the session
 */

import { studentChannelUrl } from './api';

export type ReviewDecisionMessage = {
  type: 'REVIEW_DECISION';
  doubtId: number;
  status: 'accepted' | 'rejected';
  replyMessage: string | null;
  penaltySeconds: number;
  penaltyExpiresAt: string | null;
};

export type StudentWsMessage = ReviewDecisionMessage;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1_000;

export class StudentWs {
  private url: string;
  private ws: WebSocket | null = null;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  /** Called for every recognised server message. */
  onMessage: (msg: StudentWsMessage) => void;
  /** Called when the connection opens (including after reconnects). */
  onOpen?: () => void;
  /** Called when all retry attempts are exhausted. */
  onGiveUp?: () => void;

  constructor(
    deviceToken: string,
    onMessage: (msg: StudentWsMessage) => void,
  ) {
    this.url = studentChannelUrl(deviceToken);
    this.onMessage = onMessage;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.intentionalClose = false;
    this._open();
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.retries = 0;
  }

  private _open() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as StudentWsMessage;
        this.onMessage(msg);
      } catch {
        console.warn('[StudentWs] Malformed message:', event.data);
      }
    };

    ws.onclose = () => {
      if (this.intentionalClose) return;
      this._scheduleReconnect();
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — reconnect is handled there.
    };
  }

  private _scheduleReconnect() {
    if (this.retries >= MAX_RETRIES) {
      console.warn('[StudentWs] Max retries reached — giving up.');
      this.onGiveUp?.();
      return;
    }
    const delay = BASE_DELAY_MS * Math.pow(2, this.retries);
    this.retries += 1;
    console.info(`[StudentWs] Reconnecting in ${delay}ms (attempt ${this.retries}/${MAX_RETRIES})`);
    this.retryTimer = setTimeout(() => this._open(), delay);
  }
}
