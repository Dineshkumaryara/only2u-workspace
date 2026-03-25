'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    ArrowLeft, Calendar, CheckCircle2, Clock, 
    Edit2, FolderPlus, Globe, LayoutGrid, 
    List as ListIcon, Loader2, MoreVertical, 
    Plus, Search, Settings, Trash2, Users,
    AlertCircle, Flag, Paperclip, MessageSquare, CheckSquare, X
} from 'lucide-react';
import { useProjectStore, Project, GLOBAL_COMPANY_ID } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { createClient } from '@/utils/supabase/client';
import { ProjectMembers } from '@/components/ProjectMembers';
import { format } from 'date-fns';
import Link from 'next/link';

export default function ProjectOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const supabase = createClient();
    
    const { 
        projects, fetchProjects, updateProject, 
        updateProjectStatus, deleteProject 
    } = useProjectStore();
    const { isSuperAdmin, user } = useUserStore();
    const { activeCompany } = useCompanyStore();

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    // Edit form state
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editColor, setEditColor] = useState('');
    const [memberCount, setMemberCount] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isCreatorOrAdmin = useMemo(() => {
        if (!project || !user) return false;
        return isSuperAdmin || project.user_id === user.id;
    }, [project, user, isSuperAdmin]);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!activeCompany) return;
            setLoading(true);
            try {
                // Fetch project (ignore store since switching companies needs fresh verification)
                const { data: currentProject, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (error || !currentProject) {
                    setProject(null);
                    return;
                }

                // SECURITY: Verify company match
                const isGlobal = activeCompany.id === GLOBAL_COMPANY_ID;
                const matchesCompany = isGlobal 
                    ? (currentProject.company_id === null || currentProject.company_id === GLOBAL_COMPANY_ID)
                    : (currentProject.company_id === activeCompany.id);

                if (!matchesCompany) {
                    // Mismatch! Redirect to projects list for safety
                    router.push('/task-management/projects');
                    return;
                }

                setProject(currentProject);
                setEditName(currentProject.name);
                setEditDesc(currentProject.description || '');
                setEditColor(currentProject.color);
                
                // Fetch tasks for this project
                const { data: taskData, error: taskError } = await supabase
                    .from('tasks')
                    .select('*, task_assignments(agent:agents(*)), task_attachments(*)')
                    .eq('project_id', id)
                    .order('created_at', { ascending: false });
                
                if (taskError) throw taskError;
                setTasks(taskData || []);

                // Fetch member count
                const { count, error: countError } = await supabase
                    .from('project_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('project_id', id);
                
                if (countError) throw countError;
                setMemberCount(count || 0);
            } catch (err) {
                console.error("Error loading project:", err);
            } finally {
                setLoading(false);
            }
        };

        if (id) loadProjectData();
    }, [id, activeCompany, supabase, router]);

    const handleUpdateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { success, error } = await updateProject(id, editName, editDesc, editColor);
            if (success) {
                setIsEditModalOpen(false);
                setProject(prev => prev ? { ...prev, name: editName, description: editDesc, color: editColor } : null);
            } else {
                alert(error || "Failed to update project");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteProject = async () => {
        if (!window.confirm("Are you sure you want to abort this mission? All project data will be permanently deleted.")) return;
        
        const { success, error } = await deleteProject(id);
        if (success) {
            router.push('/task-management/projects');
        } else {
            alert(error || "Failed to delete project");
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [tasks, searchQuery, statusFilter]);

    const PRESET_COLORS = [
        '#6366F1', '#EC4899', '#EF4444', '#F59E0B', 
        '#10B981', '#3B82F6', '#8B5CF6', '#06B6D4',
        '#F43F5E', '#14B8A6'
    ];

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-20">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Mission Not Found</h2>
                <button onClick={() => router.push('/task-management/projects')} className="mt-8 px-8 py-3 bg-primary/10 text-primary font-black rounded-2xl uppercase tracking-widest text-xs border border-primary/20 hover:bg-primary hover:text-white transition-all">
                    Return to Hangar
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
            {/* Header / Breadcrumb */}
            <div className="mb-10">
                <button onClick={() => router.push('/task-management/projects')} className="flex items-center text-xs font-black uppercase tracking-widest text-foreground/40 hover:text-primary transition-colors group mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Projects
                </button>

                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="flex items-start gap-6">
                        <div 
                            className="w-20 h-20 rounded-3xl shrink-0 p-px shadow-2xl transition-transform duration-500 hover:scale-105"
                            style={{ backgroundColor: project.color }}
                        >
                            <div className="w-full h-full rounded-3xl bg-card-bg flex items-center justify-center font-black uppercase text-3xl" style={{ color: project.color }}>
                                {project.name?.[0] || 'V'}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight line-clamp-1 uppercase">{project.name}</h1>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                    project.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    project.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                    'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                }`}>
                                    {project.status}
                                </span>
                            </div>
                            <p className="text-foreground/50 text-base font-medium max-w-2xl leading-relaxed">
                                {project.description || "No mission brief provided for this venture."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsMembersModalOpen(true)}
                            className="p-3.5 rounded-2xl bg-input-bg border border-input-border text-foreground/60 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                            title="Squad Management"
                        >
                            <Users size={20} />
                        </button>
                        
                        {isCreatorOrAdmin && (
                            <>
                                <button 
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="p-3.5 rounded-2xl bg-input-bg border border-input-border text-foreground/60 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                                    title="Mission Parameters"
                                >
                                    <Settings size={20} />
                                </button>
                                <button 
                                    onClick={handleDeleteProject}
                                    className="p-3.5 rounded-2xl bg-red-500/5 border border-transparent hover:border-red-500/20 text-red-500/40 hover:text-red-500 transition-all shadow-sm"
                                    title="Abort Project"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </>
                        )}

                        <button 
                            onClick={() => router.push(`/task-management/new-task?project=${id}`)}
                            className="px-6 py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center active:scale-95"
                        >
                            <Plus className="w-5 h-5 mr-3" />
                            New Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'Total Tasks', value: tasks.length, icon: ListIcon, color: 'text-primary' },
                    { label: 'Ongoing', value: tasks.filter(t => t.status === 'in_progress').length, icon: Clock, color: 'text-blue-500' },
                    { label: 'Completed', value: tasks.filter(t => t.status === 'completed' || t.status === 'done').length, icon: CheckCircle2, color: 'text-green-500' },
                    { label: 'Members', value: memberCount, icon: Users, color: 'text-purple-500' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card border border-card-border p-6 rounded-3xl group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl bg-input-bg border border-input-border flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}>
                                <stat.icon size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 mb-1">{stat.label}</p>
                                <p className="text-2xl font-black text-foreground">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tasks Section */}
            <div className="glass-card border border-card-border rounded-[40px] overflow-hidden shadow-sm flex flex-col">
                <div className="p-8 border-b border-card-border flex flex-col md:flex-row items-center justify-between gap-6">
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
                        <CheckSquare className="text-primary w-6 h-6" />
                        Project Tasks
                    </h3>
                    
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={16} />
                            <input 
                                type="text"
                                placeholder="Filter tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-input-bg border border-input-border rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                            />
                        </div>
                        
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-input-bg border border-input-border rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground/60 outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer min-w-[140px]"
                        >
                            <option value="all">ANY STATUS</option>
                            <option value="todo">TO DO</option>
                            <option value="in_progress">IN PROGRESS</option>
                            <option value="completed">COMPLETED</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {filteredTasks.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-center opacity-40">
                            <CheckSquare size={48} className="mb-4" />
                            <p className="font-black uppercase tracking-widest text-sm">No tasks found matching current filters</p>
                        </div>
                    ) : (
                        <table className="w-full text-left font-bold">
                            <thead className="bg-input-bg/50 border-b border-card-border">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Task Information</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-card-border">
                                {filteredTasks.map((t) => (
                                    <tr key={t.id} className="group hover:bg-primary/5 transition-colors duration-300">
                                        <td className="px-8 py-6">
                                            <Link href={`/task-management/task/${t.id}`} className="flex flex-col gap-1 hover:text-primary transition-colors">
                                                <span className="text-base font-black uppercase tracking-tight line-clamp-1">{t.title}</span>
                                                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-foreground/30">
                                                    <span className="flex items-center gap-1.5"><Calendar size={12} /> {format(new Date(t.created_at), 'MMM dd')}</span>
                                                    <span className="flex items-center gap-1.5"><Flag size={12} /> {t.priority}</span>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                t.status === 'completed' || t.status === 'done' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                t.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => router.push(`/task-management/task/${t.id}`)}
                                                className="p-2.5 rounded-xl bg-input-bg text-foreground/40 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Edit Mission Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-card-bg border border-card-border rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <form onSubmit={handleUpdateProject}>
                            <div className="p-8 md:p-12">
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h2 className="text-3xl font-black text-foreground uppercase tracking-tight">Mission Parameters</h2>
                                        <p className="text-sm font-bold text-foreground/30 uppercase tracking-widest mt-2">Modify project core configuration</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="p-3 rounded-2xl bg-input-bg text-foreground/30 hover:text-red-500 hover:bg-red-500/5 transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Venture Name</label>
                                        <input 
                                            type="text"
                                            required
                                            value={editName}
                                            onChange={(e) => setEditName(editName)}
                                            onInput={(e: any) => setEditName(e.target.value)}
                                            className="w-full bg-input-bg border-2 border-transparent focus:border-primary/50 rounded-2xl px-6 py-4 text-sm font-black text-foreground outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Mission Status</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(['active', 'completed', 'archived'] as const).map(status => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => updateProjectStatus(id, status).then(() => setProject(prev => prev ? {...prev, status} : null))}
                                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${project.status === status ? 'bg-primary border-primary text-white shadow-lg' : 'bg-input-bg border-input-border text-foreground/40 hover:border-primary/30'}`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Mission Brief</label>
                                        <textarea 
                                            value={editDesc}
                                            onChange={(e) => setEditDesc(e.target.value)}
                                            rows={4}
                                            className="w-full bg-input-bg border-2 border-transparent focus:border-primary/50 rounded-2xl px-6 py-4 text-sm font-bold text-foreground outline-none transition-all resize-none custom-scrollbar"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1 block">Brand Identity</label>
                                        <div className="flex flex-wrap gap-3">
                                            {PRESET_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setEditColor(color)}
                                                    className={`w-10 h-10 rounded-full border-4 transition-all ${editColor === color ? 'border-primary scale-110 shadow-lg' : 'border-card-bg'}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-foreground/40 hover:bg-input-bg transition-all"
                                    >
                                        Close
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting || !editName.trim()}
                                        className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Apply Changes"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Squad Modal */}
            {isMembersModalOpen && (
                <ProjectMembers 
                    projectId={id}
                    projectName={project.name}
                    projectColor={project.color}
                    onClose={() => setIsMembersModalOpen(false)}
                    onMembersChanged={async () => {
                        const { count } = await supabase
                            .from('project_members')
                            .select('*', { count: 'exact', head: true })
                            .eq('project_id', id);
                        setMemberCount(count || 0);
                    }}
                />
            )}
        </div>
    );
}

