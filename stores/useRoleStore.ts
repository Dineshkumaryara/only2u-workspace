import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';

// Types
export interface Role {
    id: string;
    name: string;
    description: string | null;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface RolePermission {
    id: string;
    role_id: string;
    section: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  role_id: string | null;
  department: string | null;
  is_active: boolean;
  roles?: { name: string };
}

export type AppSection =
    | 'purchase_app'
    | 'bill_entry'
    | 'hit_selection'
    | 'task_management'
    | 'user_management'
    | 'hsn_master'
    | 'role_management'
    | 'company_management';

export type PermissionAction = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';

export const APP_SECTIONS: { key: AppSection; label: string }[] = [
    { key: 'purchase_app', label: 'Purchase App' },
    { key: 'bill_entry', label: 'Bill Entry' },
    { key: 'hit_selection', label: 'Hit Selection' },
    { key: 'task_management', label: 'Task Management' },
    { key: 'user_management', label: 'User Management' },
    { key: 'hsn_master', label: 'HSN Master' },
    { key: 'role_management', label: 'Role Management' },
    { key: 'company_management', label: 'Company Management' },
];

interface RoleState {
    // Current user's permissions
    userPermissions: RolePermission[];
    userRole: Role | null;
    permissionsLoaded: boolean;

    // All roles (for admin)
    roles: Role[];
    agents: Agent[];
    rolesLoading: boolean;

    // Actions
    fetchUserPermissions: (roleId: string) => Promise<void>;
    hasPermission: (section: AppSection, action?: PermissionAction) => boolean;
    isSuperAdmin: () => boolean;

    // Admin CRUD
    fetchRoles: () => Promise<void>;
    fetchAgents: () => Promise<void>;
    fetchRolePermissions: (roleId: string) => Promise<RolePermission[]>;
    createRole: (name: string, description: string, permissions: Partial<RolePermission>[]) => Promise<{ success: boolean; data?: Role; error?: string }>;
    updateRole: (roleId: string, name: string, description: string, permissions: Partial<RolePermission>[]) => Promise<{ success: boolean; error?: string }>;
    deleteRole: (roleId: string) => Promise<{ success: boolean; error?: string }>;
    assignRole: (agentId: string, roleId: string) => Promise<{ success: boolean; error?: string }>;
    getRoleMemberCount: (roleId: string) => Promise<number>;

