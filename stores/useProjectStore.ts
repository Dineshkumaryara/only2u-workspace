import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { useCompanyStore } from '@/stores/useCompanyStore';

// The "Global" company — projects with no company_id belong here
export const GLOBAL_COMPANY_ID = '02109d78-73c2-4ce3-9c37-dbc64de6c202';

// Project Types
export interface Project {
    id: string;
    name: string;
    description: string | null;
    parent_project_id?: string | null;
    status: 'active' | 'archived' | 'completed';
    color: string;
    created_at: string;
    user_id: string;
    updated_at: string;
    company_id?: string | null;
}

interface ProjectState {
    projects: Project[];
    loading: boolean;
    error: string | null;
    memberCounts: Record<string, number>;

    // Actions
    fetchProjects: () => Promise<void>;
    createProject: (name: string, description?: string, color?: string, parentProjectId?: string) => Promise<{ success: boolean; data?: Project; error?: string }>;
    updateProject: (id: string, name: string, description?: string | null, color?: string) => Promise<{ success: boolean; error?: string }>;
    updateProjectStatus: (id: string, status: 'active' | 'archived' | 'completed') => Promise<{ success: boolean; error?: string }>;
    deleteProject: (id: string) => Promise<{ success: boolean; error?: string }>;
    getProjectById: (id: string) => Project | undefined;
    clearError: () => void;
    addMember: (projectId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
    removeMember: (projectId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
    fetchMembers: (projectId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    fetchAllMemberCounts: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    loading: false,
    error: null,
    memberCounts: {},

    // Fetch all projects — scoped to active company
    fetchProjects: async () => {
        const supabase = createClient();
        set({ loading: true, error: null });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const isSuperAdmin = useUserStore.getState().isSuperAdmin;
            const activeCompany = useCompanyStore.getState().activeCompany;

            // If no company is selected, show no projects
            if (!activeCompany) {
                set({ projects: [], loading: false });
                return;
            }

            const isGlobal = activeCompany.id === GLOBAL_COMPANY_ID;

            // For Global company: also include projects with NULL company_id (legacy/unscoped)
            // For other companies: strictly match company_id
            let query = supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (isGlobal) {
                query = query.or(`company_id.eq.${GLOBAL_COMPANY_ID},company_id.is.null`);
            } else {
                query = query.eq('company_id', activeCompany.id);
            }

            if (!isSuperAdmin) {
                // Non-admins can only see projects they created or are a member of
                const { data: memberData } = await supabase
                    .from('project_members')
                    .select('project_id')
                    .eq('user_id', user.id);

                const memberProjectIds = memberData?.map(m => m.project_id) || [];

                if (memberProjectIds.length > 0) {
                    query = query.or(`user_id.eq.${user.id},id.in.(${memberProjectIds.map(id => `"${id}"`).join(',')})`);
                } else {
                    query = query.eq('user_id', user.id);
                }
            }

            const { data, error } = await query;

            if (error) throw error;

            set({
                projects: data || [],
                loading: false,
            });
        } catch (error: any) {
            set({
                error: error.message || 'Failed to fetch projects',
                loading: false,
            });
        }
    },

    // Create a new project — stamps company_id
    createProject: async (name: string, description?: string, color: string = '#6366F1', parentProjectId?: string) => {
        const supabase = createClient();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const activeCompany = useCompanyStore.getState().activeCompany;

            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name,
                    description: description || null,
                    parent_project_id: parentProjectId || null,
                    color,
                    user_id: user.id,
                    company_id: activeCompany?.id || null,
                })
                .select()
                .single();

            if (error) throw error;

            set((state) => ({
                projects: [data, ...state.projects],
            }));

            return { success: true, data };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Update project status
    updateProjectStatus: async (id: string, status: 'active' | 'archived' | 'completed') => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('projects')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            set((state) => ({
                projects: state.projects.map(p =>
                    p.id === id ? { ...p, status } : p
                ),
            }));

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Delete project
    deleteProject: async (id: string) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            set((state) => ({
                projects: state.projects.filter(p => p.id !== id),
            }));

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Update project name
    updateProject: async (id: string, name: string, description?: string | null, color?: string) => {
        const supabase = createClient();
        try {
            const updates: any = { name, updated_at: new Date().toISOString() };
            if (description !== undefined) updates.description = description;
            if (color !== undefined) updates.color = color;

            const { error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            set((state) => ({
                projects: state.projects.map(p =>
                    p.id === id ? { ...p, ...updates } : p
                ),
            }));

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Get project by ID
    getProjectById: (id: string) => {
        return get().projects.find(p => p.id === id);
    },

    // Clear error
    clearError: () => {
        set({ error: null });
    },

    // Member Management
    addMember: async (projectId: string, userId: string) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('project_members')
                .insert({
                    project_id: projectId,
                    user_id: userId,
                });

            if (error) throw error;

            // Generate notification for the added user
            const project = get().projects.find(p => p.id === projectId);
            const projectName = project ? project.name : 'a project';

            await supabase.from('notifications').insert({
                user_id: userId,
                title: 'Added to Project',
                message: `You have been added to ${projectName}`,
                type: 'project_added',
                reference_id: projectId
            });
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    removeMember: async (projectId: string, userId: string) => {
        const supabase = createClient();
        try {
            const { error } = await supabase
                .from('project_members')
                .delete()
                .match({ project_id: projectId, user_id: userId });

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    fetchAllMemberCounts: async () => {
        const supabase = createClient();
        try {
            const { projects } = get();
            if (projects.length === 0) return;

            // Single query to get all project_members instead of N+1 queries
            const { data, error } = await supabase
                .from('project_members')
                .select('project_id')
                .in('project_id', projects.map(p => p.id));

            if (error) {
                console.error('Failed to fetch member counts:', error);
                return;
            }

            const counts: Record<string, number> = {};
            // Initialize all projects with 0
            projects.forEach(p => { counts[p.id] = 0; });
            // Count members per project
            (data || []).forEach(row => {
                counts[row.project_id] = (counts[row.project_id] || 0) + 1;
            });

            set({ memberCounts: counts });
        } catch (error: any) {
            console.error('Failed to fetch member counts:', error);
        }
    },

    fetchMembers: async (projectId: string) => {
        const supabase = createClient();
        try {
            const { data: members, error: memberError } = await supabase
                .from('project_members')
                .select('*')
                .eq('project_id', projectId);

            if (memberError) throw memberError;
            return { success: true, data: members };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}));
