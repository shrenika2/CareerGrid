import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, CheckCircle2, MessageSquare,
    Zap, AlertCircle, Clock, Trash2,
    ArrowLeft, ExternalLink, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const NotificationHistory = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const { socket } = useAuth();
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/notifications');
            // Extract array from paginated response
            setNotifications(data.notifications || []);
        } catch (err) {
            toast.error('Failed to sync notification stream');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();

        if (socket) {
            socket.on('notification:new', (notif) => {
                setNotifications(prev => [notif, ...prev]);
                toast.success('New Signal Received');
            });
        }

        return () => {
            if (socket) socket.off('notification:new');
        };
    }, [socket]);

    const markAsRead = async (id) => {
        console.log(`[SIGNAL] Acknowledging single signal: ${id}`);
        try {
            const { data } = await API.patch(`/notifications/${id}/read`);
            console.log('[SIGNAL] Individual acknowledgement success:', data);
            setNotifications(prev => (prev || []).map(n => n._id === id ? { ...n, read: true } : n));
        } catch (err) {
            console.error('[SIGNAL] Individual acknowledgement failure:', err.response || err);
        }
    };

    const markAllAsRead = async () => {
        console.log('[SIGNAL] Initiating batch acknowledgement protocol...');
        try {
            const response = await API.patch('/notifications/acknowledge-all');

            console.log('[SIGNAL] Batch acknowledgement response status:', response.status);
            console.log('[SIGNAL] Batch acknowledgement payload:', response.data);

            if (response.data.success) {
                if (response.data.modifiedCount > 0) {
                    setNotifications(prev => (prev || []).map(n => ({ ...n, read: true })));
                    toast.success(response.data.message || 'All signals acknowledged');
                } else {
                    toast('No pending signals found to acknowledge.', { icon: 'ℹ️' });
                }
            }
        } catch (err) {
            console.error('[SIGNAL] Batch acknowledgement error object:', err);
            const errorMsg = err.response?.data?.message || 'Batch update failed';
            toast.error(errorMsg);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'application': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'broadcast': return <Zap className="w-5 h-5 text-amber-500" />;
            case 'opportunity_update': return <AlertCircle className="w-5 h-5 text-primary-500" />;
            case 'resource_added': return <MessageSquare className="w-5 h-5 text-purple-500" />;
            default: return <Bell className="w-5 h-5 text-slate-500" />;
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 pt-24 pb-12 px-6">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-6 text-[10px] font-black uppercase tracking-widest"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                        </button>
                        <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4 flex items-center gap-4">
                            Signal <span className="text-primary-500 text-outline">Logs</span>
                        </h1>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] italic">
                            Real-time intelligence and system broadcasts.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={markAllAsRead}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                        >
                            Acknowledge All
                        </button>
                    </div>
                </header>

                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {(notifications || []).length > 0 ? (
                            (notifications || []).map((notif) => (
                                <motion.div
                                    key={notif._id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    onClick={() => !notif.read && markAsRead(notif._id)}
                                    className={`glass-card p-6 border-white/5 ${notif.read ? 'bg-slate-900/20' : 'bg-slate-900/60 border-primary-500/20 shadow-lg shadow-primary-500/5'} transition-all cursor-pointer group relative overflow-hidden`}
                                >
                                    {!notif.read && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                                    )}

                                    <div className="flex items-start gap-6">
                                        <div className={`p-3 rounded-2xl ${notif.read ? 'bg-white/5' : 'bg-primary-500/10'} transition-colors`}>
                                            {getIcon(notif.type)}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className={`text-sm font-black uppercase tracking-tight ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                                                    {notif.title}
                                                </h4>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase italic">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <p className={`text-xs leading-relaxed mb-4 ${notif.read ? 'text-slate-600' : 'text-slate-300'}`}>
                                                {notif.message}
                                            </p>

                                            {notif.link && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(notif.link); }}
                                                    className="flex items-center gap-2 text-[9px] font-black text-primary-500 uppercase tracking-widest hover:text-white transition-colors"
                                                >
                                                    Access Protocol <ExternalLink className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-20 text-center glass-card border-dashed border-white/5 bg-white/[0.01]">
                                <Bell className="w-12 h-12 text-slate-800 mx-auto mb-6 opacity-20" />
                                <p className="text-xs text-slate-600 font-bold uppercase tracking-[0.2em]">Silence on the grid. No new signals detected.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default NotificationHistory;
