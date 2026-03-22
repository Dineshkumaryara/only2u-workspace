"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ListTodo, 
  Kanban, 
  PlusCircle, 
  Settings,
  ChevronLeft,
  LogOut,
  ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { useSidebarStore } from "@/stores/useSidebarStore";

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, setCollapsed, isMobileOpen, setMobileOpen } = useSidebarStore();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
    };
    fetchUser();
    
    // Check if collapsed preference is stored
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, [setCollapsed, supabase.auth]);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const dashboardItems = [
    { name: "Overview", icon: <LayoutDashboard size={20} />, href: "/" },
  ];

  const taskManagementItems = [
    { name: "My Tasks", icon: <ListTodo size={20} />, href: "/task-management" },
    { name: "Project Board", icon: <Kanban size={20} />, href: "/task-management/board" },
    { name: "New Task", icon: <PlusCircle size={20} />, href: "/task-management/new-task" },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    // Exact match or sub-path but not a sibling (e.g. /task-management matches /task-management/123 but not /task-management/board)
    if (path === '/task-management') {
      return pathname === '/task-management' || (pathname.startsWith('/task-management/') && !pathname.startsWith('/task-management/board') && !pathname.startsWith('/task-management/new-task'));
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  if (pathname === '/login' || pathname === '/signup') return null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-background/40 backdrop-blur-sm z-90 lg:hidden animate-in fade-in duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside 
        className={`fixed left-0 top-0 h-screen bg-card-bg/70 backdrop-blur-3xl border-r border-card-border z-100 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] 
          ${isCollapsed ? 'lg:w-[88px]' : 'lg:w-72'} 
          w-72 ${isMobileOpen ? 'translate-x-0 shadow-2xl shadow-black/20' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full relative group/sidebar">
          
          {/* Toggle Button - Desktop Only */}
          <button 
              onClick={toggleSidebar}
              className={`absolute -right-3.5 top-20 w-7 h-7 bg-card-bg border border-card-border rounded-full hidden lg:flex items-center justify-center text-foreground/40 hover:text-primary hover:border-primary/50 shadow-lg shadow-black/5 transition-all z-50 opacity-0 group-hover/sidebar:opacity-100 duration-300`}
          >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Logo Section */}
          <div className={`p-6 mb-2 flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-start'} justify-between`}>
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-4 transition-transform active:scale-95">
              {isCollapsed ? (
                <div className="hidden lg:block">
                  <Image src="/images/favicon.png" alt="Logo" width={70} height={70} />
                </div>
              ) : (
                <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-500">
                   <h2 className="text-2xl font-extrabold">only<span className="text-primary">2</span>u</h2>
                  <span className="text-[10px] font-extrabold text-primary tracking-[0.25em] uppercase mt-1" >Workspace</span>
                </div>
              )}
            </Link>

            {/* Mobile Close Button */}
            <button 
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-2 text-foreground/40 hover:text-primary transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar-thin scroll-smooth">
            
            <div className="space-y-1.5 mb-8">
              {dashboardItems.map((item) => (
                <Link 
                  key={item.name} 
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group/item font-bold text-sm ${isActive(item.href) ? 'bg-primary text-white shadow-xl shadow-primary/25' : 'text-foreground/50 hover:bg-primary/5 hover:text-primary'}`}
                >
                  <div className={`transition-transform duration-300 group-hover/item:scale-110 ${isCollapsed ? 'lg:mx-auto' : ''}`}>
                    {item.icon}
                  </div>
                  {(!isCollapsed || isMobileOpen) && <span className="animate-in fade-in slide-in-from-left-2 duration-300">{item.name}</span>}
                  
                  {isCollapsed && !isMobileOpen && (
                    <div className="absolute left-full ml-6 px-3 py-2 bg-foreground text-background text-xs font-bold rounded-xl opacity-0 translate-x-[-10px] group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-110 shadow-2xl">
                      {item.name}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            <div className="space-y-1.5 border-t border-card-border/50 pt-5 mt-2">
              {(!isCollapsed || isMobileOpen) && (
                <p className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.25em] ml-4 mb-4 select-none">Task Management</p>
              )}
              
              {taskManagementItems.map((item) => (
                <Link 
                  key={item.name} 
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group/item font-bold text-sm ${isActive(item.href) ? 'bg-primary text-white shadow-xl shadow-primary/25' : 'text-foreground/50 hover:bg-primary/5 hover:text-primary'}`}
                >
                  <div className={`transition-transform duration-300 group-hover/item:scale-110 ${isCollapsed ? 'lg:mx-auto' : ''}`}>
                    {item.icon}
                  </div>
                  {(!isCollapsed || isMobileOpen) && <span className="animate-in fade-in slide-in-from-left-2 duration-300">{item.name}</span>}
                  
                  {isCollapsed && !isMobileOpen && (
                    <div className="absolute left-full ml-6 px-3 py-2 bg-foreground text-background text-xs font-bold rounded-xl opacity-0 translate-x-[-10px] group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-110 shadow-2xl">
                      {item.name}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom Section - User Profile */}
          <div className={`p-4 mt-auto border-t border-card-border/50 bg-card-bg/20 ${isCollapsed ? 'lg:items-center' : ''}`}>
            {(!isCollapsed || isMobileOpen) ? (
              <div className="p-4 rounded-3xl bg-input-bg/40 border border-input-border/30 flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-primary to-primary/60 p-px">
                    <div className="w-full h-full rounded-2xl bg-card-bg flex items-center justify-center text-primary font-black shadow-inner">
                      {user?.email?.[0].toUpperCase() || 'A'}
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="text-xs font-black text-foreground truncate uppercase tracking-tight">{user?.email?.split('@')[0]}</span>
                    <span className="text-[10px] font-bold text-foreground/30 truncate">{user?.email}</span>
                  </div>
                 </div>
                 
                 <div className="flex gap-2.5 pt-3 border-t border-input-border/20">
                    <Link href="/settings" onClick={() => setMobileOpen(false)} className="flex-1 h-9 rounded-xl bg-input-bg/70 text-foreground/40 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all flex items-center justify-center group/btn">
                      <Settings size={16} className="group-hover/btn:rotate-45 transition-transform" />
                    </Link>
                    <button onClick={handleSignOut} className="flex-1 h-9 rounded-xl bg-red-500/5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center justify-center group/btn">
                      <LogOut size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                 </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 py-2">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shadow-inner">
                    {user?.email?.[0].toUpperCase() || 'A'}
                  </div>
                  <button 
                      onClick={handleSignOut}
                      className="p-3 rounded-2xl text-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-all"
                      title="Logout"
                  >
                    <LogOut size={22} />
                  </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
