import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { Activity, Clock, CheckCircle, ListTodo, ChevronRight, AlertCircle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default async function Home() {
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Fetch agent details
  const { data: agentData } = await supabase
    .from('agents')
    .select('*')
    .eq('id', user.id)
    .single();

  const userName = agentData?.name || user.email?.split('@')[0] || 'User';

  // Fetch personal task data for stats
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('task_id')
    .eq('agent_id', user.id);
  
  const assignedIds = assignments?.map(a => a.task_id) || [];
  
  // Build task query
  let taskQuery = supabase.from('tasks').select('*, project:projects(name)');
  
  // If user is Admin, show all tasks. Otherwise, show only their tasks.
  const isAdmin = agentData?.role === 'Admin' || agentData?.role === 'admin';
  
  if (!isAdmin) {
    if (assignedIds.length > 0) {
      taskQuery = taskQuery.or(`created_by.eq.${user.id},id.in.(${assignedIds.join(',')})`);
    } else {
      taskQuery = taskQuery.eq('created_by', user.id);
    }
  }

  const { data: allUserTasks } = await taskQuery.order('created_at', { ascending: false });

  const totalTasks = allUserTasks?.length || 0;
  // Normalize comparison to be case-insensitive or handle common variations
  const completedTasks = allUserTasks?.filter(t => 
    t.status?.toLowerCase() === 'completed' || 
    t.status?.toLowerCase() === 'done'
  ).length || 0;
  
  const inProgressTasks = allUserTasks?.filter(t => 
    t.status?.toLowerCase() === 'in progress' || 
    t.status?.toLowerCase() === 'in-progress' ||
    t.status?.toLowerCase() === 'in_progress' ||
    t.status?.toLowerCase() === 'active'
  ).length || 0;
  
  const pendingTasks = allUserTasks?.filter(t => 
    t.status?.toLowerCase() === 'pending' || 
    t.status?.toLowerCase() === 'todo' ||
    t.status?.toLowerCase() === 'to do'
  ).length || 0;
  
  const efficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const recentTasks = allUserTasks?.filter(t => 
    t.status?.toLowerCase() !== 'completed' && 
    t.status?.toLowerCase() !== 'done'
  ).slice(0, 5) || [];

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-in slide-in-from-bottom-4 duration-500 animate-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-foreground/60 mt-1">
            Welcome back, <span className="font-semibold text-primary">{userName}</span>. Here's your workspace overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/task-management/board" 
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-card-border bg-card-bg rounded-lg text-sm font-bold text-foreground hover:bg-input-bg transition-all shadow-sm active:scale-95"
          >
            <Activity className="w-4 h-4 mr-2 text-primary" />
            Project Board
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="p-3 bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400 rounded-xl mb-4">
            <ListTodo size={24} />
          </div>
          <p className="text-foreground/60 text-xs font-bold uppercase tracking-wider">Total Tasks</p>
          <h3 className="text-4xl font-black text-foreground mt-2">{totalTasks}</h3>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="p-3 bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl mb-4">
            <Clock size={24} />
          </div>
          <p className="text-foreground/60 text-xs font-bold uppercase tracking-wider">In Progress</p>
          <h3 className="text-4xl font-black text-foreground mt-2">{inProgressTasks}</h3>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="p-3 bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400 rounded-xl mb-4">
            <CheckCircle size={24} />
          </div>
          <p className="text-foreground/60 text-xs font-bold uppercase tracking-wider">Completed</p>
          <h3 className="text-4xl font-black text-foreground mt-2">{completedTasks}</h3>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl mb-4">
            <Activity size={24} />
          </div>
          <p className="text-foreground/60 text-xs font-bold uppercase tracking-wider">Efficiency</p>
          <h3 className="text-4xl font-black text-foreground mt-2">{efficiency}%</h3>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Tasks Widget */}
        <div className="lg:col-span-2 glass-card rounded-3xl flex flex-col overflow-hidden border border-card-border/50">
          <div className="p-6 border-b border-card-border/50 flex justify-between items-center bg-card-bg/30">
            <h2 className="text-lg font-black text-foreground tracking-tight uppercase opacity-50">Active Work items</h2>
            <Link href="/task-management" className="text-xs font-bold text-primary hover:text-primary-hover transition-colors rounded-lg px-3 py-1 hover:bg-primary/5">
              View All Tasks
            </Link>
          </div>
          
          <div className="p-2 grow">
            {recentTasks.length > 0 ? (
              <div className="divide-y divide-card-border/30">
                {recentTasks.map((task) => (
                  <Link 
                    key={task.id} 
                    href={`/task-management/task/${task.id}`}
                    className="flex items-center justify-between p-4 hover:bg-input-bg/50 transition-all rounded-2xl group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'in progress' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-blue-500'
                      }`} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{task.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{task.project?.name || 'No Project'}</span>
                          <span className="text-[10px] font-medium text-foreground/20 italic">• {new Date(task.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className={`hidden sm:inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${
                          task.priority?.toLowerCase() === 'urgent' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          task.priority?.toLowerCase() === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                          task.priority?.toLowerCase() === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                       }`}>
                         {task.priority || 'Low'}
                       </span>
                       <ChevronRight size={16} className="text-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center min-h-[300px] text-center">
                <div className="w-16 h-16 bg-input-bg/50 rounded-2xl flex items-center justify-center mb-6 ring-8 ring-primary/5">
                  <ListTodo className="h-8 w-8 text-foreground/10" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No tasks found</h3>
                <p className="text-xs text-foreground/40 mt-2 max-w-[200px] leading-relaxed">
                  You haven't been assigned any tasks yet. Create your first task to get started!
                </p>
                <Link href="/task-management/new-task" className="mt-8 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover hover:scale-105 transition-all shadow-xl shadow-primary/20">
                  New Task
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* User Card Widget */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-bold text-foreground border-b border-card-border pb-4 mb-4">
            Profile Overview
          </h2>
          <div className="flex flex-col items-center mt-2 p-4 bg-input-bg rounded-2xl">
            <div className="w-20 h-20 rounded-full bg-linear-to-tr from-primary to-[#f05a96] flex items-center justify-center text-white text-2xl font-bold uppercase shadow-xl shadow-primary/20 border-4 border-card-bg">
                {userName.charAt(0)}
              </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">{userName}</h3>
            <span className="mt-1 px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
              {agentData?.role || 'Member'}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <div className="p-3 flex items-center justify-between rounded-xl bg-card-bg border border-card-border">
              <span className="text-sm text-foreground/60 font-medium">Status</span>
              <span className="flex items-center text-sm font-bold text-green-500">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
