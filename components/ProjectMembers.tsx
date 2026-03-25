'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Search, UserPlus, Users, Loader2, Check, 
    Trash2, AlertCircle, Shield, Mail
} from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { createClient } from '@/utils/supabase/client';

interface ProjectMembersProps {
    projectId: string;
    projectName?: string;
    projectColor?: string;
    onClose: () => void;
    onMembersChanged?: () => void;
}

const AVATAR_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    'bg-rose-500'
];

function getAvatarColor(userId: string) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export function ProjectMembers({
    projectId,
    projectName = 'Project',
    projectColor = '#6366F1',
    onClose,
    onMembersChanged,
}: ProjectMembersProps) {
    const supabase = createClient();
    const { fetchMembers, addMember, removeMember } = useProjectStore();
    const { user: currentUser } = useUserStore();
    
    const [agents, setAgents] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState<string | null>(null);
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch current project members
            const { data: membersData } = await fetchMembers(projectId);
            if (membersData) setMembers(membersData);
            
            // 2. Fetch the project's company_id to scope potential new members
            const { data: projectData } = await supabase
                .from('projects')
                .select('company_id')
                .eq('id', projectId)
                .single();

            if (projectData?.company_id) {
                // 3. Fetch agents who are members of this company
                const { data: cmData } = await supabase
                    .from('company_members')
                    .select('agents(*)')
                    .eq('company_id', projectData.company_id)
                    .order('agents(name)');
                
                if (cmData) {
                    const companyAgents = cmData.map((cm: any) => cm.agents).filter(Boolean);
                    setAgents(companyAgents);
                }
            } else {
                // If company_id is null (Global/Old projects), maybe show all agents?
                // Or better, handle it similarly as Global.
                const { data: agentsData } = await supabase.from('agents').select('*').order('name');
                if (agentsData) setAgents(agentsData);
            }
        } catch (err) {
            console.error('Failed to load project members:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (userId: string) => {
        setIsAdding(userId);
        try {
            const { success, error } = await addMember(projectId, userId);
            if (success) {
                setSearchQuery('');
                setShowSearch(false);
                await loadData();
                onMembersChanged?.();
            } else {
                alert(error || 'Failed to add member');
            }
        } finally {
            setIsAdding(null);
        }
    };

    const handleRemoveMember = async (userId: string, userName: string) => {
        if (window.confirm(`Remove ${userName} from this project?`)) {
            const { success, error } = await removeMember(projectId, userId);
            if (success) {
                await loadData();
                onMembersChanged?.();
            } else {
                alert(error || 'Failed to remove member');
            }
        }
    };

    const getAgentName = (userId: string) => {
        const agent = agents.find(u => u.id === userId);
        return agent ? agent.name : 'Unknown User';
    };

    const getAgentEmail = (userId: string) => {
        const agent = agents.find(u => u.id === userId);
        return agent ? agent.email : '';
    };

    const availableUsers = agents.filter(u => 
        u.email && 
        !members.some(m => m.user_id === u.id) &&
        (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-card-bg border border-card-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-card-border flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: projectColor }} />
                        <div>
                            <h2 className="text-xl font-black text-foreground">{projectName}</h2>
                            <p className="text-sm font-bold text-foreground/50 uppercase tracking-widest">
                                {members.length} {members.length === 1 ? 'member' : 'members'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl bg-input-bg border border-input-border text-foreground/40 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Search & Add Section */}
                    <div className="mb-8">
                        {!showSearch ? (
                            <button 
                                onClick={() => setShowSearch(true)}
                                className="w-full py-4 border-2 border-dashed border-primary/20 rounded-2xl flex items-center justify-center gap-3 text-primary font-black hover:bg-primary/5 hover:border-primary/40 transition-all group"
                            >
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <UserPlus size={16} />
                                </div>
                                ADD TEAM MEMBER
                            </button>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-input-bg border border-input-border rounded-2xl pl-12 pr-12 py-4 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                                        autoFocus
                                    />
                                    <button 
                                        onClick={() => {
                                            setShowSearch(false);
                                            setSearchQuery('');
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {searchQuery.trim() && (
                                    <div className="bg-input-bg border border-input-border rounded-2xl overflow-hidden shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                        {availableUsers.length > 0 ? (
                                            availableUsers.map(user => (
                                                <button
                                                    key={user.id}
                                                    onClick={() => handleAddMember(user.id)}
                                                    disabled={!!isAdding}
                                                    className="w-full p-4 flex items-center gap-4 hover:bg-primary/5 transition-all group text-left border-b border-card-border last:border-0"
                                                >
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-inner ${getAvatarColor(user.id)}`}>
                                                        {getInitials(user.name)}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <h4 className="text-sm font-black text-foreground truncate">{user.name}</h4>
                                                        <p className="text-xs font-bold text-foreground/30 truncate">{user.email}</p>
                                                    </div>
                                                    {isAdding === user.id ? (
                                                        <Loader2 size={18} className="text-primary animate-spin" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <UserPlus size={14} />
                                                        </div>
                                                    )}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center">
                                                <AlertCircle size={32} className="mx-auto text-foreground/20 mb-3" />
                                                <p className="text-sm font-bold text-foreground/40">No matching users found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Member List */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Users size={16} className="text-primary" />
                            <h3 className="text-xs font-black text-foreground/40 uppercase tracking-[0.2em]">Project Members</h3>
                        </div>

                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                <p className="text-sm font-bold text-foreground/40 uppercase tracking-widest">Loading members...</p>
                            </div>
                        ) : members.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center px-10 border-2 border-dashed border-card-border rounded-3xl bg-input-bg/30">
                                <Shield size={48} className="text-foreground/10 mb-6" />
                                <h4 className="text-lg font-black text-foreground/60 mb-2">No members yet</h4>
                                <p className="text-sm font-bold text-foreground/30 uppercase tracking-widest max-w-xs">
                                    Add team members to give them access to this project
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {members.map(member => {
                                    const name = getAgentName(member.user_id);
                                    const email = getAgentEmail(member.user_id);
                                    const colorCls = getAvatarColor(member.user_id);
                                    const isMe = currentUser?.id === member.user_id;

                                    return (
                                        <div 
                                            key={member.id} 
                                            className="group flex items-center gap-4 p-4 rounded-2xl bg-input-bg/40 border border-input-border/30 hover:border-primary/30 hover:bg-card-bg transition-all shadow-sm"
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg ${colorCls} group-hover:scale-105 transition-transform`}>
                                                {getInitials(name)}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-[15px] font-black text-foreground truncate">{name}</h4>
                                                    {isMe && (
                                                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-tighter rounded-md border border-primary/20">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-foreground/30">
                                                    <Mail size={10} />
                                                    <p className="text-[11px] font-bold truncate tracking-tight">{email}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <div className="px-3 py-1 bg-foreground/5 text-foreground/40 text-[10px] font-black uppercase tracking-widest rounded-lg border border-foreground/5">
                                                    {member.role || 'Member'}
                                                </div>
                                                {!isMe && (
                                                    <button 
                                                        onClick={() => handleRemoveMember(member.user_id, name)}
                                                        className="p-2.5 rounded-xl text-foreground/20 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                        title="Remove from project"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-card-border bg-input-bg/30 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-10 py-3.5 bg-foreground text-background rounded-2xl text-sm font-black hover:bg-foreground/80 transition-all uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
