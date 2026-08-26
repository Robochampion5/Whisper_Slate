import { Loader2 } from 'lucide-react';

type DownloadProps = {
  progress: number;
  status: string;
};

export default function DownloadScreen({ progress, status }: DownloadProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6 text-center">
      <div className="w-full max-w-sm">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-6" />
        <h2 className="text-xl font-medium text-teal-50 mb-2">Downloading speech model</h2>
        <p className="text-teal-300 text-sm mb-6">~100MB, this happens only once.</p>
        
        <div className="w-full h-2 bg-teal-900 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        
        <p className="text-teal-400 text-xs mt-3 font-mono">{status}</p>
      </div>
    </div>
  );
}
