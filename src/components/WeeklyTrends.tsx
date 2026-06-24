import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sparkles, Calendar, Loader2, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react';

export default function WeeklyTrends() {
  const [loading, setLoading] = useState<boolean>(true);
  const [trendsText, setTrendsText] = useState<string>('');
  const [reportsCount, setReportsCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  const [topCategory, setTopCategory] = useState<string>('N/A');

  const fetchTrendsData = async () => {
    setLoading(true);
    try {
      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Simple client side query for all reports in last 7 days
      const reportsCollection = collection(db, 'reports');
      const q = query(reportsCollection, where('timestamp', '>=', sevenDaysAgo));
      
      const snapshot = await getDocs(q);
      const docs: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({ id: doc.id, ...data });
      });

      setReportsCount(docs.length);
      const resolved = docs.filter(r => r.status === 'Resolved').length;
      setResolvedCount(resolved);

      // Determine top category
      if (docs.length > 0) {
        const counts: Record<string, number> = {};
        docs.forEach((doc) => {
          counts[doc.category] = (counts[doc.category] || 0) + 1;
        });
        const sortedCats = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        setTopCategory(`${sortedCats[0][0]} (${sortedCats[0][1]} filed)`);
      } else {
        setTopCategory('None');
      }

      // Send the report items summaries to backend Gemini api
      const response = await fetch('/api/generate-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: docs })
      });

      if (!response.ok) {
        throw new Error('Gemini trends aggregation request failed.');
      }

      const result = await response.json();
      setTrendsText(result.summary || 'Summary compiled successfully.');

    } catch (err: any) {
      console.error('Error fetching trends:', err);
      setTrendsText('Failed to aggregate weekly metrics. Make sure you have reports submitted and GEMINI_API_KEY is configured in Settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendsData();
  }, []);

  return (
    <div id="weekly-trends-box" className="glass-heavy rounded-3xl shadow-2xl p-6 md:p-8 space-y-8 relative overflow-hidden">
      
      {/* Decorative aurora orbs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-violet-500/8 rounded-full blur-[100px] pointer-events-none animate-breathe" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none animate-breathe" style={{ animationDelay: '2s' }} />

      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-cyan-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-gradient-aurora font-display font-bold text-2xl leading-tight">Weekly Civic Impact</h2>
            <p className="text-slate-400 text-xs mt-0.5 font-medium">Real-time narrative summarizing municipal trends & developments</p>
          </div>
        </div>

        <button 
          id="trends-refresh-btn"
          onClick={fetchTrendsData}
          disabled={loading}
          className="p-2.5 glass hover:border-violet-500/30 text-slate-400 hover:text-violet-400 rounded-xl transition-all duration-300 disabled:opacity-50 active:scale-95 shadow-sm cursor-pointer"
          title="Refresh statistics"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-5">
          {/* Orbital loader */}
          <div className="relative flex items-center justify-center w-16 h-16">
            {/* Pulsing aurora glow */}
            <div className="absolute w-20 h-20 bg-gradient-to-br from-violet-500/15 to-cyan-500/15 rounded-full blur-xl animate-glow-pulse" />
            {/* Center circle */}
            <div className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/30" />
            {/* Orbiting dots */}
            <div className="absolute w-full h-full animate-orbit" style={{ animationDuration: '1.8s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-lg shadow-violet-400/50" />
            </div>
            <div className="absolute w-full h-full animate-orbit" style={{ animationDuration: '2.4s', animationDelay: '0.6s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            </div>
            <div className="absolute w-full h-full animate-orbit" style={{ animationDuration: '3s', animationDelay: '1.2s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-lg shadow-rose-400/50" />
            </div>
          </div>
          <div className="animate-fade-in-up">
            <p className="text-sm font-extrabold text-white">Synthesizing District Narrative...</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">Gemini AI is scanning active reports, calculating hot zones, and preparing your weekly digest.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in-up">
          
          {/* Main Gemini Statement Card */}
          <div className="glass-heavy gradient-border text-slate-100 p-6 md:p-7 rounded-2xl relative overflow-hidden shadow-2xl">
            {/* Ambient background glow */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <span className="text-[10px] uppercase font-black tracking-widest bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 text-violet-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 mb-4 w-fit">
                <Sparkles size={11} className="text-violet-300 animate-pulse shrink-0" /> Gemini Intelligence Summary
              </span>
              {/* Decorative opening quote mark */}
              <span className="absolute -top-1 -left-1 text-6xl text-violet-500/10 font-serif leading-none select-none pointer-events-none">"</span>
              <p className="text-[14px] md:text-[16px] text-slate-200 leading-relaxed font-medium select-text italic pl-4">
                "{trendsText}"
              </p>
            </div>
          </div>

          {/* Bento Grid Metrics panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs font-semibold">
            
            {/* Metric Card 1 */}
            <div className="glass-card rounded-2xl p-5 hover:border-violet-500/15 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Logged (7 Days)</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Calendar size={15} />
                </div>
              </div>
              <div>
                <span className="block font-display font-black text-3xl animate-count-up text-white mt-0.5">{reportsCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1">Community Grievances filed</span>
              </div>
            </div>

            {/* Metric Card 2 */}
            <div className="glass-card rounded-2xl p-5 hover:border-violet-500/15 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Resolved (7 Days)</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <CheckCircle2 size={15} />
                </div>
              </div>
              <div>
                <span className="block font-display font-black text-3xl animate-count-up text-emerald-400 mt-0.5">{resolvedCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1">Issues solved by services</span>
              </div>
            </div>

            {/* Metric Card 3 */}
            <div className="glass-card rounded-2xl p-5 hover:border-violet-500/15 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Active Hotspot Category</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/15 to-rose-500/15 text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <BarChart2 size={15} />
                </div>
              </div>
              <div>
                <span className="block text-md font-black text-violet-300 mt-1.5 truncate max-w-full leading-tight font-display">{topCategory}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1">Highest frequency complaint</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
