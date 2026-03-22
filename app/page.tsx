import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { Activity, Clock, CheckCircle, ListTodo } from 'lucide-react';
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

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-in slide-in-from-bottom-4 duration-500 animate-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-foreground/60 mt-1">
            Welcome back, <span className="font-semibold text-primary">{userName}</span>. Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="#" 
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 border border-card-border bg-card-bg rounded-lg text-sm font-medium text-foreground hover:bg-input-bg transition-colors shadow-sm"
          >
            <Activity className="w-4 h-4 mr-2 text-primary" />
            Activity Log
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
          <p className="text-foreground/60 text-sm font-medium">Total Tasks</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">12</h3>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="p-3 bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl mb-4">
            <Clock size={24} />
          </div>
          <p className="text-foreground/60 text-sm font-medium">In Progress</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">4</h3>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300">
          <div className="p-3 bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400 rounded-xl mb-4">
            <CheckCircle size={24} />
          </div>
          <p className="text-foreground/60 text-sm font-medium">Completed</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">7</h3>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-start hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-10"></div>
          <div className="p-3 bg-primary/10 text-primary dark:bg-primary/20 rounded-xl mb-4">
            <Activity size={24} />
          </div>
          <p className="text-foreground/60 text-sm font-medium">Efficiency</p>
          <h3 className="text-3xl font-bold text-foreground mt-1">87%</h3>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Tasks Widget */}
        <div className="lg:col-span-2 glass-card rounded-2xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-card-border flex justify-between items-center bg-card-bg/50">
            <h2 className="text-lg font-bold text-foreground">Recent Tasks</h2>
            <Link href="#" className="text-sm font-medium text-primary hover:text-primary-hover transition-colors">
              View All
            </Link>
          </div>
          <div className="p-6 grow flex items-center justify-center flex-col min-h-[300px]">
            <div className="w-20 h-20 bg-input-bg rounded-full flex items-center justify-center mb-4">
              <ListTodo className="h-10 w-10 text-foreground/20" />
            </div>
            <p className="text-foreground/60 text-center max-w-sm">
              Task management features will be replicated here. You'll be able to create, assign, and track progress.
            </p>
            <Link href="/task-management/new-task" className="mt-6 px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover hover:shadow-lg shadow-primary/25 transition-all duration-300">
              Create First Task
            </Link>
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
