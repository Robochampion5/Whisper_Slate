import { useEffect } from 'react';
import { Check } from 'lucide-react';

type ConfirmationProps = {
  onComplete: () => void;
};

export default function ConfirmationScreen({ onComplete }: ConfirmationProps) {
  useEffect(() => {
    // Auto-return to capture screen after 1.5s
    const timer = setTimeout(() => {
      onComplete();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6">
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full mb-6">
          <div className="flex items-center justify-center w-14 h-14 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/30">
            <Check className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-medium text-teal-50">Doubt Sent</h2>
      </div>
    </div>
  );
}
