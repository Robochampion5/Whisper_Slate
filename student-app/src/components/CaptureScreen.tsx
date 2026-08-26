import { useState, useRef } from 'react';
import { Mic } from 'lucide-react';

import { startAudioCapture, stopAudioCapture } from '../services/audio';

type CaptureProps = {
  onRecordingComplete: (audioData?: Float32Array) => void;
};

export default function CaptureScreen({ onRecordingComplete }: CaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  // Using a simple ref to track long-press vs click to avoid firing twice
  const isHandlingRef = useRef(false);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      await startAudioCapture();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone access is required to use Whisper Slate.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      const audioData = await stopAudioCapture();
      onRecordingComplete(audioData);
    } catch (err) {
      console.error("Error stopping capture", err);
      onRecordingComplete(); // Proceed to error state or discard
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
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

  // Fallback for click if pointer events don't catch (e.g. accessibility tap)
  const handleClick = () => {
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
          <p className="text-teal-300/70 text-sm">Hold to whisper</p>
        </div>

        {/* Hero Button Container */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing rings when recording */}
          {isRecording && (
            <>
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-150 duration-1000"></div>
              <div className="absolute inset-0 bg-emerald-500/30 rounded-full animate-pulse scale-125 duration-700"></div>
            </>
          )}
          
          <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleClick}
            className={`
              relative z-10 flex items-center justify-center
              w-40 h-40 rounded-full shadow-2xl transition-all duration-300
              ${isRecording 
                ? 'bg-emerald-500 scale-95 shadow-emerald-900/50' 
                : 'bg-teal-800 hover:bg-teal-700 hover:scale-105 shadow-black/40'}
            `}
            aria-label={isRecording ? "Release to stop recording" : "Hold to record"}
          >
            <Mic className={`w-16 h-16 ${isRecording ? 'text-white' : 'text-teal-300'}`} />
          </button>
        </div>
      </div>
      
      <div className="pb-10 text-center">
        <p className="text-xs text-teal-600 font-medium tracking-wide uppercase">
          Private & Anonymous
        </p>
      </div>
    </div>
  );
}
