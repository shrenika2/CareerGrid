import React, { useState, useEffect } from 'react';
import API from '../../utils/api';
import {
    Activity, Clock, AlertCircle, CheckCircle2,
    ArrowRight, Loader2, Calendar, TrendingUp,
    Zap, Target, ShieldCheck, Bug, User, GraduationCap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const DashboardOverview = () => {
    const { socket, user } = useAuth();
    const [metrics, setMetrics] = useState(null);
    const [applications, setApplications] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [readinessDataList, setReadinessDataList] = useState([]);

    const fetchDashboardData = async () => {
        try {
            let metricsData = null;
            let fetchedReadiness = [];

            // Fire a GET request to /api/students/metrics
            try {
                const metricsRes = await API.get('/students/metrics');
                metricsData = metricsRes.data;
                if (metricsData && Array.isArray(metricsData.readinessData) && metricsData.readinessData.length > 0) {
                    fetchedReadiness = metricsData.readinessData;
                }
            } catch (err) {
                console.error("Failed to fetch /api/students/metrics, attempting fallback", err);
                try {
                    const metricsRes = await API.get('/student/metrics');
                    metricsData = metricsRes.data;
                    if (metricsData && Array.isArray(metricsData.readinessData) && metricsData.readinessData.length > 0) {
                        fetchedReadiness = metricsData.readinessData;
                    }
                } catch (fallbackErr) {
                    console.error("Fallback /api/student/metrics also failed", fallbackErr);
                }
            }

            // If empty or network returns error, cleanly inject a 5-day mock timeline curve configuration array
            if (fetchedReadiness.length === 0) {
                fetchedReadiness = [
                    { name: 'Day 1', score: 30 },
                    { name: 'Day 2', score: 45 },
                    { name: 'Day 3', score: 60 },
                    { name: 'Day 4', score: 75 },
                    { name: 'Day 5', score: 90 }
                ];
            }

            setReadinessDataList(fetchedReadiness);

            const [appsRes, profileRes] = await Promise.all([
                API.get('/opportunities/my-applications').catch(() => ({ data: [] })),
                API.get('/student-profile/me').catch(() => ({ data: null }))
            ]);

            setApplications(appsRes.data || []);
            setProfile(profileRes.data || null);

            if (metricsData) {
                setMetrics({
                    ...metricsData,
                    readinessData: fetchedReadiness
                });
            } else {
                setMetrics({
                    readinessData: fetchedReadiness,
                    upcomingDeadlines: [],
                    insights: [
                        { text: "Complete your mock interview to sync real-time trajectory metrics.", action: "Start Interview", type: "info" }
                    ]
                });
            }
        } catch (err) {
            console.error("Dashboard Sync Failed", err);
            if (fetchedReadiness.length === 0) {
                setReadinessDataList([
                    { name: 'Day 1', score: 30 },
                    { name: 'Day 2', score: 45 },
                    { name: 'Day 3', score: 60 },
                    { name: 'Day 4', score: 75 },
                    { name: 'Day 5', score: 90 }
                ]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    useEffect(() => {
        if (!socket || !user?._id) return;

        // Emit a join_room room targeting descriptor using student's unique logged-in context ID string
        socket.emit('join_room', { room: `user_${user._id}` });

        const handleMetricsUpdate = (data) => {
            console.log('[DashboardOverview] Received metrics_update:', data);
            toast.success("Readiness score synchronized!", {
                icon: '📈',
                style: {
                    borderRadius: '10px',
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)'
                }
            });

            // Update graph's React state array immediately
            const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
            setReadinessDataList(prev => {
                return [...prev, { name: currentDay, score: data.newScore }];
            });
        };

        socket.on('metrics_update', handleMetricsUpdate);

        socket.on('notification:new', (notif) => {
            if (notif.type === 'application') {
                fetchDashboardData();
            }
        });

        socket.on('profile:updated', (updatedProfile) => {
            if (updatedProfile.user === user?._id) {
                setProfile(updatedProfile);
            }
        });

        return () => {
            socket.off('metrics_update', handleMetricsUpdate);
            socket.off('notification:new');
            socket.off('profile:updated');
        };
    }, [socket, user?._id]);

    const readinessData = readinessDataList.length > 0 ? readinessDataList : (metrics?.readinessData || [
        { name: 'Sun', score: 0 },
        { name: 'Mon', score: 0 },
        { name: 'Tue', score: 0 },
        { name: 'Wed', score: 0 },
        { name: 'Thu', score: 0 },
        { name: 'Fri', score: 0 },
        { name: 'Sat', score: 0 },
    ]);

    if (loading) return (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-6">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Synchronizing Portal Signals</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Real-time Status Tracking */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <Activity className="w-5 h-5 text-primary-500" />
                                Active Deployment Status
                            </h3>
                            <button className="text-[10px] font-black text-primary-500 uppercase tracking-widest hover:text-white transition-colors">View Deployment Log</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(applications || []).length > 0 ? (applications || []).slice(0, 4).map(app => (
                                <div key={app._id} className="glass-card p-5 border-white/5 bg-slate-900/40 hover:bg-slate-900/60 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-slate-500 group-hover:text-primary-500 transition-colors uppercase">
                                            {app.opportunity?.title?.charAt(0) || 'O'}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase truncate w-32">{app.opportunity?.title}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">{app.status}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <StatusBadge status={app.status} />
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-12 text-center glass-card border-dashed border-white/5 bg-white/[0.01]">
                                    <p className="text-xs text-slate-600 font-bold uppercase">No active deployments detected.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="glass-card p-8 border-white/5 bg-slate-900/40">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <TrendingUp className="w-5 h-5 text-primary-500" />
                                Readiness Trajectory
                            </h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase">Current Protocol Readiness: {readinessData[readinessData.length - 1]?.score || 0}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={readinessData}>
                                    <defs>
                                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" />
                                    <YAxis stroke="#64748b" fontSize={10} fontWeight="bold" domain={[0, 100]} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}
                                    />
                                    <Area type="monotone" dataKey="score" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                </div>

                {/* Sidebar Alerts & Reminders */}
                <div className="space-y-8">
                    <section className="glass-card p-8 border-white/5 bg-slate-900/40">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <User className="w-4 h-4 text-primary-500" />
                                Profile Integrity
                            </h3>
                            <span className={`text-[10px] font-black uppercase ${profile?.isComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {profile?.isComplete ? 'Optimized' : 'Incomplete'}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: profile?.isComplete ? '100%' : '60%' }}
                                    className={`h-full ${profile?.isComplete ? 'bg-emerald-500' : 'bg-amber-500'} shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000`}
                                />
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                {profile?.isComplete
                                    ? 'Your profile protocol is fully synchronized.'
                                    : 'Please uplink your resume and skills to reach 100%.'}
                            </p>
                            {!profile?.isComplete && (
                                <button className="mt-2 w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">
                                    Complete Protocol
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="glass-card p-8 border-white/5 bg-slate-900/40">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-primary-500" />
                            Critical Chronology
                        </h3>
                        <div className="space-y-4">
                            {(metrics?.upcomingDeadlines || []).length > 0 ? (metrics?.upcomingDeadlines || []).map((d, i) => (
                                <div key={i} className="flex gap-4 p-4 hover:bg-white/5 rounded-2xl transition-colors group">
                                    <div className="h-10 w-10 bg-slate-800 rounded-xl flex flex-col items-center justify-center shrink-0 border border-white/5">
                                        <span className="text-[10px] font-black text-white">{new Date(d.deadline).getDate()}</span>
                                        <span className="text-[8px] font-black text-slate-500 uppercase">{new Date(d.deadline).toLocaleDateString(undefined, { month: 'short' })}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-black text-white uppercase leading-tight mb-1 truncate w-40">{d.title}</h4>
                                        <span className={`text-[9px] font-black uppercase text-amber-500`}>{d.type} Deadline</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-600 font-bold uppercase p-4">No upcoming events found.</p>
                            )}
                        </div>
                    </section>

                    <section className="glass-card p-8 bg-primary-600/10 border-primary-500/20">
                        <h3 className="text-sm font-black text-primary-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <Zap className="w-4 h-4" />
                            Optimization Insights
                        </h3>
                        <div className="space-y-4">
                            {(metrics?.insights || []).map((insight, i) => (
                                <div key={i} className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic mb-3">"{insight.text}"</p>
                                    <button className="text-[9px] font-black text-primary-500 uppercase hover:text-white transition-colors flex items-center gap-2">{insight.action} <ArrowRight className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const configs = {
        'pending': 'bg-amber-500/20 text-amber-500',
        'accepted': 'bg-emerald-500/20 text-emerald-500',
        'rejected': 'bg-red-500/20 text-red-500',
        'shortlisted': 'bg-primary-500/20 text-primary-500'
    };
    const normalizedStatus = (status || 'pending').toLowerCase();
    const style = configs[normalizedStatus] || 'bg-slate-500/20 text-slate-500';
    return (
        <div className={`w-2 h-2 rounded-full ${style.split(' ')[1].replace('text-', 'bg-')}`} />
    );
};

export default DashboardOverview;
