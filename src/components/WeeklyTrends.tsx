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
    <div id="weekly-trends-box" className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-800 leading-tight">Weekly Civic Impact</h2>
            <p className="text-slate-400 text-xs">AI-driven narrative summarizing regional developments</p>
          </div>
        </div>

        <button 
          id="trends-refresh-btn"
          onClick={fetchTrendsData}
          disabled={loading}
          className="p-2 hover:bg-slate-50 text-slate-500 rounded-lg transition border border-slate-100 disabled:opacity-50"
          title="Refresh statistics"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="text-xs text-slate-400 font-semibold">Gemini is writing the week's summary...</p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Gemini Statement Card */}
          <div className="bg-slate-900 text-slate-100 p-5 rounded-xl relative overflow-hidden shadow-inner border border-slate-800">
            {/* Ambient background glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-400 flex items-center gap-1.5 mb-2.5">
                <Sparkles size={11} /> Gemini Impact Narrative
              </span>
              <p className="text-xs md:text-sm font-medium leading-relaxed select-text italic text-slate-200">
                "{trendsText}"
              </p>
            </div>
          </div>

          {/* Sizable stats block on bottom */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
            
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Calendar size={16} />
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-bold">Logged (7 Days)</span>
                <span className="block text-[15px] font-extrabold text-slate-800 mt-0.5">{reportsCount} Complaints</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-bold">Resolved (7 Days)</span>
                <span className="block text-[15px] font-extrabold text-slate-800 mt-0.5">{resolvedCount} Tickets</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <BarChart2 size={16} />
              </div>
              <div>
                <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-bold">Active Hotspot Category</span>
                <span className="block text-[15px] font-extrabold text-slate-800 mt-0.5 truncate max-w-[130px]">{topCategory}</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
