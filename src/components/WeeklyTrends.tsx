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
    <div id="weekly-trends-box" className="bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6 md:p-8 space-y-8 relative overflow-hidden">
      
      {/* Absolute design grids */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/10">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-xl text-white leading-tight">Weekly Civic Impact</h2>
            <p className="text-slate-450 text-xs mt-0.5 font-medium">Real-time narrative summarizing municipal trends & developments</p>
          </div>
        </div>

        <button 
          id="trends-refresh-btn"
          onClick={fetchTrendsData}
          disabled={loading}
          className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition border border-white/5 disabled:opacity-50 active:scale-95 shadow-sm cursor-pointer"
          title="Refresh statistics"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative flex items-center justify-center w-12 h-12">
            <span className="absolute w-full h-full border-2 border-indigo-500/20 rounded-full" />
            <span className="absolute w-full h-full border-t-2 border-indigo-400 rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">Synthesizing District Narrative...</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">Gemini AI is scanning active reports, calculating hot zones, and preparing your weekly digest.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          
          {/* Main Gemini Statement Card */}
          <div className="bg-slate-950/60 text-slate-100 p-6 md:p-7 rounded-2xl relative overflow-hidden shadow-2xl border border-white/5">
            {/* Ambient background glow */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-900/40 px-2.5 py-1 rounded-full flex items-center gap-1.5 mb-4 w-fit">
                <Sparkles size={11} className="text-indigo-400 animate-spin-slow shrink-0" /> Gemini Intelligence Summary
              </span>
              <p className="text-[13px] md:text-[15px] font-medium leading-relaxed select-text italic text-slate-350 pl-1">
                "{trendsText}"
              </p>
            </div>
          </div>

          {/* Bento Grid Metrics panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs font-semibold">
            
            {/* Metric Card 1 */}
            <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">Logged (7 Days)</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Calendar size={15} />
                </div>
              </div>
              <div>
                <span className="block text-2xl font-black font-display text-white mt-0.5">{reportsCount}</span>
                <span className="text-[10px] text-slate-500 font-bold block mt-1">Community Grievances filed</span>
              </div>
            </div>

            {/* Metric Card 2 */}
            <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">Resolved (7 Days)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <CheckCircle2 size={15} />
                </div>
              </div>
              <div>
                <span className="block text-2xl font-black font-display text-emerald-400 mt-0.5">{resolvedCount}</span>
                <span className="text-[10px] text-slate-500 font-bold block mt-1">Issues solved by services</span>
              </div>
            </div>

            {/* Metric Card 3 */}
            <div className="bg-slate-950/40 hover:bg-slate-950/60 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase tracking-wider font-extrabold">Active Hotspot Category</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <BarChart2 size={15} />
                </div>
              </div>
              <div>
                <span className="block text-md font-black text-indigo-300 mt-1.5 truncate max-w-full leading-tight">{topCategory}</span>
                <span className="text-[10px] text-slate-500 font-bold block mt-1">Highest frequency complaint</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
