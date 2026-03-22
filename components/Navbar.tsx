'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import NotificationDropdown from './NotificationDropdown';
import { usePathname } from 'next/navigation';
import { useSidebarStore } from '@/stores/useSidebarStore';

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { toggleMobile } = useSidebarStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: agent } = await supabase
          .from("agents")
          .select("name")
          .eq("id", user.id)
          .single();
        
        if (agent?.name) {
          setUserName(agent.name);
        } else {
          setUserName(user.email?.split('@')[0] || "");
        }
      }
    };
    fetchUser();
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (isAuthPage) return null;

  return (
    <nav className="sticky top-0 z-50 w-full glass-card border-b border-card-border bg-card-bg/80 backdrop-blur-md">
      <div className="w-full px-2 sm:px-6 lg:px-8">
        <div className="flex justify-between lg:justify-end h-16 items-center">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={toggleMobile}
            className="lg:hidden p-2.5 rounded-xl bg-input-bg/50 text-foreground/70 hover:text-primary hover:bg-primary/5 transition-all duration-300 border border-input-border/50 hover:border-primary/30"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Mobile Center Logo */}
          <h2 className="text-2xl font-extrabold lg:hidden absolute left-1/2 -translate-x-1/2">
            only<span className="text-primary">2</span>u
          </h2>

          <div className="flex gap-3 items-center">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-input-bg/50 text-foreground/70 hover:text-primary hover:bg-primary/5 transition-all duration-300 border border-input-border/50 hover:border-primary/30"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}

            {user && <NotificationDropdown userId={user.id} />}
            {user && (
              <span className="text-sm font-bold text-foreground/80 animate-in fade-in slide-in-from-right-2 hidden sm:inline-block">
                Hello! <span className="text-primary">{userName}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
