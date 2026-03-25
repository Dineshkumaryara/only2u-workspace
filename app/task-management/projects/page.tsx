'use client';

import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, 
    FolderPlus, Filter, X, 
    CheckCircle2, AlertCircle, Clock,
    Loader2, Users, MoreVertical,
    Edit2, Trash2, LayoutGrid, List as ListIcon,
    Calendar, CheckSquare, ChevronRight, Building2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProjectStore, Project } from '@/stores/useProjectStore';
import { ProjectMembers } from '@/components/ProjectMembers';
import { useUserStore } from '@/stores/useUserStore';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { format } from 'date-fns';

export default function ProjectsPage() {
    const router = useRouter();
    const { 
        projects, loading, fetchProjects, 
        createProject, updateProjectStatus, deleteProject,
        memberCounts, fetchAllMemberCounts 
    } = useProjectStore();
    const { isSuperAdmin, user } = useUserStore();
    const { activeCompany } = useCompanyStore();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectDesc, setProjectDesc] = useState('');
    const [projectColor, setProjectColor] = useState('#6366F1');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'completed'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<Project | null>(null);

    useEffect(() => {
        fetchProjects();
    }, [activeCompany]);

    useEffect(() => {
        if (projects.length > 0) {
            fetchAllMemberCounts();
        }
    }, [projects, fetchAllMemberCounts]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;

        setIsSubmitting(true);
        try {
            const { success, data, error } = await createProject(projectName, projectDesc, projectColor);
            if (success && data) {
                setProjectName('');
                setProjectDesc('');
                setIsCreateModalOpen(false);
                router.push(`/task-management/projects/${data.id}`);
            } else {
                alert(error || 'Failed to create project');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const PRESET_COLORS = [
        '#6366F1', '#EC4899', '#EF4444', '#F59E0B', 
        '#10B981', '#3B82F6', '#8B5CF6', '#06B6D4',
        '#F43F5E', '#14B8A6'
    ];

    // No company selected — show prompt
    if (!activeCompany) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="flex flex-col items-center text-center max-w-sm">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                        <Building2 className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-3">No Workspace Selected</h2>
                    <p className="text-foreground/40 text-sm font-bold leading-relaxed">
                        Select a company from the sidebar to view and manage its projects.
                    </p>
                </div>
            </div>
        );
    }

    if (loading && projects.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-20">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-sm font-black text-foreground/40 uppercase tracking-widest">Loading Projects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 max-w-full overflow-hidden animate-in fade-in duration-500">
            <div className="p-4 sm:p-6 md:p-10 w-full max-w-7xl mx-auto">

                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12">
                <div className="flex-1">
                    <h1 className="text-2xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3 md:gap-4">
                        <FolderPlus className="text-primary w-8 h-8 md:w-10 md:h-10 shrink-0" />
                        Projects
                    </h1>
                    <p className="text-foreground/40 mt-2 text-[10px] md:text-sm font-bold uppercase tracking-widest max-w-2xl leading-relaxed flex items-center gap-2">
                        <Building2 size={12} className="text-primary" />
                        {activeCompany.name}
                    </p>
                </div>
                
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="group px-6 py-4 md:px-8 bg-primary text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center justify-center active:scale-95 w-full sm:w-auto overflow-hidden text-nowrap"
                >
                    <Plus className="w-5 h-5 mr-2 md:mr-3 group-hover:rotate-90 transition-transform duration-300" />
                    Launch Project
                </button>
            </div>

            {/* Filter Bar */}
            <div className="glass-card border border-card-border p-3 md:p-4 rounded-2xl mb-8">
                {/* Search */}
                <div className="relative w-full group mb-3">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30 group-focus-within:text-primary transition-colors" size={18} />
                    <input 
                        type="text"
                        placeholder="Search workspace..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-input-bg border border-input-border rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                    />
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    {(['all', 'active', 'completed', 'archived'] as const).map((status) => (
                        <button 
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${statusFilter === status ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-input-bg border-input-border text-foreground/40 hover:text-primary hover:border-primary/30'}`}
                        >
                            {status}
                        </button>
                    ))}

                    <div className="flex bg-input-bg p-1 rounded-xl border border-input-border shrink-0 ml-auto">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card-bg text-primary shadow-sm' : 'text-foreground/30 hover:text-foreground'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card-bg text-primary shadow-sm' : 'text-foreground/30 hover:text-foreground'}`}
                        >
                            <ListIcon size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Projects Content */}
            {filteredProjects.length === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 border border-primary/20 animate-pulse">
                        <FolderPlus className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground mb-3 uppercase tracking-tight">Workspace Clear</h3>
                    <p className="text-sm font-bold text-foreground/30 max-w-sm uppercase tracking-widest">
                        {searchQuery ? "No entries match your search criteria" : "Start your next big thing by launching a new project"}
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProjects.map((project) => (
                        <div 
                            key={project.id}
                            onClick={() => router.push(`/task-management/projects/${project.id}`)}
                            className="group glass-card border border-card-border rounded-3xl p-6 hover:border-primary/50 transition-all hover:translate-y-[-4px] shadow-sm hover:shadow-2xl hover:shadow-primary/10 relative overflow-hidden cursor-pointer"
                        >
                             {/* Actions removed as they are now centralized in the overview page */}

                            <div 
                                className="w-14 h-14 rounded-2xl mb-6 p-px bg-linear-to-tr transition-transform duration-500 group-hover:scale-110"
                                style={{ 
                                    backgroundImage: `linear-gradient(to top right, ${project.color}, ${project.color}80)` 
                                }}
                            >
                                <div className="w-full h-full rounded-2xl bg-card-bg flex items-center justify-center shadow-inner overflow-hidden">
                                     <span className="text-xl font-black uppercase tracking-tighter" style={{ color: project.color }}>
                                        {project.name?.[0] || 'V'}
                                     </span>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-foreground mb-2 group-hover:text-primary transition-colors truncate uppercase tracking-tight">
                                {project.name}
                            </h3>
                            <p className="text-sm font-bold text-foreground/40 mb-8 line-clamp-2 h-10 tracking-tight leading-relaxed">
                                {project.description || "No mission brief provided for this venture."}
                            </p>

                            <div className="pt-6 border-t border-card-border flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30 flex items-center gap-2">
                                    <Users size={12} />
                                    {memberCounts[project.id] || 0} Members
                                </span>

                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                    project.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    project.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                    'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                        project.status === 'active' ? 'bg-green-500' :
                                        project.status === 'completed' ? 'bg-blue-500' :
                                        'bg-slate-500'
                                    }`} />
                                    {project.status}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card border border-card-border rounded-3xl overflow-hidden shadow-sm">
                    {/* Desktop Table View */}
                    <div className="hidden min-[1100px]:block overflow-x-auto">
                        <table className="w-full text-left font-bold">
                            <thead className="bg-input-bg/50 border-b border-card-border">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Project Details</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Mission Status</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Deployment</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-card-border">
                                {filteredProjects.map((project) => (
                                    <tr key={project.id} className="group hover:bg-primary/5 transition-colors duration-300">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-xl shrink-0 p-px shadow-lg" style={{ backgroundColor: project.color }}>
                                                    <div className="w-full h-full rounded-xl bg-card-bg flex items-center justify-center font-black text-foreground/20 uppercase text-lg" style={{ color: project.color }}>
                                                        {project.name?.[0] || 'V'}
                                                    </div>
                                                </div>
                                                <div className="overflow-hidden">
                                                    <h4 className="text-base font-black text-foreground uppercase tracking-tight truncate">{project.name}</h4>
                                                    <p className="text-xs font-bold text-foreground/30 truncate max-w-xs">{project.description || 'No description'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                                project.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                project.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                            }`}>
                                                {project.status === 'active' ? <Clock size={12} /> : project.status === 'completed' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                                {project.status}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-black text-foreground/70">{format(new Date(project.created_at), 'MMM dd, yyyy')}</span>
                                                <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">Inception</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => router.push(`/task-management/projects/${project.id}`)}
                                                className="px-6 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all active:scale-95 shadow-md shadow-primary/20"
                                            >
                                                Review Case
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View (for Search/List mode) */}
                    <div className="min-[1100px]:hidden p-4 flex flex-col gap-4">
                        {filteredProjects.map((project) => (
                            <div 
                                key={project.id}
                                onClick={() => router.push(`/task-management/projects/${project.id}`)}
                                className="bg-input-bg/30 border border-card-border p-5 rounded-4xl hover:border-primary/40 transition-all flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl shrink-0 p-px shadow-lg" style={{ backgroundColor: project.color }}>
                                        <div className="w-full h-full rounded-2xl bg-card-bg flex items-center justify-center font-black uppercase text-xl" style={{ color: project.color }}>
                                            {project.name?.[0] || 'V'}
                                        </div>
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="text-lg font-black text-foreground uppercase tracking-tight truncate">{project.name}</h4>
                                        <p className="text-xs font-bold text-foreground/40 line-clamp-1">{project.description || 'Mission brief pending...'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-4 sm:pt-0 border-t sm:border-t-0 border-card-border">
                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                        project.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                        project.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                            project.status === 'active' ? 'bg-green-500' :
                                            project.status === 'completed' ? 'bg-blue-500' :
                                            'bg-slate-500'
                                        }`} />
                                        {project.status}
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); router.push(`/task-management/projects/${project.id}`); }}
                                        className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-card-bg border border-card-border rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
                        <form onSubmit={handleCreateProject}>
                            <div className="p-6 md:p-12">
                                <div className="flex justify-between items-start mb-8 md:mb-10">
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight">Mission Launch</h2>
                                        <p className="text-[10px] md:text-sm font-bold text-foreground/30 uppercase tracking-widest mt-2">Initialize new project workspace</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="p-3 rounded-2xl bg-input-bg text-foreground/30 hover:text-red-500 hover:bg-red-500/5 transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-6 md:space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Project Name</label>
                                        <input 
                                            type="text"
                                            required
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="w-full bg-input-bg border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 md:px-6 py-3 md:py-4 text-sm font-black text-foreground outline-none transition-all placeholder:text-foreground/10"
                                            placeholder="VENTURE ALPHA..."
                                            autoFocus
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1">Mission Brief</label>
                                        <textarea 
                                            value={projectDesc}
                                            onChange={(e) => setProjectDesc(e.target.value)}
                                            rows={3}
                                            className="w-full bg-input-bg border-2 border-transparent focus:border-primary/50 rounded-2xl px-5 md:px-6 py-3 md:py-4 text-sm font-bold text-foreground outline-none transition-all resize-none placeholder:text-foreground/10 custom-scrollbar"
                                            placeholder="Detailed description of the project goals..."
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 ml-1 block">Brand Identity</label>
                                        <div className="flex flex-wrap gap-2 md:gap-3">
                                            {PRESET_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setProjectColor(color)}
                                                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-4 transition-all ${projectColor === color ? 'border-primary scale-110 shadow-lg' : 'border-card-bg'}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 md:mt-12 flex flex-col sm:flex-row gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="py-4 md:flex-1 rounded-2xl font-black text-[11px] md:text-sm uppercase tracking-widest text-foreground/40 hover:bg-input-bg transition-all"
                                    >
                                        Abort
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting || !projectName.trim()}
                                        className="py-4 md:flex-1 bg-primary text-white rounded-2xl font-black text-[11px] md:text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Deploy Venture"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Member Modal */}
            {selectedProjectForMembers && (
                <ProjectMembers 
                    projectId={selectedProjectForMembers.id}
                    projectName={selectedProjectForMembers.name}
                    projectColor={selectedProjectForMembers.color}
                    onClose={() => setSelectedProjectForMembers(null)}
                    onMembersChanged={() => fetchAllMemberCounts()}
                />
            )}
            </div>
        </div>
    );
}
