import { useState, FormEvent } from 'react';
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: { message: string } | null; session: unknown | null }>;
  onGoogleSignIn: () => Promise<{ error: { message: string } | null }>;
}

export function AuthPage({ onSignIn, onSignUp, onGoogleSignIn }: AuthPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = mode === 'signin' ? await onSignIn(email, password) : await onSignUp(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    } else if (mode === 'signup' && !(result as { session?: unknown }).session) {
      setError('Check your email to confirm your account.');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const result = await onGoogleSignIn();
    if (result.error) {
      setError(result.error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-100 mb-5">
            <Sparkles className="w-3.5 h-3.5 text-terracotta-500" strokeWidth={1.5} />
            <span className="text-xs font-medium text-terracotta-600">AI-Powered Learning</span>
          </div>
          <h1 className="font-serif text-3xl text-ink-700 mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Begin your journey'}
          </h1>
          <p className="text-sm text-warmgray-400">
            {mode === 'signin'
              ? 'Sign in to continue your learning'
              : 'Create an account to start generating courses'}
          </p>
        </div>

        <div className="bg-cream-50 rounded-xl2 border border-cream-200 p-7 shadow-soft">
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-cream-100 border border-cream-200 hover:bg-cream-200 text-sm font-medium text-ink-600 transition-colors mb-5 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-cream-200" />
            <span className="text-xs text-warmgray-300 font-medium">or</span>
            <div className="flex-1 h-px bg-cream-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-warmgray-500 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray-300" strokeWidth={1.5} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-warmgray-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray-300" strokeWidth={1.5} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cream-100 border border-cream-200 text-sm text-ink-600 placeholder:text-warmgray-300 focus:outline-none focus:border-sand-300 focus:bg-cream-50 transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-brick-500 bg-brick-50 border border-brick-100 rounded-xl px-4 py-2.5 animate-fade-in">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 font-medium text-sm transition-colors shadow-soft disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-warmgray-400 mt-5">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
              }}
              className="text-terracotta-600 font-medium hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-warmgray-300 mt-6 font-serif italic">
          Athenaeum · Your AI learning companion
        </p>
      </div>
    </div>
  );
}
