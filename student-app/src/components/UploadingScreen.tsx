import { useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { uploadAudio } from '../services/api';

type UploadingProps = {
  audioBlob: Blob;
  sessionCode: string;
  deviceToken: string;
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
  onUploaded,
  onError,
}: UploadingProps) {
  // Guard against double-execution in React Strict Mode
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    uploadAudio(audioBlob, sessionCode, deviceToken)
      .then(({ doubtId }) => onUploaded(doubtId))
      .catch((err: Error & { remainingSeconds?: number }) =>
        onError(err.message, err.remainingSeconds),
      );
  }, [audioBlob, sessionCode, deviceToken, onUploaded, onError]);

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
