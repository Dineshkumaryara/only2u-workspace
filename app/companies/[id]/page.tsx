'use client';

import { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { format } from 'date-fns';
import {
  Building2, Users, FolderOpen, CheckCircle2, Clock, AlertCircle,
  Loader2, ArrowLeft, ChevronRight, User, Tag, Flag,
  BarChart3, Circle, FileText, Eye, ListTodo, Hourglass,
  UserCheck, Crown, CalendarDays, Hash
} from 'lucide-react';
import Link from 'next/link';
import { GLOBAL_COMPANY_ID } from '@/stores/useProjectStore';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CompanyMember {
  id: string;
  agent_id: string;
  role: string | null;
  is_default: boolean;
  agents: { id: string; name: string; email: string; role: string };
}

interface TaskAssignment {
  agents: { id: string; name: string };
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  task_assignments: TaskAssignment[];
}

interface ProjectMember {
  user_id: string;
  agents?: { id: string; name: string };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  created_at: string;
  user_id: string;
  creator?: { name: string; email: string };
  project_members: ProjectMember[];
  tasks: Task[];
}

interface Company {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCompanyColor(name: string): string {
  const colors = ['#6366F1', '#E24681', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#F43F5E', '#14B8A6', '#EF4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  draft:       { label: 'Draft',       color: 'text-foreground/50', bg: 'bg-foreground/5',  border: 'border-foreground/10', icon: <FileText size={11} /> },
  todo:        { label: 'To Do',       color: 'text-sky-500',       bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    icon: <ListTodo size={11} /> },
  in_progress: { label: 'In Progress', color: 'text-amber-500',     bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: <Hourglass size={11} /> },
  review:      { label: 'Review',      color: 'text-purple-500',    bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Eye size={11} /> },
  completed:   { label: 'Completed',   color: 'text-green-500',     bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: <CheckCircle2 size={11} /> },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  urgent: { color: 'text-red-500',    label: 'Urgent' },
  high:   { color: 'text-orange-500', label: 'High' },
  medium: { color: 'text-yellow-500', label: 'Medium' },
  low:    { color: 'text-blue-400',   label: 'Low' },
};

const PROJECT_STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  active:    { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <Circle size={8} className="fill-green-500 text-green-500" /> },
  completed: { color: 'text-blue-500',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  icon: <CheckCircle2 size={11} /> },
  archived:  { color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: <Circle size={8} className="fill-slate-500 text-slate-500" /> },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CompanyOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const { isSuperAdmin, loading: userLoading, fetchUser } = useUserStore();

  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  useEffect(() => { fetchUser(); }, []);
  useEffect(() => {
    if (!userLoading && !isSuperAdmin) router.push('/');
  }, [userLoading, isSuperAdmin]);

  useEffect(() => {
    if (!companyId) return;
    fetchAll();
  }, [companyId]);

  const fetchAll = async () => {
    setLoading(true);
    const supabase = createClient();

    // 1. Fetch company info
    const { data: companyData } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    // 2. Fetch company members with agent info
    const { data: membersData } = await supabase
      .from('company_members')
      .select('*, agents(id, name, email, role)')
      .eq('company_id', companyId)
      .order('created_at');

    // 3. Fetch all agents (for creator lookup)
    const { data: allAgents } = await supabase
      .from('agents')
      .select('id, name, email');

    const agentsMap: Record<string, { name: string; email: string }> = {};
    (allAgents || []).forEach((a: any) => { agentsMap[a.id] = a; });

    // 4. Fetch projects for this company
    // For Global company: also include legacy projects with NULL company_id
    const isGlobal = companyId === GLOBAL_COMPANY_ID;
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, description, status, color, created_at, user_id')
      .order('created_at', { ascending: false });

    if (isGlobal) {
      projectsQuery = projectsQuery.or(`company_id.eq.${GLOBAL_COMPANY_ID},company_id.is.null`);
    } else {
      projectsQuery = projectsQuery.eq('company_id', companyId);
    }

    const { data: projectsData } = await projectsQuery;

    const projectIds = (projectsData || []).map((p: any) => p.id);

    if (projectIds.length === 0) {
      setCompany(companyData);
      setMembers(membersData || []);
      setProjects([]);
      setLoading(false);
      return;
    }

    // 5. Fetch project members for all projects at once
    const { data: projectMembersData } = await supabase
      .from('project_members')
      .select('project_id, user_id, agents(id, name)')
      .in('project_id', projectIds);

    // 6. Fetch tasks for all projects at once
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, status, priority, deadline, project_id')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true });

    const taskIds = (tasksData || []).map((t: any) => t.id);

    // 7. Fetch task assignments for all tasks at once
    let taskAssignmentsData: any[] = [];
    if (taskIds.length > 0) {
      const { data: assignData } = await supabase
        .from('task_assignments')
        .select('task_id, agent_id, agents(id, name)')
        .in('task_id', taskIds);
      taskAssignmentsData = assignData || [];
    }

    // 8. Assemble data by project
    const pmByProject: Record<string, any[]> = {};
    (projectMembersData || []).forEach((pm: any) => {
      if (!pmByProject[pm.project_id]) pmByProject[pm.project_id] = [];
      pmByProject[pm.project_id].push(pm);
    });

    const tasksByProject: Record<string, any[]> = {};
    (tasksData || []).forEach((t: any) => {
      if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
      tasksByProject[t.project_id].push(t);
    });

    const assignmentsByTask: Record<string, any[]> = {};
    taskAssignmentsData.forEach((a: any) => {
      if (!assignmentsByTask[a.task_id]) assignmentsByTask[a.task_id] = [];
      assignmentsByTask[a.task_id].push(a);
    });

    const enrichedProjects = (projectsData || []).map((p: any) => ({
      ...p,
      creator: agentsMap[p.user_id] || null,
      project_members: pmByProject[p.id] || [],
      tasks: (tasksByProject[p.id] || []).map((t: any) => ({
        ...t,
        task_assignments: assignmentsByTask[t.id] || [],
      })),
    }));

    setCompany(companyData);
    setMembers(membersData || []);
    setProjects(enrichedProjects);
    setLoading(false);
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalTasks = projects.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'completed').length, 0);
  const inProgressTasks = projects.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'in_progress').length, 0);
  const activeProjects = projects.filter(p => p.status === 'active').length;

  if (loading || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-2xl font-black text-foreground/30 uppercase tracking-tight">Company Not Found</h2>
          <Link href="/companies" className="mt-4 inline-flex items-center gap-2 text-primary text-sm font-bold hover:underline">
            <ArrowLeft size={14} /> Back to Companies
          </Link>
        </div>
      </div>
    );
  }

  const color = getCompanyColor(company.name);

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden animate-in fade-in duration-500">
      <div className="p-4 sm:p-6 md:p-10 w-full max-w-7xl mx-auto">

        {/* ── Back Link ── */}
        <Link
          href="/companies"
          className="inline-flex items-center gap-2 text-foreground/40 hover:text-primary text-xs font-black uppercase tracking-widest transition-colors mb-8 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          All Companies
        </Link>

        {/* ── Company Header ── */}
        <div className="glass-card border border-card-border rounded-4xl p-6 md:p-10 mb-8 relative overflow-hidden">
          {/* BG Decoration */}
          <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full blur-3xl opacity-10" style={{ backgroundColor: color }} />

          <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8 relative">
            <div
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-white font-black text-3xl md:text-4xl shadow-2xl shrink-0"
              style={{ backgroundColor: color }}
            >
              {company.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-4xl font-black text-foreground uppercase tracking-tight truncate">
                {company.name}
              </h1>
              <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest mt-1 flex items-center gap-2">
                <CalendarDays size={11} />
                Created {format(new Date(company.created_at), 'MMMM dd, yyyy')}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Members',    value: members.length,  icon: <Users size={18} />,       color: 'text-primary',      bg: 'bg-primary/10' },
              { label: 'Projects',   value: projects.length, icon: <FolderOpen size={18} />,  color: 'text-blue-500',     bg: 'bg-blue-500/10' },
              { label: 'Total Tasks',value: totalTasks,      icon: <Hash size={18} />,         color: 'text-amber-500',    bg: 'bg-amber-500/10' },
              { label: 'Completed',  value: completedTasks,  icon: <CheckCircle2 size={18} />, color: 'text-green-500',    bg: 'bg-green-500/10' },
            ].map(stat => (
              <div key={stat.label} className="bg-input-bg/50 border border-card-border rounded-2xl p-4 flex flex-col gap-2">
                <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-black text-foreground">{stat.value}</p>
                <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Members ────────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="glass-card border border-card-border rounded-4xl overflow-hidden">
              <div className="px-6 py-5 border-b border-card-border flex items-center justify-between">
                <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                  <Users size={16} className="text-primary" /> Team Members
                </h2>
                <span className="text-[10px] font-black px-2.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {members.length}
                </span>
              </div>
              <div className="divide-y divide-card-border max-h-[600px] overflow-y-auto custom-scrollbar">
                {members.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <Users size={32} className="mx-auto text-foreground/10 mb-3" />
                    <p className="text-[10px] font-black text-foreground/20 uppercase tracking-widest">No members yet</p>
                  </div>
                ) : members.map(member => (
                  <div key={member.id} className="px-6 py-4 flex items-center gap-3 hover:bg-input-bg/30 transition-colors">
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-sm shadow-sm"
                      style={{ backgroundColor: getCompanyColor(member.agents?.name || 'U') }}
                    >
                      {member.agents?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-foreground uppercase tracking-tight truncate">{member.agents?.name}</p>
                      <p className="text-[10px] font-bold text-foreground/30 truncate">{member.agents?.email}</p>
                    </div>
                    {member.is_default && (
                      <span title="Default member">
                        <Crown size={13} className="text-amber-400 shrink-0" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Projects ───────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                <FolderOpen size={16} className="text-primary" /> Projects
              </h2>
              <span className="text-[10px] font-black px-2.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {projects.length}
              </span>
            </div>

            {projects.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-card-border rounded-4xl">
                <FolderOpen size={40} className="mx-auto text-foreground/10 mb-4" />
                <h3 className="text-lg font-black text-foreground/30 uppercase tracking-tight">No Projects</h3>
                <p className="text-[10px] font-black text-foreground/20 uppercase tracking-widest mt-1">No projects in this company yet</p>
              </div>
            ) : projects.map(project => {
              const pStatus = PROJECT_STATUS_CONFIG[project.status] || PROJECT_STATUS_CONFIG.archived;
              const isExpanded = expandedProject === project.id;
              const tasksDone = project.tasks.filter(t => t.status === 'completed').length;
              const tasksTotal = project.tasks.length;
              const progress = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

              return (
                <div key={project.id} className="glass-card border border-card-border rounded-4xl overflow-hidden hover:border-primary/30 transition-all duration-300">
                  {/* Project Header */}
                  <button
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-input-bg/20 transition-colors"
                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  >
                    {/* Project Color Badge */}
                    <div
                      className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-xl shadow-md"
                      style={{ backgroundColor: project.color }}
                    >
                      {project.name[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-foreground uppercase tracking-tight truncate">{project.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${pStatus.bg} ${pStatus.color} ${pStatus.border}`}>
                          {pStatus.icon} {project.status}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-foreground/30 flex items-center gap-1">
                          <User size={10} /> {project.creator?.name || 'Unknown'}
                        </span>
                        <span className="text-[10px] font-bold text-foreground/30 flex items-center gap-1">
                          <Users size={10} /> {project.project_members.length} members
                        </span>
                        <span className="text-[10px] font-bold text-foreground/30 flex items-center gap-1">
                          <Hash size={10} /> {tasksTotal} tasks
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {tasksTotal > 0 && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-input-bg rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress}%`, backgroundColor: project.color }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-foreground/30 shrink-0">{progress}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/task-management/projects/${project.id}`}
                        onClick={e => e.stopPropagation()}
                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all border border-primary/20"
                        title="Open Project"
                      >
                        <ChevronRight size={15} />
                      </Link>
                      <ChevronRight
                        size={15}
                        className={`text-foreground/20 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Expanded: Task List */}
                  {isExpanded && (
                    <div className="border-t border-card-border animate-in fade-in slide-in-from-top-2 duration-200">

                      {/* Project members strip */}
                      {project.project_members.length > 0 && (
                        <div className="px-5 py-3 border-b border-card-border bg-input-bg/30 flex items-center gap-3 flex-wrap">
                          <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Squad:</p>
                          <div className="flex -space-x-2">
                            {project.project_members.slice(0, 8).map((pm, i) => (
                              <span
                                key={pm.user_id}
                                title={pm.agents?.name}
                                className="inline-flex w-7 h-7 rounded-lg border-2 border-card-bg items-center justify-center text-white font-black text-[10px] shadow-sm"
                                style={{ backgroundColor: getCompanyColor(pm.agents?.name || 'U'), zIndex: 8 - i }}
                              >
                                {pm.agents?.name?.[0]?.toUpperCase() || '?'}
                              </span>
                            ))}
                            {project.project_members.length > 8 && (
                              <div className="w-7 h-7 rounded-lg border-2 border-card-bg bg-input-bg flex items-center justify-center text-[10px] font-black text-foreground/40">
                                +{project.project_members.length - 8}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tasks */}
                      <div className="divide-y divide-card-border/50 max-h-80 overflow-y-auto custom-scrollbar">
                        {project.tasks.length === 0 ? (
                          <div className="py-8 text-center">
                            <ListTodo size={24} className="mx-auto text-foreground/10 mb-2" />
                            <p className="text-[10px] font-black text-foreground/20 uppercase tracking-widest">No tasks in this project</p>
                          </div>
                        ) : project.tasks.map(task => {
                          const tStatus = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft;
                          const tPriority = PRIORITY_CONFIG[task.priority];
                          const assignees: any[] = (task.task_assignments || []).map((a: any) => a.agents).filter(Boolean);

                          return (
                            <Link
                              key={task.id}
                              href={`/task-management/task/${task.id}`}
                              className="flex items-center gap-3 px-5 py-3.5 hover:bg-input-bg/30 transition-colors group"
                            >
                              {/* Status */}
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase border shrink-0 ${tStatus.bg} ${tStatus.color} ${tStatus.border}`}>
                                {tStatus.icon}
                                <span className="hidden sm:inline">{tStatus.label}</span>
                              </span>

                              {/* Title */}
                              <span className="flex-1 text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {task.title}
                              </span>

                              {/* Priority */}
                              {tPriority && (
                                <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${tPriority.color} hidden sm:inline`}>
                                  {tPriority.label}
                                </span>
                              )}

                              {/* Assignees */}
                              {assignees.length > 0 && (
                                <div className="flex -space-x-1.5 shrink-0">
                                  {assignees.slice(0, 3).map((a: any, i) => (
                                    <div
                                      key={a.id}
                                      className="w-6 h-6 rounded-lg border-2 border-card-bg flex items-center justify-center text-white text-[9px] font-black shadow-sm"
                                      style={{ backgroundColor: getCompanyColor(a.name), zIndex: 3 - i }}
                                      title={a.name}
                                    >
                                      {a.name[0].toUpperCase()}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Deadline */}
                              {task.deadline && (
                                <span className="text-[10px] font-bold text-foreground/30 shrink-0 hidden md:inline">
                                  {format(new Date(task.deadline), 'MMM dd')}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
