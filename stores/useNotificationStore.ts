import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    reference_id: string | null;
    is_read: boolean;
    created_at: string;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    fetchNotifications: (userId: string) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: (userId: string) => Promise<void>;
    subscribeToNotifications: (userId: string) => () => void;
}

const supabase = createClient();

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,

    fetchNotifications: async (userId: string) => {
        set({ loading: true, error: null });
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const notifications = data as Notification[];
            const unreadCount = notifications.filter(n => !n.is_read).length;

            set({ notifications, unreadCount, loading: false });
        } catch (error: any) {
            console.error('Error fetching notifications:', error);
            set({ error: error.message, loading: false });
        }
    },

    markAsRead: async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;

            set((state) => {
                const updatedNotifications = state.notifications.map(n =>
                    n.id === notificationId ? { ...n, is_read: true } : n
                );
                return {
                    notifications: updatedNotifications,
                    unreadCount: updatedNotifications.filter(n => !n.is_read).length
                };
            });
        } catch (error: any) {
            console.error('Error marking notification as read:', error);
        }
    },

    markAllAsRead: async (userId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) throw error;

            set((state) => ({
                notifications: state.notifications.map(n => ({ ...n, is_read: true })),
                unreadCount: 0
            }));
        } catch (error: any) {
            console.error('Error marking all notifications as read:', error);
        }
    },

    subscribeToNotifications: (userId: string) => {
        const channel = supabase
            .channel(`notifications:user_id=eq.${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    set((state) => {
                        const updatedNotifications = [newNotification, ...state.notifications];
                        return {
                            notifications: updatedNotifications,
                            unreadCount: updatedNotifications.filter(n => !n.is_read).length
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
}));
