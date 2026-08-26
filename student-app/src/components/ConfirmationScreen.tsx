import { useEffect, useState } from 'react';
import { Check, X, MessageSquare } from 'lucide-react';
import type { ReviewDecision } from './AwaitingReviewScreen';

type OutcomeProps = {
  decision: ReviewDecision;
  onComplete: () => void;
};

/**
 * OutcomeScreen — terminal state shown after teacher accepts or rejects a doubt.
 *
 * Accepted:
 *   • Green checkmark + optional reply message from teacher.
 *   • "Back to capture" button appears immediately (or after 2 s auto-return
 *     if no reply message to read).
 *
 * Rejected:
 *   • Red X + optional reply message.
 *   • If a penalty was applied, shows a live countdown; the "Record again"
 *     button is disabled until the penalty expires.
 *     (The server is the source of truth for penalty enforcement — the
 *     countdown here is purely for UX feedback, §13.3.)
 */
export default function OutcomeScreen({ decision, onComplete }: OutcomeProps) {
  const isAccepted = decision.status === 'accepted';
  const hasReply = Boolean(decision.replyMessage);
  const penaltySeconds = decision.penaltySeconds ?? 0;

  const [remaining, setRemaining] = useState(penaltySeconds);

  // Penalty countdown
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);  // run once on mount — `remaining` initial value is from penaltySeconds

  // Auto-return for accepted doubts with no reply
  useEffect(() => {
    if (isAccepted && !hasReply) {
      const t = setTimeout(onComplete, 2000);
      return () => clearTimeout(t);
    }
  }, [isAccepted, hasReply, onComplete]);

  const canReturn = remaining <= 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm text-center animate-in fade-in zoom-in duration-300">

        {/* Icon */}
        <div
          className={`flex items-center justify-center w-20 h-20 rounded-full ${
            isAccepted ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}
        >
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg ${
              isAccepted
                ? 'bg-emerald-500 shadow-emerald-500/30'
                : 'bg-red-500 shadow-red-500/30'
            }`}
          >
            {isAccepted ? (
              <Check className="w-8 h-8 text-white" />
            ) : (
              <X className="w-8 h-8 text-white" />
            )}
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-medium text-teal-50">
          {isAccepted ? 'Doubt noted!' : 'Doubt not accepted'}
        </h2>

        {/* Teacher reply */}
        {hasReply && (
          <div className="w-full bg-teal-900/50 border border-teal-800/60 rounded-2xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-teal-400 font-medium uppercase tracking-wide">
                Teacher's reply
              </span>
            </div>
            <p className="text-teal-100 text-sm leading-relaxed">{decision.replyMessage}</p>
          </div>
        )}

        {/* Penalty countdown */}
        {!isAccepted && remaining > 0 && (
          <div className="w-full bg-red-950/40 border border-red-800/40 rounded-2xl p-4">
            <p className="text-red-300 text-sm">Recording disabled for</p>
            <p className="text-red-200 text-3xl font-mono font-semibold mt-1">
              {mm}:{ss}
            </p>
          </div>
        )}

        {/* Return button */}
        <button
          onClick={onComplete}
          disabled={!canReturn}
          className={`w-full py-3.5 px-4 rounded-xl font-medium transition-all duration-300 ${
            canReturn
              ? isAccepted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-teal-800 hover:bg-teal-700 text-teal-100'
              : 'bg-teal-900 text-teal-700 cursor-not-allowed'
          }`}
        >
          {canReturn ? 'Record another doubt' : `Wait ${mm}:${ss}`}
        </button>
      </div>
    </div>
  );
}
