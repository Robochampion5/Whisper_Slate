import { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { deviceChannelUrl, getMyDoubts } from '../services/api';

export type ReviewDecision = {
  status: 'accepted' | 'rejected';
  replyMessage?: string;
  reviewReason?: string;
  penaltySeconds?: number;
  penaltyExpiresAt?: string;
};

type AwaitingReviewProps = {
  doubtId: string;
  deviceToken: string;
  onDecision: (result: ReviewDecision) => void;
};

/**
 * AwaitingReviewScreen — shown after the audio has been uploaded and the
 * server has acknowledged receipt (status: "processing").
 *
 * Primary path: opens a WebSocket on /ws/device/{doubtId} and waits for:
 *   { type: "REVIEW_DECISION", status: "accepted"|"rejected", ... }
 *
 * Fallback path (§13.4 step 6): if the WS drops and cannot reconnect within
 * 3 attempts, falls back to polling GET /doubts/mine to check the current
 * status.  This handles the case where the app was backgrounded during review.
 *
 * Note: the standing /ws/student/{deviceToken} channel (managed in App.tsx)
 * will also deliver the decision if the doubt-scoped WS has already closed.
 * Both paths call onDecision() — the parent guards against double-transitions
 * because the second call will be a no-op (appState already moved to OUTCOME).
 */
export default function AwaitingReviewScreen({
  doubtId,
  deviceToken,
  onDecision,
}: AwaitingReviewProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const fallbackCalledRef = useRef(false);

  const triggerFallback = async () => {
    if (fallbackCalledRef.current) return;
    fallbackCalledRef.current = true;

    try {
      const data = await getMyDoubts(deviceToken);
      const d = data.latestDoubt;
      if (!d) return;

      if (d.status === 'accepted' || d.status === 'rejected') {
        onDecision({
          status: d.status,
          reviewReason: d.reviewReason ?? undefined,
          penaltySeconds: d.penaltySeconds,
          penaltyExpiresAt: d.penaltyExpiresAt ?? undefined,
        });
      }
      // Still pending — stay on this screen; standing WS in App.tsx will deliver
    } catch (err) {
      console.warn('[AwaitingReviewScreen] REST fallback failed:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      const url = deviceChannelUrl(doubtId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'REVIEW_DECISION') {
            onDecision({
              status: msg.status,
              replyMessage: msg.replyMessage ?? undefined,
              penaltySeconds: msg.penaltySeconds,
              penaltyExpiresAt: msg.penaltyExpiresAt ?? undefined,
            });
          }
        } catch {
          console.error('[AwaitingReviewScreen] Malformed WS message:', event.data);
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        retriesRef.current += 1;
        if (retriesRef.current >= 3) {
          // WS gave up — try REST fallback
          triggerFallback();
        } else {
          // Brief delay then reconnect
          setTimeout(connect, 1_500 * retriesRef.current);
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose — handled there
      };
    };

    connect();

    return () => {
      mounted = false;
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doubtId]); // re-run only if doubtId changes

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-xs">
        {/* Animated waiting indicator */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-teal-800 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping scale-110" />
          <Clock className="w-8 h-8 text-emerald-400" />
        </div>

        <div>
          <h2 className="text-lg font-medium text-teal-100">With your teacher</h2>
          <p className="text-teal-500 text-sm mt-2 leading-relaxed">
            Your doubt is in the review queue.
            <br />
            You'll get a response shortly.
          </p>
        </div>

        <p className="text-xs text-teal-700 font-mono">#{doubtId}</p>
      </div>
    </div>
  );
}