    // Reset
    reset: () => void;
}

const supabase = createClient();

export const useRoleStore = create<RoleState>((set, get) => ({
    userPermissions: [],
    userRole: null,
    permissionsLoaded: false,
    roles: [],
    agents: [],
    rolesLoading: false,

    // Fetch current user's permissions based on their role_id
    fetchUserPermissions: async (roleId: string) => {
        try {
            // Fetch role info
            const { data: role, error: roleError } = await supabase
                .from('roles')
                .select('*')
                .eq('id', roleId)
                .single();

            if (roleError) throw roleError;

            // Fetch permissions for this role
            const { data: permissions, error: permError } = await supabase
                .from('role_permissions')
                .select('*')
                .eq('role_id', roleId);

            if (permError) throw permError;

            set({
                userRole: role || null,
                userPermissions: permissions || [],
                permissionsLoaded: true,
            });
        } catch (error: any) {
            console.error('Failed to fetch permissions:', error);
            set({ permissionsLoaded: true });
        }
    },

    // Check if current user has a specific permission
    hasPermission: (section: AppSection, action: PermissionAction = 'can_view') => {
        const { userPermissions, userRole } = get();

        // Super Admin always has access
        if (userRole?.name === 'Super Admin') return true;

        const perm = userPermissions.find(p => p.section === section);
        if (!perm) return false;
        return perm[action] === true;
    },

    // Check if current user is Super Admin
    isSuperAdmin: () => {
        const { userRole } = get();
        return userRole?.name === 'Super Admin';
    },

    // Fetch all roles (admin)
    fetchRoles: async () => {
        set({ rolesLoading: true });
        try {
            const { data, error } = await supabase
                .from('roles')
                .select('*')
                .order('is_system', { ascending: false })
                .order('name', { ascending: true });

            if (error) throw error;
            set({ roles: data || [], rolesLoading: false });
        } catch (error: any) {
            console.error('Failed to fetch roles:', error);
            set({ rolesLoading: false });
        }
    },

    fetchAgents: async () => {
        set({ rolesLoading: true });
        try {
          const { data, error } = await supabase
            .from('agents')
            .select('*, roles(name)')
            .eq('is_active', true)
            .order('name', { ascending: true });
    
          if (error) throw error;
          set({ agents: (data as any) || [] });
        } catch (error) {
          console.error('Error fetching agents:', error);
        } finally {
          set({ rolesLoading: false });
        }
    },

    // Fetch permissions for a specific role
    fetchRolePermissions: async (roleId: string) => {
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('*')
                .eq('role_id', roleId);

            if (error) throw error;
            return data || [];
        } catch (error: any) {
            console.error('Failed to fetch role permissions:', error);
            return [];
        }
    },

    // Create a new role with permissions
    createRole: async (name, description, permissions) => {
        try {
            // Create role
            const { data: role, error: roleError } = await supabase
                .from('roles')
                .insert({ name, description, is_system: false })
                .select()
                .single();

            if (roleError) throw roleError;

            // Insert permissions
            const permInserts = permissions.map(p => ({
                role_id: role.id,
                section: p.section!,
                can_view: p.can_view || false,
                can_create: p.can_create || false,
                can_edit: p.can_edit || false,
                can_delete: p.can_delete || false,
            }));

            if (permInserts.length > 0) {
                const { error: permError } = await supabase
                    .from('role_permissions')
                    .insert(permInserts);

                if (permError) throw permError;
            }

            // Refresh roles list
            await get().fetchRoles();
            return { success: true, data: role };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Update an existing role and its permissions
    updateRole: async (roleId, name, description, permissions) => {
        try {
            // Update role name/description
            const { error: roleError } = await supabase
                .from('roles')
                .update({ name, description, updated_at: new Date().toISOString() })
                .eq('id', roleId);

            if (roleError) throw roleError;

            // Delete existing permissions and re-insert
            const { error: delError } = await supabase
                .from('role_permissions')
                .delete()
                .eq('role_id', roleId);

            if (delError) throw delError;

            // Insert updated permissions
            const permInserts = permissions.map(p => ({
                role_id: roleId,
                section: p.section!,
                can_view: p.can_view || false,
                can_create: p.can_create || false,
                can_edit: p.can_edit || false,
                can_delete: p.can_delete || false,
            }));

            if (permInserts.length > 0) {
                const { error: permError } = await supabase
                    .from('role_permissions')
                    .insert(permInserts);

                if (permError) throw permError;
            }

            // Refresh roles list
            await get().fetchRoles();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Delete a role (only non-system roles)
    deleteRole: async (roleId) => {
        try {
            // First unassign all agents from this role
            const { error: unassignError } = await supabase
                .from('agents')
                .update({ role_id: null })
                .eq('role_id', roleId);

            if (unassignError) throw unassignError;

            const { error } = await supabase
                .from('roles')
                .delete()
                .eq('id', roleId)
                .eq('is_system', false); // Safety: can't delete system roles

            if (error) throw error;

            await get().fetchRoles();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Assign a role to a user
    assignRole: async (agentId, roleId) => {
        try {
            // Get role name for the legacy role column
            const { data: role } = await supabase
                .from('roles')
                .select('name')
                .eq('id', roleId)
                .single();

            const { error } = await supabase
                .from('agents')
                .update({ role_id: roleId, role: role?.name || 'Member' })
                .eq('id', agentId);

            if (error) throw error;
            
            await get().fetchAgents();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // Get number of members with a specific role
    getRoleMemberCount: async (roleId: string) => {
        try {
            const { count, error } = await supabase
                .from('agents')
                .select('*', { count: 'exact', head: true })
                .eq('role_id', roleId);

            if (error) return 0;
            return count || 0;
        } catch {
            return 0;
        }
    },

    // Reset store
    reset: () => {
        set({
            userPermissions: [],
            userRole: null,
            permissionsLoaded: false,
            roles: [],
            agents: [],
            rolesLoading: false,
        });
    },
}));
