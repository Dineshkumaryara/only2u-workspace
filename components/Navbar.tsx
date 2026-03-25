'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import NotificationDropdown from './NotificationDropdown';
import { useUserStore } from '@/stores/useUserStore';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/stores/useSidebarStore';

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { setMobileOpen } = useSidebarStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { user, profile, fetchUser } = useUserStore();

  useEffect(() => {
    setMounted(true);
    fetchUser();
  }, [fetchUser]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (isAuthPage) return null;

  const displayName = profile?.name || user?.email?.split('@')[0] || "User";

  return (
    <nav className="sticky top-0 z-50 w-full glass-card border-b border-card-border bg-card-bg/80 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between lg:justify-end h-16 items-center">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2.5 rounded-xl bg-input-bg/50 text-foreground/70 hover:text-primary hover:bg-primary/5 transition-all duration-300 border border-input-border/50 hover:border-primary/30"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Mobile Center Logo */}
          <h2 className="text-2xl font-extrabold lg:hidden absolute left-1/2 -translate-x-1/2 pointer-events-none">
            only<span className="text-primary">2</span>u
          </h2>

          <div className="flex gap-4 items-center">
            {user && (
              <span className="text-sm font-bold text-foreground/80 animate-in fade-in slide-in-from-right-4 duration-500 hidden sm:inline-block">
                Welcome back, <span className="text-primary font-black uppercase tracking-tight">{displayName}</span>
              </span>
            )}

            <div className="flex items-center gap-2.5 pl-4 border-l border-card-border/50">
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl bg-input-bg/50 text-foreground/70 hover:text-primary hover:bg-primary/5 transition-all duration-300 border border-input-border/50 hover:border-primary/30 group"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={18} className="group-hover:rotate-90 transition-transform duration-500" /> : <Moon size={18} className="group-hover:-rotate-12 transition-transform duration-500" />}
                </button>
              )}

              {user && <NotificationDropdown userId={user.id} />}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
