import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, FileUp, ListChecks, Mic,
    Zap, CheckCircle2, Loader2, Info,
    ChevronRight, Sparkles, AlertCircle
} from 'lucide-react';
import InterviewConsole from '../features/interview/InterviewConsole';
import { AudioProcessor } from '../utils/audioProcessor';

const InterviewPipeline = () => {
    const navigate = useNavigate();
    const { user, socket } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [opportunities, setOpportunities] = useState([]);
    const [selectedOppId, setSelectedOppId] = useState('');
    const [matchData, setMatchData] = useState(null);
    const [isInterviewing, setIsInterviewing] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    const [error, setError] = useState(null);

    const audioProcessorRef = useRef(null);
    const audioOutContextRef = useRef(null);

    useEffect(() => {
        if (step === 2) fetchOpportunities();
    }, [step]);

    const fetchOpportunities = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/opportunities');
            setOpportunities(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            await API.post('/upload/resume', formData);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    const handleJobSelection = async () => {
        if (!selectedOppId) return;
        setLoading(true);
        try {
            const { data } = await API.post(`/ai/calculate-match`, { opportunityId: selectedOppId });
            setMatchData(data);
            setStep(3);
        } catch (err) {
            // Fallback for demo
            setMatchData({ score: 85, matchedSkills: ['React', 'Node.js'], missingSkills: ['Typescript'] });
            setStep(3);
        } finally {
            setLoading(false);
        }
    };

    const startLocalInterview = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await API.post('/ai/setup-local-session', { opportunityId: selectedOppId });
            if (data.success && data.session_id) {
                navigate('/student/live-interview', { state: { sessionId: data.session_id } });
            } else {
                setError('Failed to configure local AI session.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to sync with local AI backend.');
        } finally {
            setLoading(false);
        }
    };

    const startInterview = () => {
        if (!socket) return setError('Relay link unavailable. Reconnecting...');

        setError(null);
        setIsInterviewing(true);

        // Handshake with backend socket
        socket.emit('interview:start', { opportunityId: selectedOppId });

        // Audio Output Setup (Playing AI audio)
        audioOutContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

        // Listen for AI Audio
        socket.on('interview:ai_audio', (data) => {
            playRawPCM(data.audio);
        });

        socket.on('interview:started', (data) => {
            setSessionData(data);
        });

        socket.on('interview:summary', (data) => {
            setMatchData(prev => ({ ...prev, evaluation: data }));
            setStep(4);
        });

        socket.on('interview:error', (data) => {
            setError(data.message);
        });

        // Initialize Audio Capture
        audioProcessorRef.current = new AudioProcessor((base64) => {
            socket.emit('interview:audio', { audio: base64 });
        });

        audioProcessorRef.current.start().catch(err => {
            setError('Microphone access denied. Enable permissions to proceed.');
            stopInterview();
        });
    };

    const stopInterview = () => {
        if (socket) {
            socket.emit('interview:end');
            socket.off('interview:ai_audio');
            socket.off('interview:started');
            socket.off('interview:error');
        }
        if (audioProcessorRef.current) audioProcessorRef.current.stop();
        if (audioOutContextRef.current) audioOutContextRef.current.close();
        setIsInterviewing(false);
        setStep(4);
    };

    // Helper to play base64 PCM16
    const playRawPCM = (base64) => {
        if (!audioOutContextRef.current) return;

        const bin = window.atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

        const buffer = audioOutContextRef.current.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = audioOutContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioOutContextRef.current.destination);
        source.start();
    };

    return (
        <div className="min-h-screen pt-24 pb-20 px-4 bg-slate-950">
            <div className="max-w-4xl mx-auto">
                <AnimatePresence mode="wait">
                    {!isInterviewing ? (
                        <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="mb-12 text-center">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-widest mb-4"
                                >
                                    <Brain className="w-4 h-4" /> Tactical Interview Pipeline
                                </motion.div>
                                <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase">Mission Control</h1>
                                <p className="text-slate-400 max-w-xl mx-auto">Sync your professional profile and undergo a neural evaluation for target roles.</p>
                            </div>

                            {/* Progress Bar */}
                            <div className="flex items-center justify-between mb-16 relative">
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -z-10" />
                                {[
                                    { id: 1, label: 'Bio-Sync', icon: FileUp },
                                    { id: 2, label: 'Targeting', icon: ListChecks },
                                    { id: 3, label: 'Calibration', icon: Zap },
                                    { id: 4, label: 'Neutralization', icon: Mic }
                                ].map((s) => (
                                    <div key={s.id} className="flex flex-col items-center">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${step >= s.id ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20 scale-110' : 'bg-slate-900 text-slate-500 border border-white/5'}`}>
                                            <s.icon className="w-6 h-6" />
                                        </div>
                                        <span className={`text-[10px] uppercase font-black tracking-widest mt-3 ${step >= s.id ? 'text-primary-400' : 'text-slate-600'}`}>{s.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="glass-card p-10 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
                                {step === 1 && (
                                    <div className="text-center w-full max-w-md">
                                        <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-primary-500/20">
                                            <FileUp className="w-10 h-10 text-primary-500" />
                                        </div>
                                        <h2 className="text-3xl font-black text-white mb-4 uppercase">Neural Profiling</h2>
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:border-primary-500/50 hover:bg-white/5 transition-all group">
                                            {loading ? <Loader2 className="w-8 h-8 animate-spin text-primary-500" /> : <><Sparkles className="w-8 h-8 text-primary-500 mb-2 group-hover:scale-110" /><p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Upload Tactical PDF</p></>}
                                            <input type="file" className="hidden" accept=".pdf" onChange={handleResumeUpload} disabled={loading} />
                                        </label>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="w-full">
                                        <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-tight">Select Targeted node</h2>
                                        <div className="grid grid-cols-1 gap-4 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {opportunities.map(opp => (
                                                <button
                                                    key={opp._id}
                                                    onClick={() => setSelectedOppId(opp._id)}
                                                    className={`p-5 rounded-2xl border transition-all text-left flex items-center justify-between group ${selectedOppId === opp._id ? 'bg-primary-600 border-primary-500' : 'bg-slate-900 border-white/5 hover:border-white/20'}`}
                                                >
                                                    <div>
                                                        <h4 className={`font-black uppercase tracking-tight ${selectedOppId === opp._id ? 'text-white' : 'text-slate-200'}`}>{opp.title}</h4>
                                                        <p className={`text-[9px] uppercase font-black ${selectedOppId === opp._id ? 'text-primary-100' : 'text-slate-500'}`}>{opp.postedBy?.name} • {opp.location}</p>
                                                    </div>
                                                    {selectedOppId === opp._id && <CheckCircle2 className="w-5 h-5 text-white" />}
                                                </button>
                                            ))}
                                        </div>
                                         <button 
                                             onClick={handleJobSelection} 
                                             disabled={!selectedOppId || loading} 
                                             className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                                 !selectedOppId || loading
                                                     ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                                                     : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20 active:scale-95'
                                             }`}
                                         >
                                             {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Calculate Strategic Fit <ChevronRight className="w-5 h-5" /></>}
                                         </button>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="w-full text-center">
                                        <div className="relative w-48 h-48 mx-auto mb-10">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
                                                <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={502} strokeDashoffset={502 - (502 * (matchData?.score || 0)) / 100} className="text-primary-500 transition-all duration-1000 ease-out" />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-6xl font-black text-white italic">{matchData?.score || 0}%</span>
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Fit Score</span>
                                            </div>
                                        </div>
                                         <h2 className="text-4xl font-black text-white mb-10 uppercase italic">Calibration Success</h2>
                                         <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-2xl mx-auto">
                                             <button 
                                                 onClick={() => setStep(2)} 
                                                 className="w-full sm:w-auto px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest border border-white/5 hover:bg-slate-800 transition-colors"
                                             >
                                                 Re-Target
                                             </button>
                                             
                                             <button 
                                                 onClick={startInterview} 
                                                 disabled={loading}
                                                 className="w-full sm:flex-1 py-4 px-6 bg-[#030712] border border-primary-500/30 hover:border-primary-500 text-primary-400 hover:text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/5"
                                             >
                                                 <Mic className="w-4 h-4 text-primary-500" /> Premium Voice Eval
                                             </button>

                                             <button 
                                                 onClick={startLocalInterview} 
                                                 disabled={loading}
                                                 className="w-full sm:flex-1 py-4 px-6 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary-600/30 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                             >
                                                 {loading ? (
                                                     <Loader2 className="w-4 h-4 animate-spin" />
                                                 ) : (
                                                     <>
                                                         <Zap className="w-4 h-4" /> Local Voice Eval (Ollama)
                                                     </>
                                                 )}
                                             </button>
                                         </div>
                                     </div>
                                )}

                                {step === 4 && (
                                    <div className="text-center w-full">
                                        <div className="w-24 h-24 bg-green-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-green-500/20">
                                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                                        </div>
                                        <h2 className="text-4xl font-black text-white mb-4 uppercase italic">Neural Eval Complete</h2>

                                        {matchData?.evaluation ? (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10 space-y-6">
                                                <div className="flex justify-center gap-4">
                                                    <div className="glass-card p-4 bg-white/5 border-white/10 w-32">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Score</p>
                                                        <p className="text-2xl font-black text-white">{matchData.evaluation.score}%</p>
                                                    </div>
                                                    <div className="glass-card p-4 bg-white/5 border-white/10 w-32">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Result</p>
                                                        <p className={`text-2xl font-black ${matchData.evaluation.passed ? 'text-green-500' : 'text-yellow-500'}`}>{matchData.evaluation.passed ? 'PASSED' : 'REVIEW'}</p>
                                                    </div>
                                                </div>
                                                <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 italic text-slate-400 text-sm leading-relaxed">
                                                    "{matchData.evaluation.message}"
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <div className="mb-10 flex flex-col items-center gap-3">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Generating Tactical Post-Match Analysis...</p>
                                            </div>
                                        )}

                                        <button onClick={() => navigate('/student/dashboard')} className="px-12 py-5 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg shadow-primary-600/20 hover:scale-105 transition-all">Return to Nexus</button>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-red-500">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                                    </div>
                                    <button 
                                        onClick={startLocalInterview}
                                        className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/30 hover:border-red-500/50 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
                                    >
                                        Use Local Ollama Voice Eval
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <InterviewConsole
                            sessionData={sessionData}
                            onComplete={stopInterview}
                            onCancel={() => setIsInterviewing(false)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default InterviewPipeline;
