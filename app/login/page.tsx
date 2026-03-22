'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User, Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const email = `${username.toLowerCase().trim()}@app.local`;

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        try {
          // Keep synced
          await supabase.from('agents').upsert({
            id: data.user.id,
            name: data.user.user_metadata?.username || username.trim(),
            email: email,
            role: 'Member'
          }, { onConflict: 'id' });
        } catch (e) {
          console.error('Failed to sync agent on login:', e);
        }
      }

      // Refresh to update server components with middleware session
      router.push('/');
      router.refresh();

    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  return (
    <div className="grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-background">
      {/* Decorative Blob */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -z-10 mix-blend-multiply opacity-50 dark:opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#4ade80]/20 rounded-full blur-[100px] -z-10 mix-blend-multiply opacity-50 dark:opacity-20"></div>

      <div className="w-full max-w-md space-y-8 glass-card rounded-2xl p-8 sm:p-10 transform transition-all duration-300">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold tracking-tight text-foreground">
            Welcome Back
          </h2>
          <p className="mt-3 text-center text-sm text-foreground/70">
            Sign in to your <span className="font-semibold text-primary">only2u</span> workspace
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-md animate-in fade-in slide-in-from-top-2" role="alert">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-500 dark:text-red-500">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-5 rounded-md">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1 ml-1" htmlFor="username">
                Username
              </label>
              <div className="relative group input-focus-ring rounded-xl transition-all duration-300">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-3 py-3.5 sm:text-sm bg-input-bg border border-input-border rounded-xl text-foreground placeholder-foreground/30 focus:outline-none transition-colors"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1 ml-1" htmlFor="password">
                Password
              </label>
              <div className="relative group input-focus-ring rounded-xl transition-all duration-300">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 py-3.5 sm:text-sm bg-input-bg border border-input-border rounded-xl text-foreground placeholder-foreground/30 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-foreground/40 hover:text-primary focus:outline-none transition-colors p-1 rounded-md hover:bg-foreground/5"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 transition-all duration-300 shadow-lg shadow-primary/30 overflow-hidden"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {loading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : null}
              </span>
              <span className="flex items-center">
                {loading ? 'Signing In...' : 'Sign In'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          </div>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-card-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-card-bg text-foreground/50 rounded-full font-medium">
                New to only2u?
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/signup"
              className="w-full flex justify-center items-center py-3 px-4 border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-xl text-sm font-bold transition-all duration-300"
            >
              Create an Account
            </Link>
          </div>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}
