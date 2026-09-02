import { useState } from 'react';
import { joinSession, authLogin, type AuthLoginResponse } from '../services/api';

type LoginProps = {
  onSuccess: (code: string, token: string, authToken?: string) => void;
};

export default function LoginScreen({ onSuccess }: LoginProps) {
  const [isCollegeAuth, setIsCollegeAuth] = useState(false);
  const [code, setCode] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const token = await joinSession(code);
      onSuccess(code, token);
    } catch (err: any) {
      setError(err.message || 'Failed to join');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollegeAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const authRes: AuthLoginResponse = await authLogin(collegeId, password);
      // Store JWT in localStorage for subsequent API calls (joinSession reads from here)
      localStorage.setItem('auth_token', authRes.token);
      // Join session - joinSession now picks up the auth_token from localStorage
      const token = await joinSession(code);
      onSuccess(code, token, authRes.token);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-teal-950 px-6 font-sans text-teal-50">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold mb-2">Whisper Slate</h1>
          <p className="text-teal-300/80 text-sm">Doubts don't need to be loud to be heard.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {!isCollegeAuth ? (
          <form onSubmit={handleJoinClass} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-teal-200 mb-2">
                Classroom Code
              </label>
              <input
                id="code"
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CS101A"
                className="w-full px-4 py-3 bg-teal-900/50 border border-teal-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg tracking-widest text-center text-white placeholder-teal-700 transition-colors"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={code.length !== 6 || isLoading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-teal-800 disabled:text-teal-500 text-white font-medium rounded-xl transition-colors"
            >
              {isLoading ? 'Connecting...' : 'Join Class'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsCollegeAuth(true)}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                Sign in with college account
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCollegeAuth} className="space-y-4">
            <div>
              <label htmlFor="collegeId" className="block text-sm font-medium text-teal-200 mb-1">
                College ID
              </label>
              <input
                id="collegeId"
                type="text"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="w-full px-4 py-2.5 bg-teal-900/50 border border-teal-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-teal-700"
                placeholder="e.g. student123"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-teal-200 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-teal-900/50 border border-teal-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-teal-700"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={!collegeId || !password || isLoading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-teal-800 disabled:text-teal-500 text-white font-medium rounded-xl transition-colors"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsCollegeAuth(false)}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                Use class code instead
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
