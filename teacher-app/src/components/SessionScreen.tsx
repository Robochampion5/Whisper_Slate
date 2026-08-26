import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronDown, ChevronUp, Play, XCircle, Tag } from 'lucide-react';

interface SessionScreenProps {
  sessionCode: string | null;
  onStart: (topics: string[]) => void;
  onStop: () => void;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({ sessionCode, onStart, onStop }) => {
  const [showTopics, setShowTopics] = useState(false);
  const [topicsText, setTopicsText] = useState('');

  const handleStart = () => {
    // Split on commas or newlines, trim whitespace, drop blanks
    const topics = topicsText
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onStart(topics);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        {/* Left: title + session code / QR */}
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-bold text-slate-200 mb-1">Live Classroom Session</h2>
            <p className="text-slate-400 text-sm">Students can join using this code or QR.</p>
          </div>

          {sessionCode && (
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div className="text-4xl font-mono font-bold tracking-widest text-emerald-400">
                {sessionCode}
              </div>
              <div className="bg-white p-1 rounded">
                <QRCodeSVG value={`http://localhost:5173/?code=${sessionCode}`} size={64} />
              </div>
            </div>
          )}
        </div>

        {/* Right: action button */}
        <div className="flex flex-col gap-3 items-end">
          {!sessionCode ? (
            <>
              {/* Topic keywords toggle */}
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
                    Comma-separated topics — used to flag off-topic doubts in the review queue.
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
            </>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <XCircle size={20} />
              Stop Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
