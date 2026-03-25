'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, Clock, Inbox, Circle, ChevronRight } from 'lucide-react';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface NotificationDropdownProps {
  userId: string;
}

export default function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    notifications, 
    unreadCount, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead, 
    subscribeToNotifications 
  } = useNotificationStore();

  useEffect(() => {
    if (userId) {
      fetchNotifications(userId);
      const unsubscribe = subscribeToNotifications(userId);
      return () => unsubscribe();
    }
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead(userId);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'task_assigned': return <Circle className="w-2 h-2 text-blue-500 fill-blue-500" />;
      case 'task_completed': return <Circle className="w-2 h-2 text-green-500 fill-green-500" />;
      case 'project_added': return <Circle className="w-2 h-2 text-primary fill-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />;
      case 'payment_request': return <Circle className="w-2 h-2 text-amber-500 fill-amber-500" />;
      default: return <Circle className="w-2 h-2 text-foreground/20 fill-foreground/20" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-input-bg text-foreground/70 hover:text-primary hover:bg-card-border transition-all duration-200 group"
        aria-label="Notifications"
      >
        <Bell size={18} className="group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in duration-300">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-card-bg border border-card-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
          <div className="px-5 py-4 border-b border-input-border flex items-center justify-between bg-input-bg/50">
            <h3 className="text-sm font-extrabold text-foreground flex items-center">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-primary hover:underline transition-all"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-card-bg">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-input-bg flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6 text-foreground/20" />
                </div>
                <p className="text-sm font-bold text-foreground/40 uppercase tracking-widest">No notifications yet</p>
                <p className="text-xs text-foreground/30 mt-1">We'll alert you when something happens.</p>
              </div>
            ) : (
              <div className="divide-y divide-input-border">
                {notifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => {
                        if (!n.is_read) markAsRead(n.id);
                        setIsOpen(false);
                    }}
                    className={`p-4 hover:bg-input-bg/50 transition-colors cursor-pointer relative group ${!n.is_read ? 'bg-primary/2' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0">
                        {getIconForType(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className={`text-xs font-extrabold truncate pr-4 ${!n.is_read ? 'text-foreground' : 'text-foreground/60'}`}>
                            {n.title}
                          </p>
                          <div className="flex items-center text-[10px] font-bold text-foreground/40 whitespace-nowrap">
                            <Clock size={10} className="mr-1" />
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        <p className="text-xs text-foreground/60 line-clamp-2 leading-relaxed mb-2">
                          {n.message}
                        </p>
                        
                        {n.reference_id && (
                           <Link 
                            href={n.type === 'project_added' ? `/task-management/projects/${n.reference_id}` : `/task-management/task/${n.reference_id}`}
                            className="inline-flex items-center text-[10px] font-extrabold text-primary hover:underline group/link"
                           >
                             View Details <ChevronRight size={10} className="ml-0.5 group-hover/link:translate-x-0.5 transition-transform" />
                           </Link>
                        )}
                      </div>
                    </div>
                    {!n.is_read && (
                        <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                title="Mark as read"
                            >
                                <Check size={12} />
                            </button>
                        </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-input-border bg-input-bg/30 text-center">
                <button className="text-xs font-bold text-foreground/40 hover:text-foreground transition-colors uppercase tracking-widest">
                    View Archieve
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
