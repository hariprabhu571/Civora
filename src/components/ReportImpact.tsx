import React, { useState } from 'react';
import { CivicReport } from '../types';
import { 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  MapPin, 
  Sparkles,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReportImpactProps {
  reports: CivicReport[];
  userUuid: string;
  onSelectReport: (reportId: string) => void;
}

const CATEGORY_META: Record<string, { avgTime: string; impactText: string }> = {
  'Pothole': {
    avgTime: '3-5 days',
    impactText: 'helped identify a critical road safety hotspot'
  },
  'Streetlight': {
    avgTime: '1-2 days',
    impactText: 'raised awareness to restore neighborhood visibility and safety'
  },
  'Garbage/Waste': {
    avgTime: '1-2 days',
    impactText: 'initiated direct cleanup action for a healthier community'
  },
  'Water Leakage': {
    avgTime: '2-4 days',
    impactText: 'helped conserve essential public resources'
  },
  'Damaged Public Property': {
    avgTime: '4-7 days',
    impactText: 'prompted repair planning for shared local assets'
  },
  'Traffic Signal Issue': {
    avgTime: '1-2 days',
    impactText: 'raised awareness to repair critical traffic regulators for road safety'
  },
  'Public Toilet Issue': {
    avgTime: '2-3 days',
    impactText: 'prompted sanitation review to improve public hygiene facilities'
  },
  'Tree Fallen': {
    avgTime: '1-2 days',
    impactText: 'alerted emergency clearance services to remove road obstructions'
  },
  'Illegal Dumping': {
    avgTime: '2-4 days',
    impactText: 'reported unlawful waste accumulation for strict anti-litter enforcement'
  },
  'Other': {
    avgTime: '3-5 days',
    impactText: 'alerted municipal services to a critical neighborhood issue'
  }
};

export default function ReportImpact({ reports, userUuid, onSelectReport }: ReportImpactProps) {
  // Find all reports created or confirmed by this user
  // (the user is considered the owner if they are the first in the confirmedUsers list,
  // but let's include all reports where they contributed, prioritizing created ones)
  const userReports = reports.filter(r => r.confirmedUsers && r.confirmedUsers.includes(userUuid));

  const [currentIndex, setCurrentIndex] = useState(0);

  if (userReports.length === 0) {
    return null;
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % userReports.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + userReports.length) % userReports.length);
  };

  const activeReport = userReports[currentIndex];
  const isCreator = activeReport.confirmedUsers && activeReport.confirmedUsers[0] === userUuid;

  const dateStr = activeReport.timestamp?.seconds 
    ? new Date(activeReport.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'Recent';

  const categoryInfo = CATEGORY_META[activeReport.category] || CATEGORY_META['Other'];

  // Status mapping text
  let statusText = '';
  if (activeReport.status === 'Resolved') {
    statusText = `Resolved by ${activeReport.responsible_department}`;
  } else if (activeReport.status === 'Under Review') {
    statusText = `Under Review by ${activeReport.responsible_department}`;
  } else {
    statusText = `Reported & Dispatched to ${activeReport.responsible_department}`;
  }

  return (
    <div 
      id="user-report-impact-card"
      onClick={() => onSelectReport(activeReport.id)}
      className="group glass-card border border-violet-500/20 relative overflow-hidden bg-[#0a0f1d]/90 rounded-2xl p-4.5 mb-4 shadow-xl hover:shadow-violet-500/5 transition duration-300 cursor-pointer select-none"
    >
      {/* Background Subtle Glows */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
            <Award size={14} className="text-violet-400 animate-pulse" />
          </div>
          <div>
            <span className="text-[9px] text-violet-400 uppercase font-black tracking-widest block leading-none">Your Feedback Loop</span>
            <h4 className="text-[12px] font-black text-white mt-0.5 leading-none">Your Report Impact</h4>
          </div>
        </div>

        {/* Carousel pagination */}
        {userReports.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
            <button 
              id="prev-impact-report-btn"
              type="button"
              onClick={handlePrev}
              className="text-slate-400 hover:text-white transition p-0.5 rounded hover:bg-white/5"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[9px] text-slate-300 font-bold font-mono">
              {currentIndex + 1}/{userReports.length}
            </span>
            <button 
              id="next-impact-report-btn"
              type="button"
              onClick={handleNext}
              className="text-slate-400 hover:text-white transition p-0.5 rounded hover:bg-white/5"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Card Body - Content Stack with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeReport.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {/* List bullets containing status and impact info */}
          <div className="space-y-2 text-[11px] leading-relaxed">
            
            {/* Impact / Hotspot Bullet */}
            <div className="flex items-start gap-2">
              <span className="text-violet-400 font-bold shrink-0 mt-0.5">✦</span>
              <p className="text-slate-200 font-medium">
                {isCreator ? 'Your' : 'Your backed'}{' '}
                <span className="font-extrabold text-white">{activeReport.category.toLowerCase()}</span>{' '}
                report (<span className="text-cyan-300 font-bold">{dateStr}</span>) {categoryInfo.impactText}.
              </p>
            </div>

            {/* Status Bullet */}
            <div className="flex items-start gap-2">
              <span className="text-violet-400 font-bold shrink-0 mt-0.5">✦</span>
              <p className="text-slate-200 font-medium">
                Status:{' '}
                <span className={`font-extrabold ${
                  activeReport.status === 'Resolved' ? 'text-emerald-400' :
                  activeReport.status === 'Under Review' ? 'text-cyan-400' :
                  'text-rose-400'
                }`}>
                  {statusText}
                </span>
              </p>
            </div>

            {/* Resolution Time Bullet */}
            <div className="flex items-start gap-2">
              <span className="text-violet-400 font-bold shrink-0 mt-0.5">✦</span>
              <p className="text-slate-300 font-medium">
                Avg. resolution time for this category:{' '}
                <span className="font-extrabold text-white">{categoryInfo.avgTime}</span>
              </p>
            </div>

          </div>

          {/* Action indicator link */}
          <div className="pt-1 flex items-center justify-between text-[9px] text-slate-400 group-hover:text-cyan-400 transition-colors">
            <span className="flex items-center gap-1">
              <MapPin size={10} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
              Click card to pinpoint on interactive map
            </span>
            <ChevronRight size={10} className="transform group-hover:translate-x-1 transition-transform" />
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
