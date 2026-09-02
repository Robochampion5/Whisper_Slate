import { useState, useEffect } from 'react';
import { Send, X, Loader2 } from 'lucide-react';

type PreviewScreenProps = {
  audioBlob: Blob;
  onSend: (text: string) => void;
  onCancel: () => void;
};

export default function PreviewScreen({ audioBlob, onSend, onCancel }: PreviewScreenProps) {
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const transcribeAudio = async () => {
      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'doubt.webm');

        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE}/doubts/transcribe-preview`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Transcription failed');
        }

        const data = await response.json();
        setTranscript(data.text || '');
      } catch (err) {
        setError('Failed to transcribe audio. Please try recording again.');
        console.error('Transcription error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    transcribeAudio();
  }, [audioBlob]);

  const handleSend = () => {
    if (transcript.trim()) {
      onSend(transcript.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-medium text-teal-50 mb-2">Review your doubt</h2>
          <p className="text-teal-300/70 text-sm">
            {isLoading ? 'Transcribing...' : 'Edit if needed, then send'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="w-12 h-12 text-teal-400 animate-spin" />
            <p className="text-teal-300/70 text-sm">Processing your recording...</p>
          </div>
        ) : error ? (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-6 mb-6">
            <p className="text-red-300 text-sm text-center">{error}</p>
          </div>
        ) : (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full h-48 bg-teal-900/30 border border-teal-700 rounded-lg px-4 py-3 text-teal-50 text-base placeholder-teal-600 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
            placeholder="Your transcribed doubt will appear here..."
            autoFocus
          />
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 bg-teal-900 hover:bg-teal-800 text-teal-200 px-6 py-4 rounded-lg font-medium transition-colors"
          >
            <X size={20} />
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !!error || !transcript.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg font-medium transition-colors"
          >
            <Send size={20} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
