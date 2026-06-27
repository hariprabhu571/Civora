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
      style={{ background: 'linear-gradient(135deg, rgba(124,92,252,.06), rgba(34,184,207,.06))', border: '1px solid rgba(124,92,252,.2)', borderRadius: 13, padding: '14px 14px', marginBottom: 14, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(124,92,252,.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(124,92,252,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={13} style={{ color: '#7C5CFC' }} />
          </div>
          <div>
            <span style={{ fontSize: 9, color: '#6A4FD0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', display: 'block', lineHeight: 1 }}>Your Feedback Loop</span>
            <h4 style={{ fontSize: 12, fontFamily: "'Space Grotesk'", fontWeight: 700, color: '#131A2A', margin: '2px 0 0', lineHeight: 1 }}>Your Report Impact</h4>
          </div>
        </div>

        {/* Carousel pagination */}
        {userReports.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F4F8', padding: '4px 8px', borderRadius: 8, border: '1px solid #E3E7EF' }}>
            <button 
              id="prev-impact-report-btn"
              type="button"
              onClick={handlePrev}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A7488', display: 'flex', padding: 2 }}
            >
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: 9, color: '#6A7488', fontWeight: 700, fontFamily: "'IBM Plex Mono'" }}>
              {currentIndex + 1}/{userReports.length}
            </span>
            <button 
              id="next-impact-report-btn"
              type="button"
              onClick={handleNext}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6A7488', display: 'flex', padding: 2 }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Card Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeReport.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, lineHeight: 1.5 }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#7C5CFC', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✦</span>
              <p style={{ color: '#4A5468', margin: 0 }}>
                {isCreator ? 'Your' : 'Your backed'}{' '}
                <strong style={{ color: '#131A2A' }}>{activeReport.category.toLowerCase()}</strong>{' '}
                report (<span style={{ color: '#244BD6', fontWeight: 600 }}>{dateStr}</span>) {categoryInfo.impactText}.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#7C5CFC', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✦</span>
              <p style={{ color: '#4A5468', margin: 0 }}>
                Status:{' '}
                <span style={{ fontWeight: 700, color: activeReport.status === 'Resolved' ? '#0F7A45' : activeReport.status === 'Under Review' ? '#9A6B00' : '#C2333A' }}>
                  {statusText}
                </span>
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#7C5CFC', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✦</span>
              <p style={{ color: '#4A5468', margin: 0 }}>
                Avg. resolution time:{' '}
                <strong style={{ color: '#131A2A' }}>{categoryInfo.avgTime}</strong>
              </p>
            </div>

          </div>

          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, color: '#9AA4B5' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={10} /> Click to pinpoint on map
            </span>
            <ChevronRight size={10} />
          </div>

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
