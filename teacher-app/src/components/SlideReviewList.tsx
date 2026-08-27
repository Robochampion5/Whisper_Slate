import React, { useCallback } from 'react';
import { FileText, Sparkles, Image } from 'lucide-react';
import type { SlideChunk } from '../services/api';

interface SlideReviewListProps {
  chunks: SlideChunk[];
  onChange: (updated: SlideChunk[]) => void;
}

const PREVIEW_LEN = 120;

function preview(text: string): string {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > PREVIEW_LEN ? trimmed.slice(0, PREVIEW_LEN) + '…' : trimmed;
}

export const SlideReviewList: React.FC<SlideReviewListProps> = ({ chunks, onChange }) => {
  const includedCount = chunks.filter((c) => c.included).length;

  const toggle = useCallback(
    (id: number) => {
      onChange(chunks.map((c) => (c.id === id ? { ...c, included: !c.included } : c)));
    },
    [chunks, onChange],
  );

  const selectAll = useCallback(() => {
    onChange(chunks.map((c) => (c.char_count > 0 ? { ...c, included: true } : c)));
  }, [chunks, onChange]);

  const deselectAll = useCallback(() => {
    onChange(chunks.map((c) => ({ ...c, included: false })));
  }, [chunks, onChange]);

  if (chunks.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          <span className="text-slate-200 font-medium">{includedCount}</span> of{' '}
          <span className="text-slate-200 font-medium">{chunks.length}</span> slides included
        </span>
        <div className="flex gap-3">
          <button
            onClick={selectAll}
            className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs"
          >
            Select all
          </button>
          <span className="text-slate-700">·</span>
          <button
            onClick={deselectAll}
            className="text-slate-500 hover:text-slate-400 transition-colors text-xs"
          >
            Deselect all
          </button>
        </div>
      </div>

      {/* Chunk list */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
        {chunks.map((chunk) => {
          const isEmpty = chunk.char_count === 0;
          return (
            <label
              key={chunk.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                isEmpty
                  ? 'border-slate-800 bg-slate-950/30 opacity-50 cursor-not-allowed'
                  : chunk.included
                  ? 'border-emerald-700/40 bg-emerald-950/20 hover:border-emerald-600/50'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={chunk.included}
                disabled={isEmpty}
                onChange={() => !isEmpty && toggle(chunk.id)}
                className="mt-0.5 accent-emerald-500 w-4 h-4 shrink-0"
                id={`slide-chunk-${chunk.id}`}
              />

              {/* Slide index badge */}
              <span
                className={`shrink-0 text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                  chunk.included && !isEmpty
                    ? 'bg-emerald-900/60 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {chunk.index + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isEmpty ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-600 italic">
                    <Image size={11} /> No text extracted (scanned / image-only slide)
                  </span>
                ) : (
                  <>
                    {/* Enriched text badge */}
                    {chunk.enriched_text && (
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles size={10} className="text-amber-400" />
                        <span className="text-xs text-amber-400 font-medium">AI summary: </span>
                        <span className="text-xs text-amber-300">{chunk.enriched_text}</span>
                      </div>
                    )}
                    {/* Raw text preview */}
                    <p className="text-sm text-slate-300 leading-snug break-words">
                      {preview(chunk.raw_text)}
                    </p>
                  </>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
