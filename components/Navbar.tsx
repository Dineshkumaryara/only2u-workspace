'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun, Menu, X, User as UserIcon, LogOut, ChevronDown, Bell } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import NotificationDropdown from './NotificationDropdown';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
    
    // Click outside handler for profile dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return null;
  }

  // Helper to get initials
  const getInitials = (email: string) => {
    return email ? email.substring(0, 1).toUpperCase() : 'U';
  };

  return (
    <nav className="sticky top-0 z-50 w-full glass-card border-b border-card-border bg-card-bg/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center font-extrabold">
              <h2 className="text-2xl">only<span className="text-primary">2</span>u</h2>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              href="/" 
              className={`text-sm font-bold transition-colors hover:text-primary ${pathname === '/' ? 'text-primary' : 'text-foreground/70'}`}
            >
              Dashboard
            </Link>
            <Link 
              href="/task-management/board" 
              className={`text-sm font-bold transition-colors hover:text-primary ${pathname.includes('/task-management') ? 'text-primary' : 'text-foreground/70'}`}
            >
              Tasks Space
            </Link>
            
            <div className="flex items-center space-x-4 ml-2 pl-6 border-l border-card-border">
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full bg-input-bg text-foreground/70 hover:text-primary hover:bg-card-border transition-colors duration-200"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}

              {user && <NotificationDropdown userId={user.id} />}

              {/* Profile Dropdown */}
              {user ? (
                <div className="relative" ref={profileRef}>
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center space-x-2 p-1 pr-3 rounded-full bg-input-bg border border-transparent hover:border-primary/30 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                      {getInitials(user.email || '')}
                    </div>
                    <span className="text-sm font-bold text-foreground/80 group-hover:text-foreground hidden lg:block max-w-[120px] truncate">
                      {user.email?.split('@')[0]}
                    </span>
                    <ChevronDown size={14} className={`text-foreground/50 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card-bg border border-card-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="px-4 py-3 border-b border-input-border bg-input-bg/50">
                        <p className="text-xs text-foreground/60 font-bold uppercase tracking-wider mb-1">Signed in as</p>
                        <p className="text-sm font-bold text-foreground truncate">{user.email}</p>
                      </div>
                      
                      <div className="p-2">
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center"
                        >
                          <LogOut size={16} className="mr-2" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-hover transition-all shadow-md shadow-primary/20 hover:shadow-primary/40"
                >
                  Log In
                </Link>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-3">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-input-bg text-foreground/70 hover:text-primary transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            {user && <NotificationDropdown userId={user.id} />}
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 inline-flex items-center justify-center text-foreground hover:text-primary focus:outline-none bg-input-bg rounded-lg"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden glass-card border-b border-card-border animate-in slide-in-from-top-2">
          <div className="px-4 pt-4 pb-6 space-y-2">
            
            {user && (
              <div className="mb-6 px-3 py-4 rounded-xl bg-input-bg border border-card-border flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
                  {getInitials(user.email || '')}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs text-foreground/60 font-bold uppercase tracking-wider mb-0.5">Account</p>
                  <p className="text-sm font-bold text-foreground truncate">{user.email}</p>
                </div>
              </div>
            )}

            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                pathname === '/' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-input-bg text-foreground hover:border-primary/50 border border-transparent'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/task-management/board"
              onClick={() => setIsMenuOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                pathname.includes('/task-management') ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-input-bg text-foreground hover:border-primary/50 border border-transparent'
              }`}
            >
              Tasks Space
            </Link>
            
            {user ? (
               <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full text-left px-4 py-3 mt-4 rounded-xl text-sm font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center"
              >
                <LogOut size={16} className="mr-2" />
                Sign Out
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 mt-4 rounded-xl text-sm font-bold text-center text-white bg-primary shadow-lg shadow-primary/20"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
