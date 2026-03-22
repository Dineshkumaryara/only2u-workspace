"use client";

import { useSidebarStore } from "@/stores/useSidebarStore";
import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarStore();
  const pathname = usePathname();
  
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return <div className="flex-1 w-full">{children}</div>;
  }

  return (
    <div 
        className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isCollapsed ? 'lg:pl-[88px]' : 'lg:pl-72'}`}
    >
      {children}
    </div>
  );
}
