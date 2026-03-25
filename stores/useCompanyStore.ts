import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { useUserStore } from '@/stores/useUserStore';

export interface Company {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  agent_id: string;
  role: string | null;
  is_default: boolean;
  created_at: string;
  agents?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface CompanyState {
  companies: Company[];
  activeCompany: Company | null;
  companyMembers: CompanyMember[];
  memberCounts: Record<string, number>;
  loading: boolean;

  // Actions
  fetchCompanies: () => Promise<void>;
  setActiveCompany: (company: Company | null) => void;
  createCompany: (name: string) => Promise<{ success: boolean; data?: Company; error?: string }>;
  updateCompany: (id: string, name: string) => Promise<{ success: boolean; error?: string }>;
  deleteCompany: (id: string) => Promise<{ success: boolean; error?: string }>;
  fetchCompanyMembers: (companyId: string) => Promise<void>;
  addCompanyMember: (companyId: string, agentId: string, role?: string) => Promise<{ success: boolean; error?: string }>;
  removeCompanyMember: (companyId: string, agentId: string) => Promise<{ success: boolean; error?: string }>;
  fetchAllMemberCounts: () => Promise<void>;
}

const ACTIVE_COMPANY_KEY = 'active_company_id';

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  activeCompany: null,
  companyMembers: [],
  memberCounts: {},
  loading: false,

  fetchCompanies: async () => {
    const supabase = createClient();
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isSuperAdmin = useUserStore.getState().isSuperAdmin;
      let data: Company[] = [];

      if (isSuperAdmin) {
        // Super admin sees all companies
        const { data: all } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });
        data = all || [];
      } else {
        // Regular user sees only companies they are members of
        const { data: memberships } = await supabase
          .from('company_members')
          .select('company_id, companies(*)')
          .eq('agent_id', user.id);

        data = (memberships || []).map((m: any) => m.companies).filter(Boolean);
      }

      set({ companies: data });

      // Restore active company from localStorage
      const storedId = localStorage.getItem(ACTIVE_COMPANY_KEY);
      if (storedId) {
        const match = data.find(c => c.id === storedId);
        set({ activeCompany: match || null });
      }
    } catch (e) {
      console.error('fetchCompanies error:', e);
    } finally {
      set({ loading: false });
    }
  },

  setActiveCompany: (company) => {
    if (company) {
      localStorage.setItem(ACTIVE_COMPANY_KEY, company.id);
    } else {
      localStorage.removeItem(ACTIVE_COMPANY_KEY);
    }
    set({ activeCompany: company });
  },

  createCompany: async (name) => {
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('companies')
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (error) throw error;

      set(state => ({ companies: [data, ...state.companies] }));
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  updateCompany: async (id, name) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('companies')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      set(state => ({
        companies: state.companies.map(c => c.id === id ? { ...c, name } : c),
        activeCompany: state.activeCompany?.id === id ? { ...state.activeCompany, name } : state.activeCompany,
      }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  deleteCompany: async (id) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;

      set(state => ({
        companies: state.companies.filter(c => c.id !== id),
        activeCompany: state.activeCompany?.id === id ? null : state.activeCompany,
      }));
      if (get().activeCompany?.id === id) {
        localStorage.removeItem(ACTIVE_COMPANY_KEY);
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  fetchCompanyMembers: async (companyId) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('company_members')
        .select('*, agents(id, name, email, role)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ companyMembers: data || [] });
    } catch (e) {
      console.error('fetchCompanyMembers error:', e);
    }
  },

  addCompanyMember: async (companyId, agentId, role = 'Member') => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('company_members')
        .insert({ company_id: companyId, agent_id: agentId, role });

      if (error) throw error;
      await get().fetchCompanyMembers(companyId);
      await get().fetchAllMemberCounts();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  removeCompanyMember: async (companyId, agentId) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('company_members')
        .delete()
        .match({ company_id: companyId, agent_id: agentId });

      if (error) throw error;
      await get().fetchCompanyMembers(companyId);
      await get().fetchAllMemberCounts();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  fetchAllMemberCounts: async () => {
    const supabase = createClient();
    try {
      const { companies } = get();
      if (companies.length === 0) return;

      const { data } = await supabase
        .from('company_members')
        .select('company_id')
        .in('company_id', companies.map(c => c.id));

      const counts: Record<string, number> = {};
      companies.forEach(c => { counts[c.id] = 0; });
      (data || []).forEach((row: any) => {
        counts[row.company_id] = (counts[row.company_id] || 0) + 1;
      });
      set({ memberCounts: counts });
    } catch (e) {
      console.error('fetchAllMemberCounts error:', e);
    }
  },
}));
