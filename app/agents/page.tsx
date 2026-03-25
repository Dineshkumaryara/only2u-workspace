'use client';

import { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useRoleStore, Agent, Role } from '@/stores/useRoleStore';
import { 
  Users, 
  Shield, 
  Search, 
  MoreVertical, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Building2,
  Filter,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AgentManagementPage() {
  const router = useRouter();
  const { isSuperAdmin, loading: userLoading, fetchUser } = useUserStore();
  const { agents, roles, rolesLoading, fetchAgents, fetchRoles, assignRole } = useRoleStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchUser();
    fetchAgents();
    fetchRoles();
  }, []);

  // Redirect if not super admin
  useEffect(() => {
    if (!userLoading && !isSuperAdmin) {
      router.push('/');
    }
  }, [userLoading, isSuperAdmin, router]);

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (agent.roles?.name || agent.role || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const roleName = agent.roles?.name || agent.role || 'Member';
    const matchesRole = roleFilter === 'all' || roleName === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleRoleUpdate = async (roleId: string) => {
    if (!selectedAgent) return;
    
    setSaving(true);
    const result = await assignRole(selectedAgent.id, roleId);
    setSaving(false);
    
    if (result.success) {
      setMessage({ type: 'success', text: `Role updated for ${selectedAgent.name}` });
      setIsModalOpen(false);
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update role' });
    }
  };

  if (userLoading || (rolesLoading && agents.length === 0)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-2xl text-primary border border-primary/20">
              <Users size={30} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tighter">
                Agent <span className="text-primary italic">Management</span>
              </h1>
              <p className="text-foreground/40 text-sm font-bold uppercase tracking-wider mt-1 flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" /> Manage team access and roles
              </p>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search members, emails or roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-card-bg border border-card-border rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all shadow-sm"
            />
          </div>
          
          <div className="relative w-full sm:w-auto">
            <button 
              onClick={() => setIsFilterVisible(!isFilterVisible)}
              className={`w-full sm:w-auto px-6 py-4 border rounded-2xl transition-all flex items-center justify-center gap-2 ${isFilterVisible || roleFilter !== 'all' ? 'bg-primary/10 border-primary text-primary' : 'bg-input-bg border-card-border text-foreground/40 hover:text-primary'}`}
            >
              <Filter size={18} />
              <span className="text-sm font-bold uppercase tracking-widest">{roleFilter === 'all' ? 'All Roles' : roleFilter}</span>
            </button>

            {isFilterVisible && (
              <div className="absolute right-0 mt-3 w-64 bg-card-bg border border-card-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-2">
                  <button 
                    onClick={() => { setRoleFilter('all'); setIsFilterVisible(false); }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${roleFilter === 'all' ? 'bg-primary text-white' : 'hover:bg-input-bg text-foreground/40'}`}
                  >
                    All Agents
                  </button>
                  <div className="h-px bg-card-border my-1 mx-2" />
                  {roles.map(role => (
                    <button 
                      key={role.id}
                      onClick={() => { setRoleFilter(role.name); setIsFilterVisible(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${roleFilter === role.name ? 'bg-primary text-white' : 'hover:bg-input-bg text-foreground/40'}`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 border ${
          message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{message.text}</span>
        </div>
      )}

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {filteredAgents.map((agent) => {
          const roleName = agent.roles?.name || agent.role || 'Member';
          const isSuper = roleName === 'Super Admin';
          
          return (
            <div 
              key={agent.id} 
              className="group relative bg-card-bg border border-card-border rounded-3xl p-6 hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 flex flex-col"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-primary to-primary/60 p-px">
                    <div className="w-full h-full rounded-2xl bg-card-bg flex items-center justify-center text-primary font-black text-xl shadow-inner">
                      {agent.name[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors truncate max-w-[150px]">
                      {agent.name}
                    </h3>
                    <p className="text-[10px] font-bold text-foreground/30 truncate max-w-[150px]">
                      {agent.email}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedAgent(agent);
                    setIsModalOpen(true);
                  }}
                  className="p-3 text-foreground/20 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
                >
                  <MoreVertical size={20} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  isSuper 
                    ? 'bg-primary/10 text-primary border-primary/20' 
                    : 'bg-input-bg text-foreground/40 border-card-border'
                }`}>
                  {isSuper ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                  {roleName}
                </div>
                {agent.department && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-input-bg text-foreground/40 border-card-border">
                    <Building2 size={12} />
                    {agent.department}
                  </div>
                )}
              </div>
              
              {/* Card Decoration */}
              <div className="absolute -right-2 -bottom-2 w-20 h-20 bg-primary/2 rounded-full blur-3xl group-hover:bg-primary/5 transition-all duration-500" />
            </div>
          );
        })}

        {filteredAgents.length === 0 && (
          <div className="col-span-full py-20 text-center bg-card-bg/30 border-2 border-dashed border-card-border rounded-3xl">
            <Users size={64} className="mx-auto text-foreground/10 mb-6" />
            <h3 className="text-2xl font-black text-foreground/40 tracking-tight">No agents found</h3>
            <p className="text-foreground/20 text-sm font-bold uppercase tracking-widest mt-2">Try adjusting your search terms</p>
          </div>
        )}
      </div>

      {/* Role Management Modal */}
      {isModalOpen && selectedAgent && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={() => !saving && setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-card-bg border border-card-border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-500">
            <div className="p-8 pb-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-2xl shadow-inner">
                  {selectedAgent.name[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-foreground tracking-tighter">Update <span className="text-primary italic">Role</span></h2>
                  <p className="text-foreground/40 text-sm font-bold uppercase tracking-wider">{selectedAgent.name}</p>
                </div>
              </div>

              <p className="text-xs font-black text-foreground/20 uppercase tracking-[0.25em] mb-4 ml-1">Available Roles</p>
              
              <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar-thin">
                {roles.map((role) => {
                  const isActive = (selectedAgent.roles?.name || selectedAgent.role) === role.name;
                  
                  return (
                    <button
                      key={role.id}
                      disabled={saving || isActive}
                      onClick={() => handleRoleUpdate(role.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isActive 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-card-border hover:border-primary/50 hover:bg-primary/2 text-foreground/60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl border ${isActive ? 'bg-primary border-primary text-white' : 'bg-input-bg border-card-border text-foreground/20'}`}>
                          <Shield size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black uppercase tracking-tight">{role.name}</p>
                          {role.description && <p className="text-[10px] font-bold text-foreground/30 leading-tight pr-4">{role.description}</p>}
                        </div>
                      </div>
                      {saving && (selectedAgent.roles?.name || selectedAgent.role) !== role.name && <Loader2 size={16} className="animate-spin text-primary" />}
                      {isActive && <CheckCircle2 size={18} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-8 pt-4">
               <button 
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
                className="w-full py-4 text-sm font-head font-black uppercase tracking-[0.25em] text-foreground/40 hover:text-foreground transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
