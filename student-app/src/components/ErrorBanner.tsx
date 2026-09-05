import { AlertCircle } from 'lucide-react';

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
};

/**
 * ErrorBanner — inline error display component for forms and user actions.
 * Use this instead of alert() for better UX.
 */
export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-red-200 text-sm">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
