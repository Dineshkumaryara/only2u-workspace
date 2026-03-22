'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User, Lock, Eye, EyeOff, Loader2, UserPlus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return false;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (!password) {
      setError('Please enter a password');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      const email = `${username.toLowerCase().trim()}@app.local`;

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
          }
        }
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Sync user to agents table so they show up in member searches
      if (data?.user) {
        try {
          await supabase.from('agents').upsert({
            id: data.user.id,
            name: username.trim(),
            email: email,
            role: 'Member'
          }, { onConflict: 'id' });
        } catch (e) {
          console.error('Failed to sync agent on signup:', e);
        }
      }

      setLoading(false);
      
      // Auto-redirect to login with a query parameter for success or push directly
      router.push('/login?registered=true');

    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { score: 0, text: '', color: '', bg: '' };
    if (password.length < 6) return { score: 1, text: 'Too Weak', color: 'text-red-500', bg: 'bg-red-500' };
    if (password.length < 8) return { score: 2, text: 'Fair', color: 'text-orange-500', bg: 'bg-orange-500' };
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) return { score: 3, text: 'Good', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { score: 4, text: 'Strong', color: 'text-green-500', bg: 'bg-green-500' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-background">
      {/* Decorative Blob */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -z-10 mix-blend-multiply opacity-50 dark:opacity-20 animate-pulse"></div>

      <div className="w-full max-w-md space-y-8 glass-card rounded-2xl p-8 sm:p-10 transform transition-all duration-300">
        <div>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-foreground">
            Create an Account
          </h2>
          <p className="mt-3 text-center text-sm text-foreground/70">
            Join your workspace team in seconds.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-md animate-in fade-in slide-in-from-top-2" role="alert">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSignup}>
          <div className="space-y-4">
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
                  placeholder="Choose a username"
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 py-3.5 sm:text-sm bg-input-bg border border-input-border rounded-xl text-foreground placeholder-foreground/30 focus:outline-none transition-colors"
                  placeholder="Create a password"
                  disabled={loading}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-foreground/40 hover:text-primary focus:outline-none transition-colors p-1 rounded-md hover:bg-foreground/5"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Premium Visual Password Strength */}
            {password.length > 0 && (
              <div className="pt-1 pb-2 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex gap-1.5 h-1.5 w-full mb-2">
                  <div className={`h-full flex-1 rounded-full transition-all duration-500 ${strength.score >= 1 ? strength.bg + ' shadow-[0_0_8px_rgba(0,0,0,0.2)]' : 'bg-input-border dark:bg-card-border'}`}></div>
                  <div className={`h-full flex-1 rounded-full transition-all duration-500 ${strength.score >= 2 ? strength.bg + ' shadow-[0_0_8px_rgba(0,0,0,0.2)]' : 'bg-input-border dark:bg-card-border'}`}></div>
                  <div className={`h-full flex-1 rounded-full transition-all duration-500 ${strength.score >= 3 ? strength.bg + ' shadow-[0_0_8px_rgba(0,0,0,0.2)]' : 'bg-input-border dark:bg-card-border'}`}></div>
                  <div className={`h-full flex-1 rounded-full transition-all duration-500 ${strength.score >= 4 ? strength.bg + ' shadow-[0_0_8px_rgba(0,0,0,0.2)]' : 'bg-input-border dark:bg-card-border'}`}></div>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] text-foreground/50 font-bold uppercase tracking-wider">
                    Password Security
                  </span>
                  <span className={`text-[11px] font-extrabold uppercase tracking-wider transition-colors duration-300 ${strength.color}`}>
                    {strength.text}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1 ml-1" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <div className="relative group input-focus-ring rounded-xl transition-all duration-300">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <CheckCircle2 className="h-5 w-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 py-3.5 sm:text-sm bg-input-bg border border-input-border rounded-xl text-foreground placeholder-foreground/30 focus:outline-none transition-colors"
                  placeholder="Repeat your password"
                  disabled={loading}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-foreground/40 hover:text-primary focus:outline-none transition-colors p-1 rounded-md hover:bg-foreground/5"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 transition-all duration-300 shadow-lg shadow-primary/30"
            >
              {loading ? (
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 text-white animate-spin mr-2" />
                  Creating...
                </div>
              ) : (
                'Create Account'
              )}
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
                Already have an account?
              </span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-bold text-primary hover:text-primary-hover transition-colors underline-offset-4 hover:underline"
            >
              Sign in to your account
            </Link>
          </div>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}
