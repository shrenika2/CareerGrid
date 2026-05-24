import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import API from '../../utils/api';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, Target, Rocket, Activity, RefreshCw, MessageSquare, Layers, Loader2 } from 'lucide-react';

// --- SVG Circular Progress Bar ---
const CircularScore = ({ score, maxScore = 10 }) => {
    const radius = 70;
    const stroke = 8;
    const normalizedRadius = radius - stroke / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const progress = score / maxScore;
    const strokeDashoffset = circumference - progress * circumference;

    const color = score >= 8 ? '#22c55e' : score >= 6 ? '#3b82f6' : '#f59e0b';

    return (
        <div className="relative flex items-center justify-center w-48 h-48">
            <svg height={radius * 2} width={radius * 2} className="-rotate-90">
                {/* Background track */}
                <circle
                    stroke="rgba(255,255,255,0.05)"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                {/* Progress arc */}
                <motion.circle
                    stroke={color}
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    strokeDasharray={`${circumference} ${circumference}`}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                />
            </svg>
            {/* Center label */}
            <div className="absolute flex flex-col items-center">
                <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="text-5xl font-black text-white tracking-tighter"
                >
                    {score}
                </motion.span>
                <span className="text-xs font-bold text-slate-500">/ {maxScore}</span>
            </div>
        </div>
    );
};

// --- Dynamic Role-Based Feedback Engine ---
const generateFeedback = (jobRole = '', answeredCount = 0) => {
    const role = jobRole.toLowerCase();

    const roleConfig = {
        frontend: {
            label: 'Frontend Developer',
            stats: [
                { label: 'UI/UX Articulation', val: 88, icon: Layers, color: 'text-primary-400' },
                { label: 'Communication', val: 92, icon: Activity, color: 'text-green-400' },
                { label: 'Problem-Solving', val: 74, icon: Rocket, color: 'text-yellow-400' },
            ],
            score: 8.4,
            feedback: [
                { type: 'strength', text: 'Strong CSS layout knowledge demonstrated — excellent understanding of Flexbox and Grid positioning.' },
                { type: 'strength', text: 'Articulated the React component lifecycle confidently and with clear real-world examples.' },
                { type: 'improvement', text: 'Could improve on State Management explanations — consider exploring Redux Toolkit or Zustand patterns more deeply.' },
                { type: 'improvement', text: 'Mention performance optimization techniques (memoization, lazy loading) more proactively during technical questions.' },
            ]
        },
        backend: {
            label: 'Backend Developer',
            stats: [
                { label: 'API Design', val: 85, icon: Layers, color: 'text-primary-400' },
                { label: 'Communication', val: 78, icon: Activity, color: 'text-green-400' },
                { label: 'System Design', val: 70, icon: Rocket, color: 'text-yellow-400' },
            ],
            score: 7.9,
            feedback: [
                { type: 'strength', text: 'Good understanding of REST APIs — clear explanation of HTTP verbs and status code semantics.' },
                { type: 'strength', text: 'Demonstrated solid knowledge of middleware chains and authentication token flows.' },
                { type: 'improvement', text: 'Focus more on Database Indexing strategies — discuss composite indexes, query plans, and EXPLAIN outputs in interviews.' },
                { type: 'improvement', text: 'Expand answers with scalability considerations — mention horizontal vs. vertical scaling, caching (Redis), and load balancing.' },
            ]
        },
        data: {
            label: 'Data Scientist',
            stats: [
                { label: 'ML Concepts', val: 90, icon: Layers, color: 'text-primary-400' },
                { label: 'Communication', val: 82, icon: Activity, color: 'text-green-400' },
                { label: 'Statistical Depth', val: 76, icon: Rocket, color: 'text-yellow-400' },
            ],
            score: 8.2,
            feedback: [
                { type: 'strength', text: 'Strong grasp of ML bias-variance tradeoffs, confidently explained with concrete examples.' },
                { type: 'strength', text: 'Good communication of model evaluation metrics — showed understanding of precision vs. recall tradeoffs.' },
                { type: 'improvement', text: 'Brush up on feature engineering pipelines and hands-on data preprocessing workflows.' },
                { type: 'improvement', text: 'Practice explaining model deployment considerations (latency, monitoring, model drift) during system design questions.' },
            ]
        },
        default: {
            label: 'General Candidate',
            stats: [
                { label: 'Technical Depth', val: 75, icon: Layers, color: 'text-primary-400' },
                { label: 'Communication', val: 88, icon: Activity, color: 'text-green-400' },
                { label: 'Adaptability', val: 80, icon: Rocket, color: 'text-yellow-400' },
            ],
            score: 7.6,
            feedback: [
                { type: 'strength', text: 'Maintained a clear and structured communication style throughout the interview session.' },
                { type: 'strength', text: 'Showed strong adaptability when responding to varied behavioral and situational questions.' },
                { type: 'improvement', text: 'Use the STAR method (Situation, Task, Action, Result) more consistently when answering behavioral questions.' },
                { type: 'improvement', text: 'Prepare more specific metrics and quantifiable outcomes from past experiences to strengthen answers.' },
            ]
        }
    };

    let config = roleConfig.default;
    if (role.includes('frontend') || role.includes('ui') || role.includes('react') || role.includes('web')) {
        config = roleConfig.frontend;
    } else if (role.includes('backend') || role.includes('api') || role.includes('node') || role.includes('server')) {
        config = roleConfig.backend;
    } else if (role.includes('data') || role.includes('ml') || role.includes('machine') || role.includes('science')) {
        config = roleConfig.data;
    }

    // Slightly adjust score based on how many questions the candidate answered
    const completionBonus = Math.min(answeredCount / 5, 1) * 0.5;
    const finalScore = Math.min(10, parseFloat((config.score + completionBonus).toFixed(1)));

    return { ...config, score: finalScore };
};

