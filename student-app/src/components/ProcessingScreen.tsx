import { useEffect } from 'react';
type ProcessingProps = {
  audioData?: Float32Array;
  worker: Worker | null;
  onTranscriptionComplete: (text: string, embedding: number[]) => void;
  onError: (err: string) => void;
};

export default function ProcessingScreen({ audioData, worker, onTranscriptionComplete, onError }: ProcessingProps) {
  useEffect(() => {
    if (!worker || !audioData) {
      onError("No audio data or worker available");
      return;
    }

    const messageHandler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'result') {
        onTranscriptionComplete(msg.text, msg.embedding);
      } else if (msg.type === 'error') {
        onError(msg.error || "Transcription failed");
      }
    };

    worker.addEventListener('message', messageHandler);
    worker.postMessage({ type: 'transcribe', audio: audioData });

    return () => {
      worker.removeEventListener('message', messageHandler);
    };
  }, [audioData, worker, onTranscriptionComplete, onError]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          {/* Subtle local indicator, explicitly NOT a network spinner */}
          <div className="w-16 h-16 border-4 border-teal-900 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-medium text-teal-100">Transcribing locally...</h2>
          <p className="text-teal-500 text-sm mt-2">Running Whisper AI on your device</p>
        </div>
      </div>
    </div>
  );
}
