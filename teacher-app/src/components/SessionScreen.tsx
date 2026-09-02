import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ChevronDown, ChevronUp, Play, XCircle, Tag,
  Upload, CheckCircle2, Loader2, AlertCircle, FileSliders,
} from 'lucide-react';
import { SlideReviewList } from './SlideReviewList';
import * as api from '../services/api';
import type { SlideChunk } from '../services/api';
import { getLanIpAndPort } from '../utils/getLanIp';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionScreenProps {
  sessionCode: string | null;
  onStart: (topics: string[]) => void;
  onStop: () => void;
}

// ---------------------------------------------------------------------------
// 3-step wizard states (pre-start only)
//  step 1 — "Start" form (type topics, click Start Session)
//  step 2 — slide upload + review (after session code exists but before confirm)
//  step 3 — live (sessionCode + topics confirmed; full listening mode)
// Session is "open" (code live) from step 2 onward so students can join early.
// ---------------------------------------------------------------------------

type WizardStep = 'setup' | 'review' | 'live';

export const SessionScreen: React.FC<SessionScreenProps> = ({ sessionCode, onStart, onStop }) => {
  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [showTopics, setShowTopics] = useState(false);
  const [topicsText, setTopicsText] = useState('');

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<WizardStep>('setup');
  const [chunks, setChunks] = useState<SlideChunk[]>([]);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [confirmState, setConfirmState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [confirmError, setConfirmError] = useState('');
  const [vectorCount, setVectorCount] = useState(0);

  // ── QR code URL with dynamic LAN IP ──────────────────────────────────────
  const [qrUrl, setQrUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect LAN IP when session starts
  useEffect(() => {
    if (sessionCode) {
      getLanIpAndPort().then(hostPort => {
        setQrUrl(`http://${hostPort}/?code=${sessionCode}`);
      });
    }
  }, [sessionCode]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleStart = () => {
    const topics = topicsText
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onStart(topics);           // parent sets sessionCode
    setWizardStep('review');   // advance to upload/review step
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionCode) return;

    setUploadState('uploading');
    setUploadError('');
    try {
      const received = await api.uploadSlides(sessionCode, file);
      setChunks(received);
      setUploadState('done');
    } catch (err) {
      setUploadError((err as Error).message);
      setUploadState('error');
    } finally {
      // Reset input so the same file can be re-uploaded after an error
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0 && !sessionCode) return;

    // Trigger file input change with the dropped file
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(files[0]);
      fileInputRef.current.files = dataTransfer.files;

      const event = new Event('change', { bubbles: true });
      fileInputRef.current.dispatchEvent(event);
    }
  };

  const handleChunksChange = async (updated: SlideChunk[]) => {
    setChunks(updated);
    if (!sessionCode) return;
    // Persist checkbox state immediately so a page refresh doesn't lose it
    await api.updateSlideSelections(
      sessionCode,
      updated.map((c) => ({ id: c.id, included: c.included })),
    ).catch(() => {/* silent — UI state is still correct */});
  };

  const handleConfirm = async () => {
    if (!sessionCode) return;
    setConfirmState('loading');
    setConfirmError('');
    try {
      const { vectorCount: vc } = await api.confirmTopics(sessionCode);
      setVectorCount(vc);
      setConfirmState('done');
      setWizardStep('live');
    } catch (err) {
      setConfirmError((err as Error).message);
      setConfirmState('error');
    }
  };

  const handleStop = () => {
    setWizardStep('setup');
    setChunks([]);
    setUploadState('idle');
    setUploadError('');
    setConfirmState('idle');
    setConfirmError('');
    setTopicsText('');
    setShowTopics(false);
    onStop();
  };

  // ── Session code / QR badge (shown whenever session is open) ─────────────
  const SessionBadge = sessionCode && qrUrl ? (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
        <div className="text-3xl font-mono font-bold tracking-widest text-emerald-400">
          {sessionCode}
        </div>
        <div className="bg-white p-1 rounded">
          <QRCodeSVG value={qrUrl} size={56} />
        </div>
      </div>
      <p className="text-xs text-slate-500 text-center font-mono">{qrUrl}</p>
    </div>
  ) : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">

      {/* ── STEP 1: Setup (no session yet) ─────────────────────────────── */}
      {wizardStep === 'setup' && (
        <div className="p-6 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-200 mb-1">Live Classroom Session</h2>
            <p className="text-slate-400 text-sm">Students join with a code or QR after you start.</p>
          </div>

          <div className="flex flex-col gap-3 items-end">
            <button
              onClick={() => setShowTopics((v) => !v)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              aria-expanded={showTopics}
            >
              <Tag size={14} />
              {showTopics ? 'Hide' : 'Add'} lecture topics (optional)
              {showTopics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showTopics && (
              <div className="w-72">
                <textarea
                  value={topicsText}
                  onChange={(e) => setTopicsText(e.target.value)}
                  placeholder="recursion, stack overflow, base case…"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Comma-separated. You can also upload slides after starting.
                </p>
              </div>
            )}

            <button
              onClick={handleStart}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Play size={20} />
              Start Session
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Slide upload + review ───────────────────────────────── */}
      {wizardStep === 'review' && (
        <div className="divide-y divide-slate-800">
          {/* Top bar: session badge + skip/confirm actions */}
          <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <FileSliders size={18} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Upload lecture slides</p>
                <p className="text-xs text-slate-500">
                  Students can already join while you review.
                </p>
              </div>
              {SessionBadge}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirmState === 'loading'}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {confirmState === 'loading' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {confirmState === 'loading' ? 'Confirming…' : 'Confirm Topics & Start Listening'}
              </button>
              <button
                onClick={handleStop}
                className="flex items-center gap-2 text-slate-500 hover:text-rose-400 text-sm transition-colors px-2 py-2"
                title="Stop session"
              >
                <XCircle size={16} />
              </button>
            </div>
          </div>

          {/* Confirm error */}
          {confirmState === 'error' && (
            <div className="px-5 py-3 flex items-center gap-2 text-sm text-rose-400 bg-rose-950/30">
              <AlertCircle size={14} /> {confirmError}
            </div>
          )}

          {/* Main review area */}
          <div className="p-5 space-y-5">
            {/* Typed keywords (always visible) */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
                <Tag size={12} /> Typed topic keywords (optional)
              </label>
              <textarea
                value={topicsText}
                onChange={(e) => setTopicsText(e.target.value)}
                placeholder="recursion, stack overflow, base case…"
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
              />
              <p className="text-xs text-slate-600 mt-1">
                These combine with included slide chunks as the topic reference set.
              </p>
            </div>

            {/* Upload dropzone */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
                <Upload size={12} /> Slide deck (.pdf or .pptx)
              </label>
              <label
                htmlFor="slide-upload-input"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 w-full py-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  uploadState === 'uploading'
                    ? 'border-slate-600 bg-slate-950/30 pointer-events-none'
                    : 'border-slate-700 hover:border-emerald-700 hover:bg-emerald-950/10'
                }`}
              >
                {uploadState === 'uploading' ? (
                  <>
                    <Loader2 size={24} className="text-slate-400 animate-spin" />
                    <span className="text-sm text-slate-400">Extracting slides…</span>
                  </>
                ) : uploadState === 'done' ? (
                  <>
                    <CheckCircle2 size={24} className="text-emerald-400" />
                    <span className="text-sm text-emerald-400">
                      {chunks.length} slide{chunks.length !== 1 ? 's' : ''} extracted
                    </span>
                    <span className="text-xs text-slate-500">Click to re-upload</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-slate-500" />
                    <span className="text-sm text-slate-400">
                      Click to upload or drag &amp; drop
                    </span>
                    <span className="text-xs text-slate-600">.pdf or .pptx · max 20 MB</span>
                  </>
                )}
              </label>
              <input
                id="slide-upload-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx"
                className="sr-only"
                onChange={handleFileChange}
              />

              {uploadState === 'error' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-rose-400">
                  <AlertCircle size={12} /> {uploadError}
                </div>
              )}
            </div>

            {/* Slide chunk review list */}
            {chunks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 mb-3">
                  Review extracted chunks — uncheck slides to exclude from the reference set:
                </p>
                <SlideReviewList chunks={chunks} onChange={handleChunksChange} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Live session ─────────────────────────────────────────── */}
      {wizardStep === 'live' && (
        <div className="p-6 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold text-slate-200 mb-1">Live Classroom Session</h2>
              <p className="text-slate-400 text-sm">
                {vectorCount > 0
                  ? `Topic reference set ready · ${vectorCount} vector${vectorCount !== 1 ? 's' : ''}`
                  : 'Listening for student doubts…'}
              </p>
            </div>
            {SessionBadge}
          </div>
          <button
            onClick={handleStop}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <XCircle size={20} />
            Stop Session
          </button>
        </div>
      )}
    </div>
  );
};
