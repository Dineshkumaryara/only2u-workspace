'use client';

import { useEffect, useState } from 'react';
import { useCompanyStore, Company } from '@/stores/useCompanyStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useUserStore } from '@/stores/useUserStore';
import { useRouter } from 'next/navigation';
import {
  Building2, Plus, Search, Loader2, Users, Trash2,
  Edit2, X, CheckCircle2, AlertCircle, UserPlus,
  UserMinus, Eye
} from 'lucide-react';
import Link from 'next/link';

// Deterministic color from company name
function getCompanyColor(name: string): string {
  const colors = ['#6366F1', '#E24681', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#F43F5E', '#14B8A6', '#EF4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function CompaniesPage() {
  const router = useRouter();
  const { isSuperAdmin, loading: userLoading, fetchUser } = useUserStore();
  const {
    companies, companyMembers, memberCounts,
    loading, fetchCompanies, createCompany, updateCompany, deleteCompany,
    fetchCompanyMembers, addCompanyMember, removeCompanyMember, fetchAllMemberCounts,
  } = useCompanyStore();
  const { agents, fetchAgents } = useRoleStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Members modal
  const [membersCompany, setMembersCompany] = useState<Company | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchAgents();
  }, []);

  useEffect(() => {
    if (!userLoading && !isSuperAdmin) router.push('/');
  }, [userLoading, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCompanies();
      fetchAllMemberCounts();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (membersCompany) fetchCompanyMembers(membersCompany.id);
  }, [membersCompany]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    const result = await createCompany(newName.trim());
    setIsCreating(false);
    if (result.success) {
      setNewName('');
      setShowCreate(false);
      fetchAllMemberCounts();
      showMsg('success', `Company "${result.data?.name}" created`);
    } else {
      showMsg('error', result.error || 'Failed to create company');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany || !editName.trim()) return;
    setIsSaving(true);
    const result = await updateCompany(editCompany.id, editName.trim());
    setIsSaving(false);
    if (result.success) {
      setEditCompany(null);
      showMsg('success', 'Company updated');
    } else {
      showMsg('error', result.error || 'Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteCompany(deleteTarget.id);
    setIsDeleting(false);
    if (result.success) {
      setDeleteTarget(null);
      showMsg('success', `Company deleted`);
    } else {
      showMsg('error', result.error || 'Failed to delete');
    }
  };

  const handleAddMember = async (agentId: string) => {
    if (!membersCompany) return;
    setAddingMember(true);
    const result = await addCompanyMember(membersCompany.id, agentId);
    setAddingMember(false);
    if (!result.success) showMsg('error', result.error || 'Failed to add member');
  };

  const handleRemoveMember = async (agentId: string) => {
    if (!membersCompany) return;
    await removeCompanyMember(membersCompany.id, agentId);
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentMemberAgentIds = new Set(companyMembers.map(m => m.agent_id));
  const availableToAdd = agents.filter(a =>
    !currentMemberAgentIds.has(a.id) &&
    a.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden animate-in fade-in duration-500">
      <div className="p-4 sm:p-6 md:p-10 w-full max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Building2 className="text-primary w-8 h-8 md:w-10 md:h-10 shrink-0" />
              Companies
            </h1>
            <p className="text-foreground/40 mt-2 text-[10px] md:text-sm font-bold uppercase tracking-widest">
              Manage your company workspaces
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="group px-6 py-4 bg-primary text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center justify-center active:scale-95 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            New Company
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300 border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-bold">{message.text}</span>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-8 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-card-bg border border-card-border rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold outline-none focus:border-primary/50 transition-all"
          />
        </div>

        {/* Companies Grid */}
        {loading && companies.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-card-border rounded-3xl">
            <Building2 size={56} className="mx-auto text-foreground/10 mb-4" />
            <h3 className="text-xl font-black text-foreground/30 uppercase tracking-tight">No Companies Yet</h3>
            <p className="text-foreground/20 text-xs font-bold uppercase tracking-widest mt-2">Create your first company workspace</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCompanies.map(company => {
              const color = getCompanyColor(company.name);
              const count = memberCounts[company.id] || 0;
              return (
                <div key={company.id} className="group glass-card border border-card-border rounded-3xl p-6 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 relative flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {company.name[0].toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="text-lg font-black text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                          {company.name}
                        </h3>
                        <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                          <Users size={10} /> {count} member{count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto pt-4 border-t border-card-border">
                    <Link
                      href={`/companies/${company.id}`}
                      className="flex-1 py-2.5 rounded-xl bg-input-bg text-foreground/50 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary border border-card-border transition-all flex items-center justify-center gap-1.5"
                    >
                      <Eye size={13} /> Overview
                    </Link>
                    <button
                      onClick={() => setMembersCompany(company)}
                      className="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1.5"
                    >
                      <Users size={13} /> Members
                    </button>
                    <button
                      onClick={() => { setEditCompany(company); setEditName(company.name); }}
                      className="p-2.5 rounded-xl bg-input-bg text-foreground/40 hover:text-primary hover:bg-primary/5 border border-card-border transition-all"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(company)}
                      className="p-2.5 rounded-xl bg-input-bg text-foreground/40 hover:text-red-500 hover:bg-red-500/5 border border-card-border transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card-bg border border-card-border rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <form onSubmit={handleCreate} className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">New Company</h2>
                  <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest mt-1">Create a new workspace</p>
                </div>
                <button type="button" onClick={() => setShowCreate(false)} className="p-2.5 rounded-xl bg-input-bg text-foreground/30 hover:text-red-500 hover:bg-red-500/5 transition-all">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2 mb-8">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Company Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Acme Corporation..."
                  className="w-full bg-input-bg border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 py-4 text-sm font-black text-foreground outline-none transition-all placeholder:text-foreground/10"
                />
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-foreground/40 hover:bg-input-bg transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating || !newName.trim()} className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95">
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editCompany && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card-bg border border-card-border rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <form onSubmit={handleEdit} className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Edit Company</h2>
                  <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest mt-1">Update workspace details</p>
                </div>
                <button type="button" onClick={() => setEditCompany(null)} className="p-2.5 rounded-xl bg-input-bg text-foreground/30 hover:text-red-500 hover:bg-red-500/5 transition-all">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2 mb-8">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Company Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-input-bg border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 py-4 text-sm font-black text-foreground outline-none transition-all"
                />
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setEditCompany(null)} className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-foreground/40 hover:bg-input-bg transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving || !editName.trim()} className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card-bg border border-card-border rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 p-8">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">Delete Company</h2>
            <p className="text-sm font-bold text-foreground/40 mb-8">
              Are you sure you want to delete <span className="text-foreground font-black">"{deleteTarget.name}"</span>? This will remove all company members and cannot be undone.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-foreground/40 hover:bg-input-bg transition-all">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-500/20 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {membersCompany && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card-bg border border-card-border rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
            {/* Modal Header */}
            <div className="p-8 pb-4 border-b border-card-border shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0"
                    style={{ backgroundColor: getCompanyColor(membersCompany.name) }}
                  >
                    {membersCompany.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">{membersCompany.name}</h2>
                    <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest mt-0.5">
                      {companyMembers.length} member{companyMembers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setMembersCompany(null); setMemberSearch(''); }} className="p-2.5 rounded-xl bg-input-bg text-foreground/30 hover:text-red-500 hover:bg-red-500/5 transition-all shrink-0">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
              {/* Current Members */}
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30 mb-3 ml-1">Current Members</h3>
                {companyMembers.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-card-border rounded-2xl">
                    <Users size={28} className="mx-auto text-foreground/10 mb-2" />
                    <p className="text-[10px] font-black text-foreground/20 uppercase tracking-widest">No members yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {companyMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between gap-4 p-4 bg-input-bg/50 rounded-2xl border border-card-border">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm">
                            {member.agents?.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground uppercase tracking-tight">{member.agents?.name}</p>
                            <p className="text-[10px] font-bold text-foreground/30">{member.agents?.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.agent_id)}
                          className="p-2 rounded-xl text-foreground/20 hover:text-red-500 hover:bg-red-500/5 transition-all"
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Members */}
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/30 mb-3 ml-1">Add Members</h3>
                <div className="relative mb-3 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-primary transition-colors" size={15} />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full bg-input-bg border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {availableToAdd.length === 0 ? (
                    <p className="text-center text-[10px] font-black text-foreground/20 uppercase tracking-widest py-4">All agents already added</p>
                  ) : (
                    availableToAdd.map(agent => (
                      <div key={agent.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-transparent hover:border-card-border hover:bg-input-bg/40 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-input-bg border border-card-border flex items-center justify-center text-foreground/40 font-black text-sm">
                            {agent.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground uppercase tracking-tight">{agent.name}</p>
                            <p className="text-[10px] font-bold text-foreground/30">{agent.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(agent.id)}
                          disabled={addingMember}
                          className="p-2 rounded-xl text-foreground/30 hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                        >
                          <UserPlus size={15} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
