import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, StopCircle, Volume2, 
  Bot, Sparkles, MessageSquare, Monitor, 
  AlertCircle, Home, VolumeX, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const MockInterviewer = ({ sessionId, jobTitle = "AI Voice Interview" }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentAiText, setCurrentAiText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalReport, setEvalReport] = useState(null);

  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const accumulatedAiTextRef = useRef('');
  const currentSentenceRef = useRef('');
  const chatContainerRef = useRef(null);
  const timerRef = useRef(null);

  const [visualizerHeights, setVisualizerHeights] = useState(new Array(15).fill(10));

  // Visualizer animation
  useEffect(() => {
    let interval;
    if (isRecording || aiIsSpeaking) {
      interval = setInterval(() => {
        setVisualizerHeights(prev => prev.map(() => Math.floor(Math.random() * 80) + 20));
      }, 100);
    } else {
      setVisualizerHeights(new Array(15).fill(10));
    }
    return () => clearInterval(interval);
  }, [isRecording, aiIsSpeaking]);

  useEffect(() => {
    // 1. Initialize Session Timer
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);

    // 2. Initialize WebSocket
    const aiApiUrl = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000';
    const wsBaseUrl = aiApiUrl.replace(/^http/, 'ws');
    const cleanBaseUrl = wsBaseUrl.endsWith('/') ? wsBaseUrl.slice(0, -1) : wsBaseUrl;
    const wsUrl = `${cleanBaseUrl}/ws/interview/${sessionId}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const token = event.data;
      if (token === '[DONE]') {
        // Stream finished: flush any remaining sentence buffer
        if (currentSentenceRef.current.trim().length > 0) {
          if (ttsEnabled) speak(currentSentenceRef.current);
        }
        setMessages((prev) => [...prev, { role: 'ai', content: accumulatedAiTextRef.current }]);
        
        // Reset buffers
        accumulatedAiTextRef.current = '';
        setCurrentAiText('');
        currentSentenceRef.current = '';
        setAiIsSpeaking(false);
      } else {
        setAiIsSpeaking(true);
        // Append token to buffers
        accumulatedAiTextRef.current += token;
        setCurrentAiText(accumulatedAiTextRef.current);
        currentSentenceRef.current += token;

        // Dynamic Sentence Parsing: Speak when punctuation is reached
        if (/[.!?]\s$/.test(currentSentenceRef.current) || /[.!?]$/.test(currentSentenceRef.current)) {
          if (ttsEnabled) speak(currentSentenceRef.current);
          currentSentenceRef.current = ''; // Clear buffer for next sentence
        }
      }
    };

    // 3. Initialize Speech-To-Text (Browser Native)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onend = () => {
        if (isRecording) {
          try { recognitionRef.current.start(); } catch(e){}
        }
      };
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
      clearInterval(timerRef.current);
    };
  }, [sessionId, ttsEnabled]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentAiText, transcript]);

  const speak = (text) => {
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05; 
    utterance.pitch = 1.0;
    utterance.onstart = () => setAiIsSpeaking(true);
    utterance.onend = () => setAiIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleStartSpeaking = () => {
    window.speechSynthesis.cancel(); // Stop AI speaking to avoid echo
    setTranscript('');
    setIsRecording(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleStopSpeaking = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    
    // Send transcribed text over WebSocket once user lets go of the button
    if (transcript.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setMessages((prev) => [...prev, { role: 'user', content: transcript }]);
      wsRef.current.send(transcript);
      setTranscript('');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndSession = async () => {
    window.speechSynthesis.cancel();
    if (wsRef.current) wsRef.current.close();
    
    setIsEvaluating(true);
    try {
      const aiApiUrl = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${aiApiUrl.replace('/api', '')}/api/evaluate-interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await response.json();
      if (data && !data.error) {
        // Construct responses array: mapping transcript messages to the questions and answers
        const formattedResponses = [];
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].role === 'ai' && messages[i+1] && messages[i+1].role === 'user') {
            formattedResponses.push({
              question: messages[i].content,
              answer: messages[i+1].content,
              feedback: "Local Ollama voice interaction feedback"
            });
          }
        }

        // Persist attempt to MongoDB via Node server
        try {
          const persistResponse = await API.post('/ai/interview-attempts', {
            jobTitle,
            responses: formattedResponses
          });
          const attemptId = persistResponse.data?.attempt?._id;
          if (attemptId) {
            navigate(`/student/mock-interview/results/${attemptId}`);
            return;
          }
        } catch (persistErr) {
          console.error("Failed to persist attempt:", persistErr);
        }

        setEvalReport(data);
      } else {
        alert('Failed to generate AI evaluation report.');
        navigate('/student/dashboard');
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      alert('Failed to connect to the evaluation server.');
      navigate('/student/dashboard');
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isEvaluating) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-6 p-6 text-center">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
        <h3 className="text-xl font-black text-white uppercase tracking-widest">Generating Technical Post-Match Analysis...</h3>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">AI is parsing transcript signals for accuracy and articulation metrics.</p>
      </div>
    );
  }

  if (evalReport) {
    return (
      <div className="min-h-screen bg-[#020617] pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-[10px] font-black uppercase tracking-widest mb-3">
            <Sparkles className="w-3 h-3" /> local AI evaluation complete
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Session Report</h1>
          <p className="text-slate-500 mt-1">Ollama Mistral Evaluation Hub</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {/* Score card */}
          <div className="glass-card p-8 md:col-span-1 flex flex-col items-center text-center relative overflow-hidden bg-slate-900/40 border-white/5">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Overall Score</h2>
            <div className="relative flex items-center justify-center w-36 h-36 border-4 border-primary-500 rounded-full shadow-[0_0_30px_rgba(139,92,246,0.3)]">
              <span className="text-5xl font-black text-white italic">{evalReport.overall_score || 0}</span>
              <span className="text-[10px] font-bold text-slate-500 absolute bottom-4">/ 10</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-8">Performance Rating</p>
            <p className="text-sm font-black text-primary-400 uppercase tracking-tight mt-1">
              {evalReport.overall_score >= 8 ? 'Exceptional Fit' : evalReport.overall_score >= 6 ? 'Qualified Candidate' : 'Improvement Required'}
            </p>
          </div>

          {/* Detailed Feedback */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-card p-8 bg-slate-900/40 border-white/5 space-y-6">
              <h3 className="text-md font-black text-white uppercase tracking-tight border-b border-white/5 pb-4 flex items-center gap-3">
                <Bot className="w-5 h-5 text-primary-500" /> AI Evaluator Summary
              </h3>
              <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                "{evalReport.feedback_summary || 'No summary generated.'}"
              </p>
            </div>

            <div className="glass-card p-8 bg-slate-900/40 border-white/5">
              <h3 className="text-md font-black text-white uppercase tracking-tight mb-6 border-b border-white/5 pb-4 flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary-500" /> Key Insights
              </h3>

              <div className="space-y-4">
                {/* Strengths */}
                {evalReport.notable_strengths && evalReport.notable_strengths.map((str, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-green-500/5 border border-green-500/10">
                    <div className="p-2 bg-green-500/20 text-green-400 rounded-xl shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase font-black tracking-widest text-green-400">Notable Strength</h4>
                      <p className="text-xs font-semibold text-slate-300 mt-1">{str}</p>
                    </div>
                  </div>
                ))}

                {/* Improvements */}
                {evalReport.areas_of_improvement && evalReport.areas_of_improvement.map((imp, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-[9px] uppercase font-black tracking-widest text-amber-400">Area of Improvement</h4>
                      <p className="text-xs font-semibold text-slate-300 mt-1">{imp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => navigate('/student/dashboard')}
              className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-primary-600/30 hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2"
            >
              Return to Nexus
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-300 font-sans">
      
      {/* Header HUD */}
      <div className="bg-slate-950/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">Local Voice AI Evaluation</h2>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ollama Node Online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Session Timer</p>
            <p className="text-sm font-black text-white font-mono">{formatTime(timer)}</p>
          </div>
          
          {/* Mute TTS button */}
          <button
            onClick={() => {
              if (ttsEnabled) {
                window.speechSynthesis.cancel();
                setTtsEnabled(false);
              } else {
                setTtsEnabled(true);
              }
            }}
            className={`p-3 rounded-xl border transition-all ${
              ttsEnabled 
                ? 'bg-white/5 border-white/5 text-slate-400 hover:text-white' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            }`}
            title={ttsEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={handleEndSession}
            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/20"
            title="Complete Session"
          >
            <StopCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Panel grid */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* Left Side: Avatar/Visualizer */}
        <div className="lg:col-span-5 glass-card bg-slate-900/40 border-white/5 p-8 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-primary-500/5 to-transparent pointer-events-none" />

          {/* Visualizing Ring */}
          <div className="relative mb-12">
            <motion.div
              animate={{
                scale: aiIsSpeaking ? [1, 1.25, 1] : isRecording ? [1, 1.15, 1] : 1,
                opacity: aiIsSpeaking ? [0.2, 0.4, 0.2] : isRecording ? [0.15, 0.3, 0.15] : 0.05
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 bg-primary-500 rounded-full blur-3xl"
            />
            <div className={`w-40 h-40 rounded-full border-2 flex items-center justify-center relative z-10 transition-all duration-500 ${
              aiIsSpeaking 
                ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.3)]' 
                : isRecording 
                ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_50px_rgba(244,63,94,0.3)]' 
                : 'border-white/10 bg-slate-950/50'
            }`}>
              {aiIsSpeaking ? (
                <Volume2 className="w-16 h-16 text-emerald-500 animate-pulse" />
              ) : isRecording ? (
                <Mic className="w-16 h-16 text-rose-500" />
              ) : (
                <Bot className="w-16 h-16 text-primary-500" />
              )}
            </div>
          </div>

          {/* Equalizer waves */}
          <div className="flex gap-1.5 h-12 items-end mb-12">
            {visualizerHeights.map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.1 }}
                className={`w-1.5 rounded-full ${
                  aiIsSpeaking ? 'bg-emerald-500/60' : isRecording ? 'bg-rose-500/60' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              aiIsSpeaking 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                : isRecording 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                : 'bg-slate-800 border-white/5 text-slate-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                aiIsSpeaking ? 'bg-emerald-500' : isRecording ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'
              }`} />
              {aiIsSpeaking ? 'AI Interviewer Speaking' : isRecording ? 'Microphone Active' : 'System Standing By'}
            </div>
            
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center max-w-xs mt-2 leading-relaxed">
              {!ttsEnabled && 'Text-To-Speech is muted. Read questions from the transcript monitor.'}
            </p>
          </div>
        </div>

        {/* Right Side: Conversation Transcript */}
        <div className="lg:col-span-7 glass-card bg-slate-900/40 border-white/5 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-500" />
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Transcript Monitor</h3>
            </div>
          </div>

          <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {messages.length === 0 && !currentAiText && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                <Sparkles className="w-8 h-8 text-primary-500/30 mb-3 animate-spin" />
                <p className="text-xs uppercase font-black tracking-widest">Calibrating interview context...</p>
                <p className="text-[10px] font-bold uppercase tracking-tight text-slate-600 mt-1">Please wait for the AI to start speaking.</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: msg.role === 'ai' ? -10 : 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                key={idx} 
                className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}
              >
                <div className={`max-w-[85%] p-4 rounded-2xl text-[11px] font-medium leading-relaxed ${
                  msg.role === 'ai' 
                    ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5' 
                    : 'bg-primary-600 text-white rounded-tr-none'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[8px] font-black text-slate-600 mt-2 uppercase tracking-widest">
                  {msg.role === 'ai' ? 'Interviewer' : 'Subject'}
                </span>
              </motion.div>
            ))}
            
            {/* Streaming AI message bubble */}
            {currentAiText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-start">
                <div className="max-w-[85%] p-4 rounded-2xl text-[11px] font-medium leading-relaxed bg-slate-800 text-slate-200 rounded-tl-none border border-white/5">
                  {currentAiText} <span className="animate-pulse inline-block w-2.5 h-3.5 bg-slate-400 ml-1"></span>
                </div>
                <span className="text-[8px] font-black text-slate-600 mt-2 uppercase tracking-widest">
                  Interviewer (Streaming)
                </span>
              </motion.div>
            )}

            {/* Interim Transcript bubble */}
            {transcript && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-end opacity-70">
                <div className="max-w-[85%] p-4 rounded-2xl text-[11px] font-medium leading-relaxed bg-primary-600 text-white rounded-tr-none">
                  {transcript}
                </div>
                <span className="text-[8px] font-black text-slate-600 mt-2 uppercase tracking-widest">
                  Subject (Transcribing...)
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Voice Controls bar */}
      <div className="p-8 bg-slate-950/40 border-t border-white/5 flex flex-col justify-center items-center gap-3 pb-10">
        <button
          onMouseDown={handleStartSpeaking}
          onMouseUp={handleStopSpeaking}
          onMouseLeave={isRecording ? handleStopSpeaking : undefined}
          onTouchStart={handleStartSpeaking}
          onTouchEnd={handleStopSpeaking}
          className={`px-12 py-5 rounded-full font-black uppercase text-xs tracking-widest text-white transition-all transform select-none ${
            isRecording 
              ? 'bg-rose-500 scale-105 shadow-[0_0_30px_rgba(244,63,94,0.6)] border border-rose-400/20' 
              : 'bg-primary-600 hover:bg-primary-500 hover:shadow-lg active:scale-95 border border-primary-500/20'
          }`}
        >
          {isRecording ? 'Release to Send' : 'Hold Space/Click to Speak'}
        </button>
        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">
          Hold down button or space key to talk, release when finished answering
        </p>
      </div>
    </div>
  );
};

export default MockInterviewer;
