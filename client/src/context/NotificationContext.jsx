import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import API from '../utils/api';
import { toast } from 'react-hot-toast';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user, socket } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data } = await API.get('/notifications');
            const list = data.notifications || (Array.isArray(data) ? data : []);
            setNotifications(list);
            setUnreadCount(data.unreadCount !== undefined ? data.unreadCount : list.filter(n => !n.read).length);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notification) => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            toast.success(notification.title, {
                description: notification.message,
                icon: '🔔',
            });
        };

        const handleBroadcast = (data) => {
            // Broadcasts are also saved in DB, but we show a major toast here
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">📣 {data.title}</p>
                                <p className="mt-1 text-sm text-gray-500">{data.message}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ), { duration: 5000 });

            // Re-fetch to get the persistent record if needed, or just append
            fetchNotifications();
        };

        const handleOpportunityUpdate = (data) => {
            toast.info(`Opportunity Update: ${data.title}`, {
                description: `Status changed to ${data.status}`,
            });
            // We could also trigger a refresh of the opportunities list if we had a shared search context
        };

        socket.on('notification:new', handleNewNotification);
        socket.on('broadcast:new', handleBroadcast);
        socket.on('opportunity:statusUpdated', handleOpportunityUpdate);

        return () => {
            socket.off('notification:new', handleNewNotification);
            socket.off('broadcast:new', handleBroadcast);
            socket.off('opportunity:statusUpdated', handleOpportunityUpdate);
        };
    }, [socket, fetchNotifications]);

    const markAsRead = async (id) => {
        try {
            await API.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await API.patch(`/notifications/acknowledge-all`);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead,
            fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);
