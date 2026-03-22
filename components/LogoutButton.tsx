'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center px-4 py-2 border border-card-border text-sm font-medium rounded-lg text-foreground bg-input-bg hover:bg-primary/10 hover:text-primary hover:border-primary/30 focus:outline-none transition-all duration-300 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
      ) : (
        <LogOut className="h-4 w-4 mr-2" />
      )}
      {loading ? 'Logging out...' : 'Log Out'}
    </button>
  );
}