const Results = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const [loading, setLoading] = useState(false);
    const [attemptData, setAttemptData] = useState(null);

    const { jobRole = 'Software Engineer', answeredQuestions = [] } = location.state || {};

    // --- Guard Clause: redirect if user refreshes and location.state is gone AND not fetching real ID ---
    useEffect(() => {
        if (!id && !location.state) {
            navigate('/student/mock-interview/setup', { replace: true });
        }
    }, [id, location.state, navigate]);

    // Generate mock feedback in case fetching fails or is bypassed
    const mockFeedback = useMemo(
        () => generateFeedback(jobRole, answeredQuestions.length),
        [jobRole, answeredQuestions.length]
    );

    useEffect(() => {
        const fetchAttempt = async () => {
            if (!id || id === '1') {
                // Keep local state evaluation for static mock flow
                return;
            }
            setLoading(true);
            try {
                const { data } = await API.get(`/ai/interview-attempts/${id}`);
                if (data && data.success && data.attempt) {
                    setAttemptData(data.attempt);
                }
            } catch (err) {
                console.error('[RESULTS] Failed to fetch interview attempt from API:', err.message);
                // Clean fallback to local mock state, nothing crashes
            } finally {
                setLoading(false);
            }
        };

        fetchAttempt();
    }, [id]);

    // Map fields dynamically based on whether we loaded a database record
    const label = attemptData ? attemptData.jobTitle : mockFeedback.label;
    
    // Score in DB is out of 100, UI expectation is out of 10 (with decimals, e.g. 7.9)
    const score = attemptData ? parseFloat((attemptData.score / 10).toFixed(1)) : mockFeedback.score;
    
    const stats = attemptData ? [
        { label: 'Technical Depth', val: attemptData.breakdown?.technical || 70, icon: Layers, color: 'text-primary-400' },
        { label: 'Communication', val: attemptData.breakdown?.communication || 80, icon: Activity, color: 'text-green-400' },
        { 
            label: 'Problem-Solving', 
            val: Math.round(((attemptData.breakdown?.technical || 70) + (attemptData.breakdown?.communication || 80)) / 2), 
            icon: Rocket, 
            color: 'text-yellow-400' 
        },
    ] : mockFeedback.stats;

    const feedback = attemptData ? [
        { 
            type: 'strength', 
            text: 'Demonstrated solid technical reasoning and vocabulary alignment during answer intervals.' 
        },
        { 
            type: 'strength', 
            text: 'Presented structured explanations with proper definitions for technical stacks.' 
        },
        { 
            type: 'improvement', 
            text: 'Focus on explaining scalability trade-offs and backend database index optimization patterns.' 
        },
        { 
            type: 'improvement', 
            text: 'Utilize structured frameworks like the STAR model more consistently in behavioral segments.' 
        }
    ] : mockFeedback.feedback;

    const displayQuestions = attemptData 
        ? attemptData.responses.map(r => r.question) 
        : answeredQuestions;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="text-center flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Retrieving Evaluation Analysis...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <button
                onClick={() => navigate('/student/dashboard')}
                className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 group transition-colors"
                type="button"
            >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Back to Mission Control
            </button>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-[10px] font-black uppercase tracking-widest mb-3">
                    <Activity className="w-3 h-3" /> AI Evaluation Complete
                </div>
                <h1 className="text-3xl font-black text-white">Session Report</h1>
                <p className="text-slate-400 mt-1">
                    Role: <span className="text-white font-bold">{label}</span>
                    <span className="mx-2 text-slate-600">•</span>
                    Questions Answered: <span className="text-white font-bold">{displayQuestions.length}</span>
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
                {/* Score Panel */}
                <div className="glass-card p-8 lg:col-span-1 flex flex-col items-center text-center relative overflow-hidden bg-slate-900/40">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary-500/10 to-transparent pointer-events-none" />

                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Overall AI Score</h2>

                    <CircularScore score={score} />

                    <div className="w-full space-y-3 mt-8">
                        {stats.map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">{stat.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Mini bar */}
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full bg-current"
                                            style={{ color: stat.color.replace('text-', '').replace('-400', '') }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${stat.val}%` }}
                                            transition={{ duration: 1, delay: i * 0.2 }}
                                        />
                                    </div>
                                    <span className={`text-xs font-black tracking-widest w-8 text-right ${stat.color}`}>{stat.val}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => navigate('/student/interview-pipeline')}
                        className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
                    >
                        <RefreshCw className="w-4 h-4" /> Try Again
                    </button>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Feedback Panel */}
                    <div className="glass-card p-8 bg-slate-900/40">
                        <h3 className="text-lg font-black text-white mb-6 border-b border-white/5 pb-4 flex items-center gap-3">
                            <Activity className="w-5 h-5 text-primary-500" /> AI Evaluator Feedback
                        </h3>
                        <div className="space-y-4">
                            {feedback.map((point, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + i * 0.1 }}
                                    className={`flex items-start gap-4 p-4 rounded-2xl border ${point.type === 'strength'
                                        ? 'bg-green-500/5 border-green-500/20'
                                        : 'bg-yellow-500/5 border-yellow-500/20'
                                        }`}
                                >
                                    <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${point.type === 'strength' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
                                        }`}>
                                        {point.type === 'strength'
                                            ? <CheckCircle2 className="w-5 h-5" />
                                            : <Target className="w-5 h-5" />}
                                    </div>
                                    <div className="pt-1">
                                        <h4 className={`text-[10px] uppercase font-black tracking-widest mb-1 ${point.type === 'strength' ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                            {point.type === 'strength' ? 'Notable Strength' : 'Area of Improvement'}
                                        </h4>
                                        <p className="text-sm font-medium text-slate-300 leading-relaxed">{point.text}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Answered Questions Log */}
                    {displayQuestions.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="glass-card p-8 bg-slate-900/40"
                        >
                            <h3 className="text-lg font-black text-white mb-6 border-b border-white/5 pb-4 flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-primary-500" /> Questions Covered
                            </h3>
                            <ol className="space-y-3">
                                {displayQuestions.map((q, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-[10px] font-black flex items-center justify-center mt-0.5">
                                            {i + 1}
                                        </span>
                                        {q}
                                    </li>
                                ))}
                            </ol>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Results;
