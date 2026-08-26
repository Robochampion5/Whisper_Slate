import { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { sendDoubt } from '../services/api';

type ReviewProps = {
  initialText: string;
  embedding: number[];
  sessionCode: string;
  deviceToken: string;
  onSent: () => void;
  onDiscard: () => void;
};

export default function ReviewScreen({ initialText, embedding, sessionCode, deviceToken, onSent, onDiscard }: ReviewProps) {
  const [text, setText] = useState(initialText);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    try {
      await sendDoubt(text, embedding, sessionCode, deviceToken);
      onSent();
    } catch (e) {
      console.error(e);
      alert("Failed to send doubt: " + (e as Error).message);
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6 font-sans">
      <div className="w-full max-w-md bg-teal-900/40 p-6 rounded-2xl border border-teal-800/50 shadow-xl">
        <h2 className="text-teal-100 font-medium mb-4">Review Doubt</h2>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSending}
          className="w-full h-32 p-4 bg-teal-950/50 border border-teal-800 rounded-xl text-teal-50 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
          placeholder="What did you want to ask?"
        />
        
        <div className="flex gap-4 mt-6">
          <button
            onClick={onDiscard}
            disabled={isSending}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-teal-900 hover:bg-teal-800 text-teal-300 font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Discard
          </button>
          
          <button
            onClick={handleSend}
            disabled={isSending || !text.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:bg-teal-800 disabled:text-teal-500"
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
