import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastProps = {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
};

/**
 * Toast notification component — appears at the top of the screen and auto-dismisses.
 *
 * Usage:
 *   <Toast message="Login successful!" type="success" onClose={() => setToast(null)} />
 */
export default function Toast({ message, type = 'info', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'bg-emerald-900/95',
      border: 'border-emerald-700',
      text: 'text-emerald-100',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    },
    error: {
      bg: 'bg-red-900/95',
      border: 'border-red-700',
      text: 'text-red-100',
      icon: <XCircle className="w-5 h-5 text-red-400 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-900/95',
      border: 'border-amber-700',
      text: 'text-amber-100',
      icon: <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />,
    },
    info: {
      bg: 'bg-teal-900/95',
      border: 'border-teal-700',
      text: 'text-teal-100',
      icon: <Info className="w-5 h-5 text-teal-400 shrink-0" />,
    },
  };

  const style = styles[type];

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] animate-in slide-in-from-top-2 fade-in duration-300"
      role="alert"
    >
      <div className={`flex items-start gap-3 ${style.bg} ${style.border} border rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm`}>
        {style.icon}
        <p className={`flex-1 text-sm ${style.text} leading-relaxed`}>{message}</p>
        <button
          onClick={onClose}
          className={`${style.text} hover:opacity-70 transition-opacity shrink-0`}
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
