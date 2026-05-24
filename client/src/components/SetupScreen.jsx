import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, FileUp, Sparkles, ChevronLeft, Loader2, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SetupScreen = ({ onSetupComplete }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !jd.trim()) {
      alert('Please upload a resume and provide a job description.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('job_description', jd);

    try {
      const aiApiUrl = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${aiApiUrl}/setup-interview`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (data.session_id) {
        onSetupComplete(data.session_id);
      } else {
        alert('Failed to initialize session.');
      }
    } catch (error) {
      console.error('Setup error:', error);
      alert('An error occurred connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/student/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 group transition-colors"
        type="button"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 md:p-12 relative overflow-hidden bg-slate-900/40 border-white/5"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 text-primary-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Neural Session Calibration
        </div>

        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">AI Interview Setup</h1>
        <p className="text-slate-400 mb-8 font-medium text-sm">
          Upload your resume and provide a target job description to configure the local AI interview questions.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
              Upload Resume (PDF Format)
            </label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:border-primary-500/50 hover:bg-white/5 transition-all group relative bg-[#080808]">
              {loading ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              ) : (
                <>
                  <FileUp className="w-8 h-8 text-primary-500 mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    {file ? file.name : 'Select Resume PDF'}
                  </p>
                </>
              )}
              <input 
                type="file" 
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">
              Target Job Description
            </label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-4 w-5 h-5 text-slate-500" />
              <textarea 
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows="6"
                className="w-full bg-[#080808] border border-white/5 rounded-3xl p-4 pl-12 text-white focus:outline-none focus:border-primary-500/50 transition-all font-medium resize-none text-sm leading-relaxed"
                placeholder="Paste the target job description details here..."
                required
              ></textarea>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5">
            <button 
              type="submit" 
              disabled={loading || !file || !jd.trim()}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg text-sm uppercase tracking-widest ${
                loading || !file || !jd.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20 active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Preparing Context...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" /> Start Neural Interview
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SetupScreen;
