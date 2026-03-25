import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { useRoleStore } from './useRoleStore';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id: string | null;
  department: string | null;
  is_active: boolean;
}

interface UserState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  fetchUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const supabase = createClient();

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  isSuperAdmin: false,

  fetchUser: async () => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        set({ user });
        
        // Fetch profile and role info
        const { data: profile, error } = await supabase
          .from('agents')
          .select('*, roles(name)')
          .eq('id', user.id)
          .single();

        if (!error && profile) {
          const roleName = profile.roles?.name || profile.role || 'Member';
          set({ 
            profile: { ...profile, role: roleName },
            isSuperAdmin: roleName === 'Super Admin'
          });

          // Fetch granular permissions if role_id exists
          if (profile.role_id) {
            await useRoleStore.getState().fetchUserPermissions(profile.role_id);
          }
        }
      } else {
        set({ user: null, profile: null, isSuperAdmin: false });
        useRoleStore.getState().reset();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isSuperAdmin: false });
    window.location.href = '/login';
  }
}));
