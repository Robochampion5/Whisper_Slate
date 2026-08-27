import { useState, useRef } from 'react';
import { Mic, Lock } from 'lucide-react';
import { startAudioCapture, stopAudioCapture } from '../services/audio';

type CaptureProps = {
  onRecordingComplete: (audioBlob?: Blob) => void;
  /** Seconds remaining on an active penalty. 0 = no penalty. */
  penaltyRemaining?: number;
  /** Called when the server returns a 403 penalized on an upload attempt so
   *  the parent can resync the countdown. */
  onPenaltyResync?: (remainingSeconds: number) => void;
};

export default function CaptureScreen({
  onRecordingComplete,
  penaltyRemaining = 0,
  onPenaltyResync: _onPenaltyResync,
}: CaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  // Guard ref to avoid firing both pointer and click handlers simultaneously
  const isHandlingRef = useRef(false);

  const isPenalised = penaltyRemaining > 0;
  const mm = String(Math.floor(penaltyRemaining / 60)).padStart(2, '0');
  const ss = String(penaltyRemaining % 60).padStart(2, '0');

  const startRecording = async () => {
    if (isRecording || isPenalised) return;
    try {
      await startAudioCapture();
      setIsRecording(true);
    } catch {
      alert('Microphone access is required to use Whisper Slate.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      const blob = await stopAudioCapture();
      onRecordingComplete(blob);
    } catch (err) {
      console.error('Error stopping capture', err);
      onRecordingComplete(); // discard
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isPenalised) return;
    isHandlingRef.current = true;
    startRecording();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isHandlingRef.current) {
      stopRecording();
      isHandlingRef.current = false;
    }
  };

  // Accessibility fallback (tap/click)
  const handleClick = () => {
    if (isPenalised) return;
    if (!isHandlingRef.current) {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="mb-16 text-center">
          <h2 className="text-xl font-medium text-teal-50 mb-2">Have a doubt?</h2>
          <p className="text-teal-300/70 text-sm">
            {isPenalised ? 'Recording paused' : 'Hold to whisper'}
          </p>
        </div>

        {/* Hero Button */}
        <div className="relative flex flex-col items-center justify-center gap-6">
          {isRecording && !isPenalised && (
            <>
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-150 duration-1000" />
              <div className="absolute inset-0 bg-emerald-500/30 rounded-full animate-pulse scale-125 duration-700" />
            </>
          )}

          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleClick}
            disabled={isPenalised}
            className={`
              relative z-10 flex items-center justify-center
              w-40 h-40 rounded-full shadow-2xl transition-all duration-300
              ${isPenalised
                ? 'bg-teal-900 cursor-not-allowed opacity-60'
                : isRecording
                ? 'bg-emerald-500 scale-95 shadow-emerald-900/50'
                : 'bg-teal-800 hover:bg-teal-700 hover:scale-105 shadow-black/40'}
            `}
            aria-label={
              isPenalised
                ? `Recording disabled — ${mm}:${ss} remaining`
                : isRecording
                ? 'Release to stop recording'
                : 'Hold to record'
            }
          >
            {isPenalised ? (
              <Lock className="w-12 h-12 text-teal-600" />
            ) : (
              <Mic className={`w-16 h-16 ${isRecording ? 'text-white' : 'text-teal-300'}`} />
            )}
          </button>

          {/* Penalty countdown shown below the button */}
          {isPenalised && (
            <div className="flex flex-col items-center gap-1 animate-in fade-in duration-300">
              <p className="text-red-400 text-sm font-medium">
                Recording paused for
              </p>
              <p className="text-red-300 text-3xl font-mono font-semibold tracking-wider">
                {mm}:{ss}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="pb-10 text-center">
        <p className="text-xs text-teal-600 font-medium tracking-wide uppercase">
          Private &amp; Anonymous
        </p>
      </div>
    </div>
  );
}
