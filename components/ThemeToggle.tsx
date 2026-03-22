'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-card-bg text-foreground border border-card-border shadow-lg hover:bg-input-bg transition-colors duration-300 z-50 group"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-500 group-hover:rotate-45 transition-transform duration-300" />
      ) : (
        <Moon className="h-5 w-5 text-indigo-500 group-hover:-rotate-12 transition-transform duration-300" />
      )}
    </button>
  );
}
