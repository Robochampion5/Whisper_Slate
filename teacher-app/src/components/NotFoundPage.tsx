import { Home, RefreshCw } from 'lucide-react';

type NotFoundPageProps = {
  onGoHome?: () => void;
};

/**
 * 404 Page — shown when the app encounters an unknown state or route.
 */
export default function NotFoundPage({ onGoHome }: NotFoundPageProps) {
  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      // Fallback: reload the page to go back to dashboard
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6 text-center">
      <div className="space-y-6 max-w-md">
        {/* Large 404 visual */}
        <div className="relative">
          <div className="text-9xl font-bold text-slate-800/40 select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 border-4 border-slate-700 rounded-full flex items-center justify-center bg-slate-900">
              <span className="text-4xl">🤔</span>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-100">Page not found</h1>
          <p className="text-slate-400 text-sm">
            This page doesn't exist or something went wrong.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Home size={20} />
            Go to Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <RefreshCw size={20} />
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
