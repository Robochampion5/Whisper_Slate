import { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { deviceChannelUrl } from '../services/api';

export type ReviewDecision = {
  status: 'accepted' | 'rejected';
  replyMessage?: string;
  penaltySeconds?: number;
};

type AwaitingReviewProps = {
  doubtId: string;
  onDecision: (result: ReviewDecision) => void;
};

/**
 * AwaitingReviewScreen — shown after the audio has been uploaded and
 * the server has acknowledged receipt (status: "processing").
 *
 * Opens a WebSocket on /ws/device/{doubtId} and waits for two possible
 * server-pushed events:
 *
 *   { type: "PROCESSING_COMPLETE", doubtId, status: "pending_review" }
 *     → stay on this screen (doubt now in teacher's queue)
 *
 *   { type: "REVIEW_DECISION", status: "accepted"|"rejected",
 *     replyMessage?, penaltySeconds? }
 *     → call onDecision() and transition to the outcome screen
 *
 * The WS is keyed by doubt_id (a server-generated opaque integer), so
 * no student can observe another student's channel.
 */
export default function AwaitingReviewScreen({ doubtId, onDecision }: AwaitingReviewProps) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = deviceChannelUrl(doubtId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'REVIEW_DECISION') {
          onDecision({
            status: msg.status,
            replyMessage: msg.replyMessage,
            penaltySeconds: msg.penaltySeconds,
          });
        }
        // PROCESSING_COMPLETE just confirms transcript is ready — we stay
        // on this screen until the teacher makes a decision.
      } catch {
        console.error('Malformed WS message from device channel:', event.data);
      }
    };

    ws.onerror = (err) => {
      console.error('Device channel WS error:', err);
    };

    return () => {
      ws.close();
    };
  }, [doubtId, onDecision]);

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
