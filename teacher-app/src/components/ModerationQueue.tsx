import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp,
  AlertTriangle, Target, Clock, MessageSquare, ShieldAlert
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { QueueDoubt, ReviewPayload } from '../services/api';
import * as api from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModerationQueueProps {
  queue: QueueDoubt[];
  onReviewed: () => void; // called after accept or reject so parent can refresh
}

const REJECT_REASONS = ['Inappropriate', 'Off-topic', 'Spam', 'Other'] as const;
type RejectReason = (typeof REJECT_REASONS)[number];

const PENALTY_PRESETS: { label: string; minutes: number }[] = [
  { label: 'None', minutes: 0 },
  { label: '1 min', minutes: 1 },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: 'Rest of session', minutes: 9999 },
];

// ---------------------------------------------------------------------------
// Flag pills
// ---------------------------------------------------------------------------

function AppropriatenessPill({ flagged }: { flagged: boolean | null }) {
  if (flagged === null || flagged === undefined) return null;
  return flagged ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-rose-900/60 text-rose-300 border border-rose-700/40">
      <ShieldAlert size={11} /> Flagged
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
      <CheckCircle2 size={11} /> Clean
    </span>
  );
}

function RelevancePill({ score, flagged }: { score: number | null; flagged: boolean | null }) {
  if (score === null || score === undefined) return null;
  const pct = Math.round((score ?? 0) * 100);
  return flagged ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/40">
      <AlertTriangle size={11} /> Off-topic · {pct}%
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
      <Target size={11} /> On-topic · {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Individual doubt card
// ---------------------------------------------------------------------------

function DoubtCard({ doubt, onReviewed }: { doubt: QueueDoubt; onReviewed: () => void }) {
  const [mode, setMode] = useState<'idle' | 'accepting' | 'rejecting'>('idle');
  const [replyText, setReplyText] = useState('');
  const [rejectReason, setRejectReason] = useState<RejectReason>('Off-topic');
  const [penaltyMinutes, setPenaltyMinutes] = useState(0);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const effectivePenalty =
    penaltyMinutes === -1
      ? parseInt(customMinutes || '0', 10)
      : penaltyMinutes;

  const submit = async (payload: ReviewPayload) => {
    setIsSending(true);
    setError('');
    try {
      await api.reviewDoubt(doubt.id, payload);
      onReviewed();
    } catch (e) {
      setError((e as Error).message);
      setIsSending(false);
    }
  };

  const handleAccept = () => submit({
    decision: 'accept',
    replyText: replyText.trim() || undefined,
  });

  const handleReject = () => submit({
    decision: 'reject',
    reason: rejectReason,
    replyText: replyText.trim() || undefined,
    penaltyMinutes: effectivePenalty || undefined,
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 transition-all">
      {/* Header: timestamp + flags */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={11} />
          {formatDistanceToNow(new Date(doubt.timestamp), { addSuffix: true })}
        </div>
        <div className="flex flex-wrap gap-2">
          <AppropriatenessPill flagged={doubt.appropriateness_flag} />
          <RelevancePill score={doubt.relevance_score} flagged={doubt.relevance_flag} />
        </div>
      </div>

      {/* Transcript */}
      <p className="text-slate-200 text-sm leading-relaxed bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/60">
        "{doubt.text}"
      </p>

      {/* Error */}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Actions — idle state */}
      {mode === 'idle' && (
        <div className="flex gap-3">
          <button
            onClick={() => setMode('accepting')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-700/40 text-sm font-medium transition-colors"
          >
            <CheckCircle2 size={16} /> Accept
          </button>
          <button
            onClick={() => setMode('rejecting')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-700/40 text-sm font-medium transition-colors"
          >
            <XCircle size={16} /> Reject
          </button>
        </div>
      )}

      {/* Accept panel */}
      {mode === 'accepting' && (
        <div className="space-y-3 border border-emerald-800/40 rounded-lg p-4 bg-emerald-950/20">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <MessageSquare size={12} /> Reply message (optional)
          </label>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Good question, addressing this now…"
            rows={2}
            disabled={isSending}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-shadow"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('idle'); setReplyText(''); }}
              disabled={isSending}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={isSending}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 size={14} />
              {isSending ? 'Accepting…' : 'Confirm Accept'}
            </button>
          </div>
        </div>
      )}

      {/* Reject panel */}
      {mode === 'rejecting' && (
        <div className="space-y-3 border border-rose-800/40 rounded-lg p-4 bg-rose-950/20">
          {/* Reason */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Reason *</label>
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    rejectReason === r
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Reply */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
              <MessageSquare size={12} /> Reply message (optional)
            </label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Please keep questions relevant to today's topic…"
              rows={2}
              disabled={isSending}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 transition-shadow"
            />
          </div>

          {/* Penalty picker */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Penalty duration</label>
            <div className="flex flex-wrap gap-2">
              {PENALTY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPenaltyMinutes(p.minutes)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    penaltyMinutes === p.minutes && penaltyMinutes !== -1
                      ? 'bg-amber-700 border-amber-600 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setPenaltyMinutes(-1)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  penaltyMinutes === -1
                    ? 'bg-amber-700 border-amber-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom…
              </button>
            </div>
            {penaltyMinutes === -1 && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Minutes"
                  className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs text-slate-500">minutes</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setMode('idle'); setReplyText(''); setPenaltyMinutes(0); }}
              disabled={isSending}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={isSending}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <XCircle size={14} />
              {isSending ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue list
// ---------------------------------------------------------------------------

export const ModerationQueue: React.FC<ModerationQueueProps> = ({ queue, onReviewed }) => {
  if (queue.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500">
        No doubts awaiting review.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((doubt) => (
        <DoubtCard key={doubt.id} doubt={doubt} onReviewed={onReviewed} />
      ))}
    </div>
  );
};
