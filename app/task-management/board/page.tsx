"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  Search, Filter, Plus, Clock, AlertCircle, Calendar as CalendarIcon, 
  CheckCircle2, Inbox, ArrowRight, User, TagIcon, Flag, X, FileText, ListTodo, Hourglass, Eye, Sun, Moon, LayoutGrid, List as ListIcon, Kanban
} from "lucide-react";
import Link from "next/link";
import { format, differenceInDays, startOfDay, formatDistanceToNow } from "date-fns";

import { TaskCard } from "@/components/TaskCard";
import { useUserStore } from "@/stores/useUserStore";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { GLOBAL_COMPANY_ID } from "@/stores/useProjectStore";

export default function BoardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterDueDates, setFilterDueDates] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "grid" | "list">("board");

  const { activeCompany } = useCompanyStore();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const isSuperAdmin = useUserStore.getState().isSuperAdmin;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // If no active company is selected, show empty board
      if (!activeCompany) {
        setTasks([]);
        setProjects([]);
        setLoading(false);
        return;
      }

      const isGlobal = activeCompany.id === GLOBAL_COMPANY_ID;

      // 1. Fetch Projects with RBAC — scoped to active company
      // Global company also includes projects with NULL company_id
      let projectsQuery = supabase.from("projects").select("*").eq("status", "active");

      if (isGlobal) {
        projectsQuery = projectsQuery.or(`company_id.eq.${GLOBAL_COMPANY_ID},company_id.is.null`);
      } else {
        projectsQuery = projectsQuery.eq("company_id", activeCompany.id);
      }

      if (!isSuperAdmin) {
        const { data: memberData } = await supabase.from('project_members').select('project_id').eq('user_id', user.id);
        const memberProjectIds = memberData?.map(m => m.project_id) || [];
        
        if (memberProjectIds.length > 0) {
          projectsQuery = projectsQuery.or(`user_id.eq.${user.id},id.in.(${memberProjectIds.map(id => `"${id}"`).join(',')})`);
        } else {
          projectsQuery = projectsQuery.eq('user_id', user.id);
        }
      }

      const { data: prData } = await projectsQuery;
      const validProjectIds = prData?.map(p => p.id) || [];

      // 2. Fetch Tasks — always scoped to the active company's projects
      let tasksQuery = supabase.from("tasks")
        .select("*, task_attachments(*), task_assignments(agent:agents(*))")
        .order("created_at", { ascending: true });

      if (validProjectIds.length > 0) {
        // Scope to company projects
        tasksQuery = tasksQuery.in('project_id', validProjectIds);
      } else {
        // No projects in this company — no tasks to show
        setTasks([]);
        setProjects([]);
        setAgents([]);
        setLoading(false);
        return;
      }

      // For non-admins: further restrict to tasks they created or are assigned to
      if (!isSuperAdmin) {
        const { data: assignments } = await supabase
          .from("task_assignments")
          .select("task_id")
          .eq("agent_id", user.id);
        const assignedIds = assignments?.map(a => a.task_id) || [];

        let orCond = `created_by.eq.${user.id}`;
        if (assignedIds.length > 0) orCond += `,id.in.(${assignedIds.join(',')})`;
        tasksQuery = tasksQuery.or(orCond);
      }

      const [
        { data: tasksData }, 
        { data: agentsData },
        { data: tagsData }
      ] = await Promise.all([
        tasksQuery,
        supabase.from("agents").select("*"),
        supabase.from("tags").select("*")
      ]);

      if (tasksData) setTasks(tasksData);
      if (prData) setProjects(prData);
      if (agentsData) setAgents(agentsData);
      if (tagsData) setAvailableTags(tagsData);
      setLoading(false);
    };
    fetchData();
  }, [activeCompany]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.is_archived && !t.parent_task_id); // Only root tasks

    // Project Filter
    if (selectedProjectId) {
      result = result.filter(t => t.project_id === selectedProjectId);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.description && t.description.toLowerCase().includes(q))
      );
    }

    // Assignees
    if (filterAssignees.length > 0) {
      result = result.filter(t => {
        const tAssignees = t.task_assignments?.map((ta: any) => ta.agent.id) || [];
        return filterAssignees.some(aId => tAssignees.includes(aId));
      });
    }

    // Tags
    if (filterTags.length > 0) {
      result = result.filter(t => {
        if (!t.tags) return false;
        return filterTags.some(tag => t.tags.includes(tag));
      });
    }

    // Priorities
    if (filterPriorities.length > 0) {
      result = result.filter(t => filterPriorities.includes(t.priority));
    }

    // Statuses
    if (filterStatuses.length > 0) {
      result = result.filter(t => filterStatuses.includes(t.status));
    }

    // Due Dates
    if (filterDueDates.length > 0) {
      const todayReset = startOfDay(new Date());
      result = result.filter(t => {
        if (!t.deadline && filterDueDates.includes('no_date')) return true;
        if (!t.deadline) return false;
        
        const deadlineReset = startOfDay(new Date(t.deadline));
        const diff = differenceInDays(deadlineReset, todayReset);
        
        return filterDueDates.some(fd => {
          if (fd === 'overdue') return diff < 0;
          if (fd === 'today') return diff === 0;
          if (fd === 'tomorrow') return diff === 1;
          if (fd === 'next7days') return diff > 1 && diff <= 7;
          if (fd === 'next30days') return diff > 7 && diff <= 30;
          return false;
        });
      });
    }

    return result;
  }, [tasks, selectedProjectId, searchQuery, filterAssignees, filterTags, filterPriorities, filterStatuses, filterDueDates]);

  // Column Distribution Logic (Time-based matching purchase_app)
  const columns = useMemo(() => {
    const drafts: any[] = [];
    const overdue: any[] = [];
    const today: any[] = [];
    const tomorrow: any[] = [];
    const next7Days: any[] = [];
    const next30Days: any[] = [];
    const completed = filteredTasks.filter(t => t.status === 'completed');

    const activeTasks = filteredTasks.filter(t => t.status !== 'completed');
    const todayReset = startOfDay(new Date());

    activeTasks.forEach(t => {
      if (t.status === 'draft' || !t.deadline) {
        drafts.push(t);
        return;
      }

      const deadlineReset = startOfDay(new Date(t.deadline));
      const diff = differenceInDays(deadlineReset, todayReset);

      if (diff < 0) overdue.push(t);
      else if (diff === 0) today.push(t);
      else if (diff === 1) tomorrow.push(t);
      else if (diff > 1 && diff <= 7) next7Days.push(t);
      else if (diff > 7 && diff <= 30) next30Days.push(t);
      else drafts.push(t); // Far future goes to drafts/no date pile for now
    });

    return [
      { id: 'drafts', title: 'Drafts / No Date', color: 'bg-slate-500', icon: <Inbox size={16} />, tasks: drafts },
      { id: 'overdue', title: 'Overdue', color: 'bg-red-500', icon: <AlertCircle size={16} />, tasks: overdue },
      { id: 'today', title: 'Today', color: 'bg-amber-500', icon: <Clock size={16} />, tasks: today },
      { id: 'tomorrow', title: 'Tomorrow', color: 'bg-indigo-500', icon: <ArrowRight size={16} />, tasks: tomorrow },
      { id: 'next7Days', title: 'Next 7 Days', color: 'bg-blue-500', icon: <CalendarIcon size={16} />, tasks: next7Days },
      { id: 'next30Days', title: 'Next 30 Days', color: 'bg-cyan-500', icon: <CalendarIcon size={16} />, tasks: next30Days },
      { id: 'completed', title: 'Completed', color: 'bg-green-500', icon: <CheckCircle2 size={16} />, tasks: completed },
    ];
  }, [filteredTasks]);

  // Handlers for Multiselect Arrays
  const toggleArrayItem = (setter: any, arr: any[], item: any) => {
    if (arr.includes(item)) setter(arr.filter(i => i !== item));
    else setter([...arr, item]);
  };

  const clearFilters = () => {
    setFilterAssignees([]);
    setFilterTags([]);
    setFilterPriorities([]);
    setFilterStatuses([]);
    setFilterDueDates([]);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden fade-in relative animate-in">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -z-10 mix-blend-multiply pointer-events-none"></div>

      {/* HEADER & CONTROLS */}
      <div className="px-6 py-4 shrink-0 bg-card-bg/50 border-b border-card-border backdrop-blur-md z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center">
              Task Board
            </h1>
            <p className="text-sm font-bold text-foreground/50 uppercase tracking-widest mt-1">Timeline Based Organization</p>
          </div>
          
          <Link href="/task-management/new-task" className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center w-fit">
            <Plus size={18} className="mr-2" /> New Task
          </Link>
        </div>

        {/* Action Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 lg:col-span-4 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 w-4 h-4 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded-xl pl-9 pr-4 py-2 text-sm font-medium outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="md:col-span-4 max-w-sm">
            <select 
              value={selectedProjectId} 
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-2 text-sm font-bold outline-none appearance-none cursor-pointer"
            >
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-3 lg:col-span-4 flex justify-end items-center gap-3">
            {/* View Toggles */}
            <div className="hidden sm:flex bg-input-bg p-1 rounded-xl shadow-inner shrink-0 items-center">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? 'bg-card-bg text-foreground shadow-sm cursor-default' : 'text-foreground/50 hover:text-foreground'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${viewMode === "list" ? 'bg-card-bg text-foreground shadow-sm cursor-default' : 'text-foreground/50 hover:text-foreground'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("board")}
                className={`p-2 rounded-lg transition-all ${viewMode === "board" ? 'bg-card-bg text-foreground shadow-sm cursor-default' : 'text-foreground/50 hover:text-foreground'}`}
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 flex items-center text-sm font-bold rounded-xl border transition-all ${(showFilters || filterTags.length || filterAssignees.length || filterPriorities.length || filterStatuses.length || filterDueDates.length) ? 'bg-primary/10 border-primary text-primary' : 'bg-input-bg border-input-border text-foreground/70 hover:bg-card-border'}`}
            >
              <Filter size={16} className="mr-2" /> Filters
              {(filterTags.length + filterAssignees.length + filterPriorities.length + filterStatuses.length + filterDueDates.length) > 0 && (
                <span className="ml-2 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                  {filterTags.length + filterAssignees.length + filterPriorities.length + filterStatuses.length + filterDueDates.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Filters Modal */}
        {showFilters && (
          <div className="fixed inset-0 z-100 flex justify-center items-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowFilters(false)}>
            <div className="bg-card-bg border border-card-border rounded-3xl w-full max-w-[1400px] max-h-[90vh] overflow-y-auto m-4 p-6 sm:p-10 custom-scrollbar shadow-2xl relative" onClick={e => e.stopPropagation()}>
              
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-extrabold text-foreground flex items-center tracking-tight">
                  <Filter className="mr-3 text-primary" size={24} />
                  Advanced Filters
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={clearFilters} className="px-4 py-2 rounded-xl text-sm font-bold text-foreground/60 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer">
                    Clear All Filters
                  </button>
                  <button onClick={() => setShowFilters(false)} className="p-2.5 bg-input-bg hover:bg-card-border rounded-xl transition-colors text-foreground cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-10">
                
                {/* Statuses Filter */}
                <div>
                  <label className="text-sm font-extrabold text-foreground/70 mb-5 flex items-center"><div className="w-1.5 h-4 bg-primary rounded-full mr-2"></div>5 Status Available</label>
                  <div className="flex flex-col gap-3.5">
                    {[
                      { id: 'draft', label: 'Draft', icon: <FileText size={18} className="text-foreground/40" /> },
                      { id: 'todo', label: 'To Do', icon: <ListTodo size={18} className="text-foreground/40" /> },
                      { id: 'in_progress', label: 'In Progress', icon: <Hourglass size={18} className="text-foreground/40" /> },
                      { id: 'review', label: 'Review', icon: <Eye size={18} className="text-foreground/40" /> },
                      { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={18} className="text-foreground/40" /> },
                    ].map(s => (
                      <button key={s.id} onClick={() => toggleArrayItem(setFilterStatuses, filterStatuses, s.id)} className="flex items-center text-sm font-extrabold text-foreground/80 hover:text-primary transition-colors group text-left w-full cursor-pointer">
                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${filterStatuses.includes(s.id) ? 'border-primary bg-primary/20' : 'border-input-border group-hover:border-primary/50'}`}>
                          {filterStatuses.includes(s.id) && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                        </div>
                        <span className="mr-3">{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Dates Filter */}
                <div>
                  <label className="text-sm font-extrabold text-foreground/70 mb-5 flex items-center"><div className="w-1.5 h-4 bg-primary rounded-full mr-2"></div>5 Due Date Available</label>
                  <div className="flex flex-col gap-3.5">
                    {[
                      { id: 'overdue', label: 'Overdue', icon: <AlertCircle size={18} className="text-foreground/40" /> },
                      { id: 'today', label: 'Today', icon: <Sun size={18} className="text-foreground/40" /> },
                      { id: 'tomorrow', label: 'Tomorrow', icon: <Moon size={18} className="text-foreground/40" /> },
                      { id: 'next7days', label: 'Next 7 Days', icon: <CalendarIcon size={18} className="text-foreground/40" /> },
                      { id: 'next30days', label: 'Next 30 Days', icon: <Clock size={18} className="text-foreground/40" /> },
                    ].map(d => (
                      <button key={d.id} onClick={() => toggleArrayItem(setFilterDueDates, filterDueDates, d.id)} className="flex items-center text-sm font-extrabold text-foreground/80 hover:text-primary transition-colors group text-left w-full cursor-pointer">
                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${filterDueDates.includes(d.id) ? 'border-primary bg-primary/20' : 'border-input-border group-hover:border-primary/50'}`}>
                          {filterDueDates.includes(d.id) && <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>}
                        </div>
                        <span className="mr-3">{d.icon}</span>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-extrabold text-foreground/70 mb-5 flex items-center"><div className="w-1.5 h-4 bg-primary rounded-full mr-2"></div>Assignees</label>
                  <div className="flex flex-wrap gap-2">
                    {agents.map(a => (
                      <button key={a.id} onClick={() => toggleArrayItem(setFilterAssignees, filterAssignees, a.id)} className={`px-3 py-1.5 text-xs font-bold border rounded-md transition-colors cursor-pointer ${filterAssignees.includes(a.id) ? 'bg-primary border-primary text-white' : 'bg-input-bg border-input-border text-foreground/60 hover:border-primary/50'}`}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-extrabold text-foreground/70 mb-5 flex items-center"><div className="w-1.5 h-4 bg-primary rounded-full mr-2"></div>Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(t => (
                      <button key={t.id} onClick={() => toggleArrayItem(setFilterTags, filterTags, t.name)} className={`px-3 py-1.5 text-xs font-bold border rounded-md transition-colors cursor-pointer ${filterTags.includes(t.name) ? 'bg-primary border-primary text-white' : 'bg-input-bg border-input-border text-foreground/60 hover:border-primary/50'}`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-extrabold text-foreground/70 mb-5 flex items-center"><div className="w-1.5 h-4 bg-primary rounded-full mr-2"></div>Priority</label>
                  <div className="flex flex-wrap gap-2">
                    {["urgent", "high", "medium", "low"].map(p => (
                      <button key={p} onClick={() => toggleArrayItem(setFilterPriorities, filterPriorities, p)} className={`px-3 py-1.5 text-xs font-bold border rounded-md uppercase transition-colors cursor-pointer ${filterPriorities.includes(p) ? 'bg-primary border-primary text-white' : 'bg-input-bg border-input-border text-foreground/60 hover:border-primary/50'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-card-border flex justify-end">
                <button onClick={() => setShowFilters(false)} className="px-10 py-3.5 rounded-xl text-sm font-bold bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center cursor-pointer">
                  <CheckCircle2 size={18} className="mr-2" /> Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Dynamic View AREA */}
      {viewMode === "board" ? (
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar p-6">
            <div className="flex h-full w-max gap-6 items-stretch">
            
            {columns.length === 0 ? (
              <div className="w-[calc(100vw-48px)] flex-1 flex flex-col items-center justify-center text-foreground/40">
                <Inbox size={48} className="mb-4 opacity-20" />
                <p className="font-bold">No tasks found matching these filters.</p>
              </div>
            ) : (
              columns.map(col => (
                <div key={col.id} className="w-[320px] flex flex-col h-full min-h-0">
                  <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                    <div className="flex items-center font-bold text-foreground">
                      <div className={`w-3 h-3 rounded-full mr-2 shadow-sm ${col.color}`}></div>
                      {col.title}
                    </div>
                    <span className="text-xs font-bold bg-input-bg px-2 py-1 rounded-md text-foreground/60">
                      {col.tasks.length}
                    </span>
                  </div>

                  <div className="flex-1 relative min-h-0">
                    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar-sm flex flex-col gap-3">
                    {col.tasks.length === 0 ? (
                      <div className="flex-1 min-h-[150px] flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-input-border rounded-xl bg-card-bg/30 m-1 mb-4">
                        <div className="w-10 h-10 rounded-full bg-input-bg flex items-center justify-center text-foreground/30 mb-3">
                          {col.icon}
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Empty List</p>
                      </div>
                    ) : (
                      col.tasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))
                    )}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-6">
            {filteredTasks.length === 0 ? (
              <div className="w-full flex-1 flex flex-col items-center justify-center text-foreground/40 h-full min-h-[400px]">
                <Inbox size={48} className="mb-4 opacity-20" />
                <p className="font-bold">No tasks found matching these filters.</p>
              </div>
            ) : (
              <div className="w-full max-w-7xl mx-auto flex flex-col gap-12">
                {columns.filter(col => col.tasks.length > 0).map(col => (
                  <div key={col.id} className="flex flex-col gap-6">
                    
                    {/* Section Header */}
                    <div className="flex items-center gap-3 border-b border-card-border pb-3">
                      <div className={`w-3.5 h-3.5 rounded-full shadow-sm ${col.color}`}></div>
                      <h3 className="text-xl font-extrabold text-foreground tracking-tight">{col.title}</h3>
                      <span className="text-xs font-bold bg-input-bg px-2.5 py-1 rounded-md text-foreground/70 ml-2">
                        {col.tasks.length} Tasks
                      </span>
                    </div>

                    {/* Section Items */}
                    <div className={`gap-4 lg:gap-6 w-full ${viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-stretch" : "flex flex-col max-w-5xl"}`}>
                      {col.tasks.map(task => (
                        <TaskCard key={task.id} task={task} viewMode={viewMode} />
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
