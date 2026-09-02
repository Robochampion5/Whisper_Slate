import { useEffect, useRef, useState } from 'react';
import { Upload, AlertCircle, Clock } from 'lucide-react';
import { uploadAudio } from '../services/api';

type UploadingProps = {
  audioBlob: Blob;
  sessionCode: string;
  deviceToken: string;
  transcriptOverride?: string;
  onUploaded: (doubtId: string) => void;
  /** err is the error message; remainingSeconds is set if the server returned
   *  a 403 penalized response so the parent can resync the local countdown. */
  onError: (err: string, remainingSeconds?: number) => void;
};

/**
 * UploadingScreen — shown while the raw audio Blob is POSTed to the server.
 *
 * This is a real network call (replaced the old "transcribing locally..." state).
 * It resolves quickly (the server responds immediately with doubtId + status:
 * "processing" before transcription starts), so this screen is typically brief.
 */
export default function UploadingScreen({
  audioBlob,
  sessionCode,
  deviceToken,
  transcriptOverride,
  onUploaded,
  onError,
}: UploadingProps) {
  // Guard against double-execution in React Strict Mode
  const hasStarted = useRef(false);
  const [rateLimitError, setRateLimitError] = useState<{ message: string; retryAfter?: number } | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    uploadAudio(audioBlob, sessionCode, deviceToken, transcriptOverride)
      .then(({ doubtId }) => onUploaded(doubtId))
      .catch((err: Error & { remainingSeconds?: number; status?: number; retryAfter?: number }) => {
        // Handle rate limit (429) specially
        if (err.status === 429 || err.message.includes('Rate limit') || err.message.includes('429')) {
          const retryAfter = err.retryAfter || Math.ceil(err.remainingSeconds || 60);
          setRateLimitError({ message: err.message, retryAfter });
          setCountdown(retryAfter);
          // Start countdown
          const timer = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(timer);
                setRateLimitError(null);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          onError(err.message, err.remainingSeconds);
        }
      });
  }, [audioBlob, sessionCode, deviceToken, onUploaded, onError]);

  if (rateLimitError) {
    const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
    const ss = String(countdown % 60).padStart(2, '0');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="bg-amber-950/50 border border-amber-800 rounded-xl p-6">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-amber-200 mb-2">Too many doubts sent</h2>
            <p className="text-amber-300/80 text-sm">
              {rateLimitError.message}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-teal-300/70 text-sm">Please wait before trying again</p>
            <div className="flex items-center gap-2 bg-teal-900/30 border border-teal-800 rounded-lg px-6 py-3">
              <Clock className="w-5 h-5 text-teal-400" />
              <span className="text-2xl font-mono font-semibold text-teal-100">{mm}:{ss}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-teal-900 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
          <Upload className="absolute inset-0 m-auto w-6 h-6 text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-medium text-teal-100">Sending your doubt…</h2>
          <p className="text-teal-500 text-sm mt-2">Uploading to classroom server</p>
        </div>
      </div>
    </div>
  );
}
