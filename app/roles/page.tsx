"use client";

import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  Trash2, 
  ChevronRight, 
  Loader2, 
  Users, 
  Check, 
  X,
  Info,
  ShieldAlert,
  Save,
  RotateCcw,
  Eye,
  EyeOff
} from "lucide-react";
import { useRoleStore, Role, APP_SECTIONS } from "@/stores/useRoleStore";
import { useUserStore } from "@/stores/useUserStore";
import { useRouter } from "next/navigation";

export default function RoleManagementPage() {
  const router = useRouter();
  const { isSuperAdmin } = useUserStore();
  const { 
    roles, 
    rolesLoading, 
    fetchRoles, 
    createRole, 
    updateRole, 
    deleteRole, 
    fetchRolePermissions, 
    getRoleMemberCount 
  } = useRoleStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [permissions, setPermissions] = useState<Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      // router.push("/"); // Only super admins can manage roles
    }
    fetchRoles();
  }, [fetchRoles, isSuperAdmin]);

  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const role of roles) {
        counts[role.id] = await getRoleMemberCount(role.id);
      }
      setMemberCounts(counts);
    };
    if (roles.length > 0) fetchCounts();
  }, [roles, getRoleMemberCount]);

  const initPermissions = () => {
    const perms: Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }> = {};
    APP_SECTIONS.forEach(s => {
      perms[s.key] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
    });
    return perms;
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setPermissions(initPermissions());
    setShowModal(true);
  };

  const openEditModal = async (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");

    setFetchingPerms(true);
    const existingPerms = await fetchRolePermissions(role.id);
    const perms = initPermissions();
    existingPerms.forEach(p => {
      if (perms[p.section]) {
        perms[p.section] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        };
      }
    });
    setPermissions(perms);
    setFetchingPerms(false);
    setShowModal(true);
  };

  const [fetchingPerms, setFetchingPerms] = useState(false);

  const togglePermission = (section: string, action: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setPermissions(prev => {
      const updated = { ...prev };
      const current = { ...updated[section] };
      current[action] = !current[action];
      
      // If disabling can_view, disable all other permissions too
      if (action === 'can_view' && !current.can_view) {
        current.can_create = false;
        current.can_edit = false;
        current.can_delete = false;
      }
      // If enabling any other permission, auto-enable can_view
      if (action !== 'can_view' && current[action]) {
        current.can_view = true;
      }
      
      updated[section] = current;
      return updated;
    });
  };

  const toggleAllForSection = (section: string) => {
    setPermissions(prev => {
      const current = prev[section];
      const allEnabled = current.can_view && current.can_create && current.can_edit && current.can_delete;
      return {
        ...prev,
        [section]: {
          can_view: !allEnabled,
          can_create: !allEnabled,
          can_edit: !allEnabled,
          can_delete: !allEnabled,
        }
      };
    });
  };

  const handleSave = async () => {
    if (!roleName.trim()) return;
    setSaving(true);

    const permArray = Object.entries(permissions).map(([section, perms]) => ({
      section,
      ...perms,
    }));

    let result;
    if (editingRole) {
      result = await updateRole(editingRole.id, roleName.trim(), roleDescription.trim(), permArray);
    } else {
      result = await createRole(roleName.trim(), roleDescription.trim(), permArray);
    }

    setSaving(false);
    if (result.success) {
      setShowModal(false);
    } else {
      alert(result.error || "Failed to save role");
    }
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-in animate-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center">
            <ShieldCheck className="mr-3 text-primary size-8" />
            Role Management
          </h1>
          <p className="text-foreground/60 mt-2 text-sm max-w-xl font-medium">
            Define system roles and granular permissions to control access across all modules of the application.
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:scale-95 group"
        >
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
          Create Security Role
        </button>
      </div>

      {/* Control Bar */}
      <div className="glass-card rounded-2xl p-4 mb-8 flex flex-col md:flex-row items-center gap-4 border border-card-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input 
            type="text" 
            placeholder="Search within roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input-bg border border-input-border rounded-xl pl-10 pr-4 py-3 text-sm font-medium outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Roles Grid */}
      {rolesLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-bold text-foreground/40 mt-4 uppercase tracking-widest">Hydrating roles...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map((role) => (
            <div 
              key={role.id} 
              className="glass-card rounded-3xl p-6 border border-card-border/50 hover:border-primary/50 transition-all group/card relative flex flex-col h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${role.is_system ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-input-bg text-primary group-hover/card:bg-primary/10'}`}>
                  {role.is_system ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                </div>
                {role.is_system && (
                  <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">System</span>
                )}
              </div>

              <h3 className="text-xl font-black text-foreground mb-2 group-hover/card:text-primary transition-colors">{role.name}</h3>
              <p className="text-sm text-foreground/50 line-clamp-2 mb-6 font-medium flex-1">
                {role.description || "No description provided for this security role."}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-card-border/30">
                <div className="flex items-center gap-2 text-foreground/40 font-bold text-xs">
                  <Users size={14} />
                  <span>{memberCounts[role.id] || 0} Members</span>
                </div>
                <div className="flex items-center gap-2">
                   {!role.is_system && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete the "${role.name}" role?`)) deleteRole(role.id);
                      }}
                      className="p-2.5 rounded-xl bg-red-500/5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                   )}
                   <button 
                    onClick={() => openEditModal(role)}
                    className="p-2.5 rounded-xl bg-primary/5 text-primary/60 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 flex items-center gap-2 font-bold text-xs"
                   >
                    Configure
                    <ChevronRight size={14} />
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Modal */}
      {showModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !saving && setShowModal(false)} />
          
          <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[2.5rem] border border-card-border shadow-2xl animate-in zoom-in-95 fade-in duration-300 relative z-10 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-8 border-b border-card-border bg-card-bg/50 backdrop-blur-md flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-black text-foreground flex items-center">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mr-3">
                    <ShieldCheck className="text-primary" size={18} />
                  </div>
                  {editingRole ? `Edit ${editingRole.name}` : 'Create New Security Role'}
                </h2>
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-[0.2em] mt-1 ml-11">Security Configuration</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-3 rounded-2xl bg-input-bg/50 text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Information Column */}
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 ml-1">Role Identity</label>
                    <input 
                      type="text"
                      placeholder="e.g. Project Manager"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      disabled={editingRole?.is_system}
                      className="w-full bg-input-bg/50 border border-input-border rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 ml-1">Core Description</label>
                    <textarea 
                      placeholder="Briefly describe the responsibilities of this role..."
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      rows={4}
                      className="w-full bg-input-bg/50 border border-input-border rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                    />
                  </div>

                  <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 space-y-4">
                    <h4 className="flex items-center text-xs font-black text-primary uppercase tracking-wider">
                      <Info size={14} className="mr-2" />
                      Quick Access Presets
                    </h4>
                    <div className="space-y-2">
                       <button 
                        onClick={() => {
                          const p = initPermissions();
                          Object.keys(p).forEach(k => p[k] = { can_view: true, can_create: true, can_edit: true, can_delete: true });
                          setPermissions(p);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-card-bg border border-input-border hover:border-primary/50 transition-all text-left group"
                       >
                          <span className="text-xs font-bold text-foreground/70 group-hover:text-primary">Grant All Access</span>
                          <Check size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                       </button>
                       <button 
                        onClick={() => {
                          const p = initPermissions();
                          Object.keys(p).forEach(k => p[k] = { can_view: true, can_create: false, can_edit: false, can_delete: false });
                          setPermissions(p);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-card-bg border border-input-border hover:border-primary/50 transition-all text-left group"
                       >
                          <span className="text-xs font-bold text-foreground/70 group-hover:text-primary">View-Only Mode</span>
                          <Eye size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                       </button>
                       <button 
                        onClick={() => setPermissions(initPermissions())}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-card-bg border border-input-border hover:border-red-500/30 transition-all text-left group"
                       >
                          <span className="text-xs font-bold text-foreground/70 group-hover:text-red-500">Revoke Everything</span>
                          <X size={14} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                       </button>
                    </div>
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="lg:col-span-2">
                  <div className="bg-input-bg/30 rounded-3xl border border-card-border p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 ml-1">Sectional Permissions</label>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-foreground/30 uppercase tracking-widest"><Check size={8} /> On</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-foreground/30 uppercase tracking-widest"><X size={8} /> Off</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {fetchingPerms ? (
                        <div className="py-10 flex flex-col items-center justify-center">
                          <Loader2 className="animate-spin text-primary" />
                        </div>
                      ) : (
                        APP_SECTIONS.map((section) => {
                          const perm = permissions[section.key];
                          if (!perm) return null;
                          const allOn = perm.can_view && perm.can_create && perm.can_edit && perm.can_delete;

                          return (
                            <div key={section.key} className="p-4 rounded-2xl bg-card-bg/50 border border-card-border/50 transition-all hover:bg-card-bg">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <button 
                                  onClick={() => toggleAllForSection(section.key)}
                                  className="flex items-center gap-3 group"
                                >
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${allOn ? 'bg-primary text-white' : 'bg-input-bg text-foreground/30 group-hover:bg-primary/20 group-hover:text-primary'}`}>
                                    {allOn ? <Check size={16} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                  </div>
                                  <div className="flex flex-col items-start leading-none">
                                    <span className={`text-sm font-black transition-colors ${allOn ? 'text-primary' : 'text-foreground/70 group-hover:text-foreground'}`}>{section.label}</span>
                                    <span className="text-[9px] font-black text-foreground/20 uppercase tracking-tighter mt-0.5">App Section</span>
                                  </div>
                                </button>

                                <div className="grid grid-cols-4 gap-2 w-full sm:w-auto">
                                  {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map(action => (
                                    <button 
                                      key={action}
                                      onClick={() => togglePermission(section.key, action)}
                                      disabled={editingRole?.is_system && editingRole?.name === 'Super Admin'}
                                      className={`
                                        flex flex-col items-center justify-center py-2 px-3 rounded-xl border transition-all relative
                                        ${perm[action] 
                                          ? 'bg-primary/10 border-primary/30 text-primary shadow-inner' 
                                          : 'bg-input-bg border-transparent text-foreground/20 hover:text-foreground/40 hover:bg-input-border'
                                        }
                                      `}
                                    >
                                      {perm[action] ? <Eye size={14} className="mb-1" /> : <EyeOff size={14} className="mb-1" />}
                                      <span className="text-[8px] font-black uppercase tracking-tight">{action.split('_')[1]}</span>
                                      
                                      {perm[action] && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                                          <Check size={8} className="text-white" />
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-card-border bg-card-bg/80 backdrop-blur-md flex items-center justify-between shrink-0">
              <button 
                onClick={() => setPermissions(initPermissions())}
                className="flex items-center text-xs font-black text-foreground/30 hover:text-primary transition-colors gap-2 group uppercase tracking-widest"
              >
                <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                Reset Matrix
              </button>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3.5 rounded-2xl font-black text-sm text-foreground/40 hover:text-foreground transition-colors"
                >
                  Discard
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving || !roleName.trim()}
                  className="px-10 py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                  {saving ? 'Synchronizing...' : (editingRole ? 'Update Profile' : 'Authorize Role')}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
