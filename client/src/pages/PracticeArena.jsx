import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, Timer, CheckCircle, XCircle,
    ArrowRight, Loader2, Trophy, Target,
    ShieldAlert, BrainCircuit, Sparkles
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { toast } from 'react-hot-toast';

const PracticeArena = () => {
    const { companyId } = useParams();
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [timer, setTimer] = useState(0);
    const [stats, setStats] = useState({ correct: 0, total: 0 });

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const { data } = await API.get(`/practice/company/${companyId}`);
                setQuestions(data || []);
                setLoading(false);
            } catch (err) {
                toast.error('Failed to initialize arena');
                setLoading(false);
            }
        };
        fetchQuestions();
    }, [companyId]);

    useEffect(() => {
        let interval;
        if (!isSubmitted && (questions || []).length > 0) {
            interval = setInterval(() => setTimer(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isSubmitted, questions]);

    const handleOptionSelect = (option) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    };

    const submitAnswer = async () => {
        if (!selectedOption) return;

        const currentQ = questions[currentIndex];
        const isCorrect = selectedOption === currentQ.answer;

        setIsSubmitted(true);
        setStats(prev => ({
            total: prev.total + 1,
            correct: isCorrect ? prev.correct + 1 : prev.correct
        }));

        try {
            await API.post('/practice/attempt', {
                questionId: currentQ._id,
                isCorrect,
                timeTaken: timer
            });
        } catch (err) {
            console.error('Failed to log attempt', err);
        }
    };

    const nextQuestion = () => {
        if (currentIndex < (questions || []).length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
            setTimer(0);
        } else {
            // End of quiz
            toast.success('Arena Protocol Complete');
            navigate('/student/dashboard/overview');
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        </div>
    );

    if ((questions || []).length === 0) return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-center">
            <div className="glass-card p-12 border-white/5 max-w-md">
                <ShieldAlert className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                <h3 className="text-xl font-black text-white uppercase mb-4">No Protocols Found</h3>
                <p className="text-slate-500 mb-8 font-medium">This company has not deployed any practice simulations yet.</p>
                <button onClick={() => navigate(-1)} className="w-full py-4 bg-white/5 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/5">Return to Hub</button>
            </div>
        </div>
    );

    const q = questions[currentIndex];

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 pt-24 pb-20 px-6">
            <div className="max-w-4xl mx-auto">
                {/* HUD */}
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-6">
                        <div className="px-4 py-2 bg-slate-900 border border-white/5 rounded-xl flex items-center gap-3">
                            <Timer className="w-4 h-4 text-primary-500" />
                            <span className="text-sm font-black text-white tabular-nums">{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</span>
                        </div>
                        <div className="px-4 py-2 bg-slate-900 border border-white/5 rounded-xl flex items-center gap-3">
                            <Target className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-black text-white">{currentIndex + 1} / {(questions || []).length}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/student/interview-pipeline')}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary-600/10 hover:bg-primary-600 text-primary-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-primary-500/20"
                        >
                            <BrainCircuit className="w-4 h-4" /> Start AI Mock Interview
                        </button>
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accuracy</p>
                            <p className="text-sm font-black text-white">{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%</p>
                        </div>
                        <div className="w-12 h-12 bg-primary-600/10 rounded-2xl border border-primary-500/20 flex items-center justify-center">
                            <Trophy className="w-6 h-6 text-primary-500" />
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="glass-card p-10 border-white/5 bg-slate-900/40 relative overflow-hidden"
                    >
                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                            <motion.div
                                className="h-full bg-primary-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentIndex + 1) / (questions?.length || 1)) * 100}%` }}
                            />
                        </div>

                        <div className="flex items-center gap-3 mb-8">
                            <span className="px-3 py-1 rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-black uppercase tracking-widest border border-primary-500/20">
                                {q.category}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${q.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-500' :
                                q.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                {q.difficulty}
                            </span>
                        </div>

                        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-12 leading-relaxed">
                            {q.question}
                        </h2>

                        <div className="grid grid-cols-1 gap-4 mb-12">
                            {(q?.options || []).map((opt, i) => (
                                <motion.button
                                    key={i}
                                    whileHover={!isSubmitted ? { x: 10 } : {}}
                                    onClick={() => handleOptionSelect(opt)}
                                    className={`p-6 rounded-2xl border transition-all text-left font-bold relative overflow-hidden ${selectedOption === opt
                                        ? 'bg-primary-600/10 border-primary-500 text-white shadow-lg shadow-primary-500/5'
                                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/20'
                                        } ${isSubmitted && opt === q.answer ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : ''
                                        } ${isSubmitted && selectedOption === opt && opt !== q.answer ? 'bg-red-500/10 border-red-500 text-red-500' : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">{opt}</span>
                                        {isSubmitted && opt === q.answer && <CheckCircle className="w-5 h-5" />}
                                        {isSubmitted && selectedOption === opt && opt !== q.answer && <XCircle className="w-5 h-5" />}
                                    </div>
                                </motion.button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-8 border-t border-white/5">
                            <div className="flex items-center gap-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                                <Sparkles className="w-4 h-4" /> Real-time scoring active
                            </div>

                            {!isSubmitted ? (
                                <button
                                    onClick={submitAnswer}
                                    disabled={!selectedOption}
                                    className="px-10 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-primary-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    Submit Protocol
                                </button>
                            ) : (
                                <button
                                    onClick={nextQuestion}
                                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
                                >
                                    {currentIndex === (questions || []).length - 1 ? 'End Protocol' : 'Next Question'} <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PracticeArena;
