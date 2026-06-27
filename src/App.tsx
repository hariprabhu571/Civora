import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import { safeLocalStorage } from './lib/storage';
import { CivicReport, ReportStatus } from './types';
import MapContainer from './components/MapContainer';
import ReportForm from './components/ReportForm';
import AdminPanel from './components/AdminPanel';
import WeeklyTrends from './components/WeeklyTrends';
import ReportImpact from './components/ReportImpact';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Compass, Loader2, List, X } from 'lucide-react';

/* ─── role types ─────────────────────────────────────────────── */
type UserRole = 'citizen' | 'staff' | null;
type ActiveTab = 'map' | 'trends' | 'admin';

/* ─── helpers ─────────────────────────────────────────────────── */
function statusMeta(s: string) {
  if (s === 'Resolved')    return { pillBg: '#E4F5EC', pillFg: '#0F7A45', pillDot: '#15A05A', pillLabel: 'Resolved',     badgeCls: 'status-resolved' };
  if (s === 'Under Review') return { pillBg: '#FBF0D9', pillFg: '#9A6B00', pillDot: '#E8A317', pillLabel: 'Under Review', badgeCls: 'status-review' };
  return                   { pillBg: '#FDECEC', pillFg: '#C2333A', pillDot: '#E5484D', pillLabel: 'Reported',    badgeCls: 'status-reported' };
}

function CivoraLogo({ size = 34 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 10,
        background: 'linear-gradient(135deg,#7C5CFC,#22B8CF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}
    >
      <div style={{ width: size * 0.44, height: size * 0.44, borderRadius: '50%', border: `${size * 0.074}px solid #fff`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: size * 0.12, height: size * 0.12, borderRadius: '50%', background: '#fff' }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   LOGIN / AUTH GATE
   ════════════════════════════════════════════════════════════════ */
function LoginScreen({ onEnter }: { onEnter: (role: UserRole) => void }) {
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === 'staff@civora.gov' && password === 'staff123') {
      try {
        sessionStorage.setItem('civora_admin_unlocked', 'true');
      } catch (err) {
        console.warn('Session storage write failed', err);
      }
      onEnter('staff');
    } else {
      setError('Invalid email ID or password. Please try again.');
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', overflow: 'hidden', background: '#EDF0F5' }}>
      
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden md:flex" style={{ flex: '0 0 52%', position: 'relative', overflow: 'hidden', background: '#0F1A3D', color: '#fff', padding: '56px 60px', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', width: 520, height: 520, right: -160, top: -160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,92,252,.55), transparent 60%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', width: 460, height: 460, left: -140, bottom: -180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,184,207,.40), transparent 62%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(circle at 30% 40%, #000, transparent 75%)' }} />

        {/* Brand */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13 }}>
          <CivoraLogo size={40} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>Civora</div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9FB0E6' }}>AI-Powered Civic Intelligence</div>
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ position: 'relative', maxWidth: 460 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', fontSize: 12, color: '#C7D2F2', marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22B8CF' }} /> Municipal Accountability System
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 44, lineHeight: 1.08, letterSpacing: '-0.025em', margin: '0 0 18px' }}>
            Report it. Track it.<br />See it resolved.
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: '#B7C2E4', margin: 0 }}>
            Snap a civic problem and our AI classifies it, drafts the formal complaint, and routes it to the right department — with photo-verified proof when it's fixed.
          </p>
          <div style={{ display: 'flex', gap: 36, marginTop: 40 }}>
            <div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 28 }}>12,480</div><div style={{ fontSize: 12, color: '#8FA0D0', letterSpacing: '0.04em' }}>Issues resolved</div></div>
            <div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 28 }}>38 hrs</div><div style={{ fontSize: 12, color: '#8FA0D0', letterSpacing: '0.04em' }}>Avg. resolution</div></div>
            <div><div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 28 }}>94%</div><div style={{ fontSize: 12, color: '#8FA0D0', letterSpacing: '0.04em' }}>AI accuracy</div></div>
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 12, color: '#7888BC' }}>Powered by Google Gemini · Leaflet · Civora Platform v2</div>
      </div>

      {/* Right auth panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 11, marginBottom: 26 }}>
            <CivoraLogo size={38} />
            <div>
              <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em', lineHeight: 1 }}>Civora</div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#8A93A5', marginTop: 2 }}>Civic Intelligence</div>
            </div>
          </div>

          <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Welcome to Civora</h2>
          <p style={{ fontSize: 14, color: '#5A6478', margin: '0 0 24px', lineHeight: 1.55 }}>Report a civic issue, track its progress, and watch it get resolved — no account required.</p>

          <button
            onClick={() => onEnter('citizen')}
            style={{ width: '100%', background: '#244BD6', color: '#fff', border: 'none', borderRadius: 11, padding: 15, fontFamily: "'IBM Plex Sans'", fontWeight: 600, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 10px 24px -10px rgba(36,75,214,.65)' }}
            onMouseOver={e => (e.currentTarget.style.background = '#1B3AA8')}
            onMouseOut={e => (e.currentTarget.style.background = '#244BD6')}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#A78BFA,#67E8F9)' }} />
            Continue as a citizen
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9AA4B5', margin: '12px 0 0' }}>Browse the public map or file a report in seconds.</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '26px 0', color: '#9AA4B5', fontSize: 11, letterSpacing: '0.08em' }}>
            <div style={{ flex: 1, height: 1, background: '#E3E7EF' }} />STAFF ACCESS<div style={{ flex: 1, height: 1, background: '#E3E7EF' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: '#C2333A', background: '#FDECEC', padding: '3px 8px', borderRadius: 6 }}>RESTRICTED</span>
            <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 15 }}>Municipal staff sign-in</span>
          </div>
          <p style={{ fontSize: 13, color: '#8A93A5', margin: '0 0 18px' }}>Access the Dispatch Command Panel and resolution tools.</p>

          <button
            onClick={() => setIsStaffModalOpen(true)}
            style={{ width: '100%', background: '#0F1A3D', color: '#fff', border: 'none', borderRadius: 11, padding: 15, fontFamily: "'IBM Plex Sans'", fontWeight: 600, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}
            onMouseOver={e => (e.currentTarget.style.background = '#1B2A57')}
            onMouseOut={e => (e.currentTarget.style.background = '#0F1A3D')}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C2333A' }} />
            Sign in as municipal staff
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9AA4B5', margin: '12px 0 0' }}>Verify credentials with email ID and password.</p>
        </div>
      </div>

      {/* Staff Auth Dialog Box */}
      <AnimatePresence>
        {isStaffModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,26,61,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px -30px rgba(0,0,0,.5)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #EEF1F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔒</span>
                  <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18, margin: 0 }}>Staff Security Login</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStaffModalOpen(false);
                    setError('');
                    setEmail('');
                    setPassword('');
                  }}
                  style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E3E7EF', background: '#fff', color: '#8A93A5', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleStaffLogin} style={{ padding: 24 }}>
                <p style={{ fontSize: 13, color: '#5A6478', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Please verify your credentials to access the restricted municipal dispatcher panel.
                </p>

                {error && (
                  <div style={{ background: '#FDECEC', border: '1px solid #F8C6C8', color: '#C2333A', padding: '10px 14px', borderRadius: 9, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#3A4456', marginBottom: 7, letterSpacing: '0.01em' }}>Mail ID / Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8A93A5', fontSize: 16 }}>✉️</span>
                    <input
                      type="email"
                      required
                      placeholder="e.g. staff@civora.gov"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: '100%', height: 46, borderRadius: 11, border: '1px solid #E3E7EF', paddingLeft: 40, paddingRight: 14, fontSize: 14, color: '#131A2A', background: '#fff', outline: 'none' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#244BD6'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#E3E7EF'}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#3A4456', marginBottom: 7, letterSpacing: '0.01em' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8A93A5', fontSize: 16 }}>🔑</span>
                    <input
                      type="password"
                      required
                      placeholder="Enter security password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', height: 46, borderRadius: 11, border: '1px solid #E3E7EF', paddingLeft: 40, paddingRight: 14, fontSize: 14, color: '#131A2A', background: '#fff', outline: 'none' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#244BD6'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#E3E7EF'}
                    />
                  </div>
                </div>

                <div style={{ background: '#F7F9FC', borderRadius: 9, padding: '10px 14px', fontSize: 11.5, color: '#6A7488', border: '1px solid #EEF1F6', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, color: '#3A4456' }}>Credential Hint:</span>
                  <span>Mail ID: <strong style={{ color: '#244BD6' }}>staff@civora.gov</strong></span>
                  <span>Password: <strong style={{ color: '#244BD6' }}>staff123</strong></span>
                </div>

                <button
                  type="submit"
                  style={{ width: '100%', background: '#0F1A3D', color: '#fff', border: 'none', borderRadius: 11, padding: 14, fontFamily: "'IBM Plex Sans'", fontWeight: 600, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseOver={e => (e.currentTarget.style.background = '#1B2A57')}
                  onMouseOut={e => (e.currentTarget.style.background = '#0F1A3D')}
                >
                  🔒 Sign In to Dispatch Board
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [userRole, setUserRole]   = useState<UserRole>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [reports, setReports]     = useState<CivicReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [focusedReportId,  setFocusedReportId]  = useState<string | null>(null);
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType]       = useState<'success' | 'info'>('success');
  const previousStatusesRef = useRef<{ [id: string]: ReportStatus }>({});

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(true);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport size (< 768px for 'md')
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize userUuid
  useEffect(() => {
    let uid = safeLocalStorage.getItem('civic_user_uuid');
    if (!uid) {
      uid = Math.random().toString(36).substring(2, 12);
      safeLocalStorage.setItem('civic_user_uuid', uid);
    }
    setUserUuid(uid);
  }, []);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Firestore realtime listener
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: CivicReport[] = [];
      snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() } as CivicReport));

      const isFirstLoad = Object.keys(previousStatusesRef.current).length === 0 && docs.length > 0;
      const currentUserId = userUuid || safeLocalStorage.getItem('civic_user_uuid');
      if (!isFirstLoad) {
        docs.forEach((newReport) => {
          const oldStatus = previousStatusesRef.current[newReport.id];
          if (oldStatus && oldStatus !== newReport.status) {
            const isUserReport = currentUserId && newReport.confirmedUsers?.includes(currentUserId);
            let message = '';
            let type: 'success' | 'info' = 'info';
            if (newReport.status === 'Under Review') {
              message = isUserReport ? `Your ${newReport.category} report is now Under Review!` : `A ${newReport.category} report is now Under Review.`;
              type = 'info';
            } else if (newReport.status === 'Resolved') {
              message = isUserReport ? `Your ${newReport.category} report has been Resolved! ✅` : `A ${newReport.category} report has been resolved. ✅`;
              type = 'success';
            }
            if (message) showToast(message, type);
          }
        });
      }
      const newStatuses: { [id: string]: ReportStatus } = {};
      docs.forEach(r => { newStatuses[r.id] = r.status; });
      previousStatusesRef.current = newStatuses;
      setReports(docs);
      setLoading(false);
    }, (err) => {
      console.error('Snapshot read fail:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userUuid]);

  const handleReportSuccess = (reportId: string, isConfirmation: boolean) => {
    if (isConfirmation) showToast('Support vote registered for the existing complaint!', 'success');
    else showToast('Formal grievance filed and dispatched to the service board.', 'success');
    setSelectedReportId(reportId);
    setFocusedReportId(reportId);
    setReportModalOpen(false);
    setActiveTab('map');
  };

  const handleSupportReport = async (report: CivicReport) => {
    try {
      const uid = safeLocalStorage.getItem('civic_user_uuid') || Math.random().toString(36).substring(2, 12);
      safeLocalStorage.setItem('civic_user_uuid', uid);
      if (report.confirmedUsers?.includes(uid)) {
        showToast('You have already backed this ticket!', 'info');
        return;
      }
      const docRef = doc(db, 'reports', report.id);
      await updateDoc(docRef, { confirmations: increment(1), confirmedUsers: arrayUnion(uid) });
      showToast('Support signature registered.', 'success');
    } catch (err: any) {
      showToast('Support submission failed: ' + err.message, 'info');
    }
  };

  const renderSidebarContent = (isMobile = false) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #EEF1F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, margin: 0 }}>District Incidents</h2>
              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: '#8A93A5' }}>{reports.length} live</span>
            </div>
            {isMobile && (
              <button
                onClick={() => setMobileSidebarOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #E3E7EF',
                  background: '#fff',
                  color: '#8A93A5',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 7 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: '#F2F4F8', borderRadius: 9, padding: '8px 11px', fontSize: 12.5, color: '#8A93A5' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C3CCDA' }} /> Search incidents…
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {loading ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #EAF0FF', borderTopColor: '#244BD6', animation: 'cvSpin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 12, color: '#9AA4B5', fontWeight: 600, letterSpacing: '0.04em' }}>Loading reports…</p>
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', background: '#F7F9FC', borderRadius: 13, border: '1px dashed #CBD3E1', marginTop: 8 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🗺️</div>
              <p style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>All clear!</p>
              <p style={{ fontSize: 12, color: '#8A93A5', lineHeight: 1.5 }}>Be the first to report a civic issue in your neighborhood.</p>
              <button onClick={() => { setReportModalOpen(true); if (isMobile) setMobileSidebarOpen(false); }} style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#244BD6', background: 'none', border: 'none', cursor: 'pointer' }}>File a report →</button>
            </div>
          ) : (
            <>
              {userUuid && (
                <ReportImpact
                  reports={reports}
                  userUuid={userUuid}
                  onSelectReport={(id) => { setFocusedReportId(id); setSelectedReportId(null); if (isMobile) setMobileSidebarOpen(false); }}
                />
              )}
              {reports.map(report => {
                const sm = statusMeta(report.status);
                const dateStr = report.timestamp?.seconds
                  ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : 'Just now';
                const isSelected = selectedReportId === report.id;
                return (
                  <div
                    id={`drawer-item-${report.id}`}
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setFocusedReportId(report.id);
                      if (isMobile) setMobileSidebarOpen(false);
                    }}
                    className={`incident-card${isSelected ? ' incident-card-selected' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: 9, background: '#EEF1F6', overflow: 'hidden', position: 'relative' }}>
                      {report.photoUrl
                        ? <img src={report.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#9AA4B5', fontWeight: 700, textTransform: 'uppercase' }}>No pic</div>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 14 }}>{report.category}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: '#9AA4B5' }}>{dateStr}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6A7488', fontStyle: 'italic', lineHeight: 1.4, margin: '3px 0 7px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        "{report.userNotes || 'No notes added.'}"
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: sm.pillBg, color: sm.pillFg }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.pillDot }} />{sm.pillLabel}
                        </span>
                        <span className="dept-tag">{report.responsible_department?.split(' ')[0]?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  const selectedReport = reports.find(r => r.id === selectedReportId);
  const mapFocusedReport = reports.find(r => r.id === (focusedReportId || selectedReportId));

  /* ── LOGIN SCREEN ──────────────────────────────────────────── */
  if (!userRole) {
    return (
      <>
        <LoginScreen onEnter={(role) => { setUserRole(role); setActiveTab(role === 'staff' ? 'admin' : 'map'); }} />
        {/* Toast */}
        <AnimatePresence>
          {toastMessage && <ToastBar message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />}
        </AnimatePresence>
      </>
    );
  }

  /* ── APP SHELL ──────────────────────────────────────────────── */
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#EDF0F5', fontFamily: "'IBM Plex Sans', sans-serif", color: '#131A2A' }}>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && <ToastBar message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="app-header" style={{ boxShadow: '0 1px 0 #E3E7EF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setActiveTab('map'); setSelectedReportId(null); setFocusedReportId(null); }}>
          <CivoraLogo size={34} />
          <div>
            <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', lineHeight: 1 }}>Civora</div>
            <div className="hidden sm:block" style={{ fontSize: 9.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#8A93A5', marginTop: 2 }}>Civic Intelligence</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden sm:flex" style={{ alignItems: 'center', gap: 4, background: '#F2F4F8', padding: 4, borderRadius: 12 }}>
          {(['map', 'trends'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'nav-tab nav-tab-active' : 'nav-tab nav-tab-inactive'}
            >
              {tab === 'map' ? 'Map Feed' : 'Civic Trends'}
            </button>
          ))}
          {userRole === 'staff' && (
            <button onClick={() => setActiveTab('admin')}
              className={activeTab === 'admin' ? 'nav-tab nav-tab-active' : 'nav-tab nav-tab-inactive'}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              Dispatch Board
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: '#C2333A', background: '#FDECEC', padding: '2px 6px', borderRadius: 5 }}>STAFF</span>
            </button>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setReportModalOpen(true)}
            className="btn-aurora"
            style={{ borderRadius: 10, padding: '10px 17px', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span style={{ fontSize: 17, lineHeight: 0, marginTop: -1 }}>+</span>
            <span className="hidden md:inline">Report Incident</span>
          </button>
          {/* Avatar / sign out */}
          <div
            onClick={() => setUserRole(null)}
            title="Sign out"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: userRole === 'staff' ? '#0F1A3D' : 'linear-gradient(135deg,#7C5CFC,#22B8CF)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 13, cursor: 'pointer'
            }}
          >
            {userRole === 'staff' ? 'RM' : 'C'}
          </div>
        </div>
      </header>

      {/* Mobile nav strip */}
      <div className="flex sm:hidden" style={{ flexShrink: 0, gap: 6, padding: '8px 12px', background: '#fff', borderBottom: '1px solid #E3E7EF', overflowX: 'auto' }}>
        {(['map', 'trends'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'nav-tab nav-tab-active' : 'nav-tab nav-tab-inactive'}
            style={{ flex: 1, whiteSpace: 'nowrap', fontSize: 13, padding: '10px 12px' }}
          >
            {tab === 'map' ? 'Map Feed' : 'Civic Trends'}
          </button>
        ))}
        {userRole === 'staff' && (
          <button onClick={() => setActiveTab('admin')}
            className={activeTab === 'admin' ? 'nav-tab nav-tab-active' : 'nav-tab nav-tab-inactive'}
            style={{ flex: 1, whiteSpace: 'nowrap', fontSize: 13, padding: '10px 12px' }}
          >
            Dispatch
          </button>
        )}
      </div>

      {/* Main content */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── MAP FEED ── */}
        {activeTab === 'map' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Left: incident list */}
            <aside style={{ width: 360, flexShrink: 0, borderRight: '1px solid #E3E7EF', background: '#fff', minHeight: 0 }} className="hidden md:flex flex-col">
              {renderSidebarContent(false)}
            </aside>

            {/* Mobile collapsible sidebar drawer */}
            <AnimatePresence>
              {mobileSidebarOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setMobileSidebarOpen(false)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: 'rgba(15, 26, 61, 0.4)',
                      zIndex: 510,
                      backdropFilter: 'blur(2px)'
                    }}
                    className="md:hidden"
                  />
                  <motion.aside
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                    style={{
                      position: 'fixed',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 310,
                      zIndex: 520,
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '20px 0 60px -20px rgba(15, 26, 61, 0.25)',
                    }}
                    className="md:hidden"
                  >
                    {renderSidebarContent(true)}
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            {/* Center: map */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <MapContainer
                mode="view"
                reports={reports}
                center={mapFocusedReport?.location ? [mapFocusedReport.location.lat, mapFocusedReport.location.lng] : (userLocation || [37.7749, -122.4194])}
                selectedReportId={focusedReportId || selectedReportId}
                onSelectReport={(id) => { setSelectedReportId(id); setFocusedReportId(id); }}
              />
              {/* Floating list toggle on mobile */}
              {isMobile && (
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="md:hidden"
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    zIndex: 500,
                    padding: '12px 18px',
                    borderRadius: 999,
                    background: '#fff',
                    color: '#0F1A3D',
                    border: '1px solid #E3E7EF',
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    boxShadow: '0 8px 24px -6px rgba(15,26,61,0.12)',
                    cursor: 'pointer'
                  }}
                >
                  <List size={16} />
                  <span>Incidents ({reports.length})</span>
                </button>
              )}
              {/* Floating report button on mobile */}
              {isMobile && (
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="md:hidden"
                  style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 500, width: 52, height: 52, borderRadius: '50%', background: '#244BD6', color: '#fff', border: 'none', fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(36,75,214,.7)' }}
                >
                  +
                </button>
              )}
            </div>

            {/* Right: detail panel */}
            <AnimatePresence>
              {selectedReport && (
                <motion.aside
                  initial={{ x: 400, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 400, opacity: 0 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                  style={{ width: 400, flexShrink: 0, minHeight: 0 }}
                  className="absolute md:relative right-0 top-0 bottom-0 z-50 shadow-[-20px_0_60px_-20px_rgba(0,0,0,0.15)] md:shadow-none md:border-l border-[#E3E7EF] bg-white overflow-y-auto"
                >
                  <DetailPanel
                    report={selectedReport}
                    onClose={() => { setSelectedReportId(null); setFocusedReportId(null); }}
                    onSupport={() => handleSupportReport(selectedReport)}
                    showToast={showToast}
                  />
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── CIVIC TRENDS ── */}
        {activeTab === 'trends' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#EDF0F5' }}>
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: '30px 32px 60px' }}>
              <WeeklyTrends />
            </div>
          </div>
        )}

        {/* ── DISPATCH BOARD ── */}
        {activeTab === 'admin' && userRole === 'staff' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#EDF0F5' }}>
            <AdminPanel />
          </div>
        )}

        {activeTab === 'admin' && userRole !== 'staff' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDF0F5' }}>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
              <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 22, margin: '0 0 8px' }}>Access Restricted</h2>
              <p style={{ fontSize: 14, color: '#6A7488' }}>This area is for municipal staff only.</p>
            </div>
          </div>
        )}

      </main>

      {/* Report Incident Modal */}
      <AnimatePresence>
        {reportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,26,61,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{ width: '100%', maxWidth: 920, maxHeight: '92vh', background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px -30px rgba(0,0,0,.5)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #EEF1F6' }}>
                <div>
                  <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 19, margin: 0 }}>Report an Incident</h2>
                  <div style={{ fontSize: 12.5, color: '#8A93A5', marginTop: 2 }}>AI will classify, draft, and route your report.</div>
                </div>
                <button
                  onClick={() => setReportModalOpen(false)}
                  style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E3E7EF', background: '#fff', color: '#8A93A5', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '16px 24px 24px' }}>
                  <ReportForm
                    onBackToMap={() => setReportModalOpen(false)}
                    onSuccess={handleReportSuccess}
                    defaultCoordinates={userLocation ? { lat: userLocation[0], lng: userLocation[1] } : null}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Setup Modal */}
      <AnimatePresence>
        {locationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(15, 26, 61, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: 440,
                background: '#fff',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 30px 80px -20px rgba(0,0,0,0.4)',
                border: '1px solid #E3E7EF',
                padding: '32px 28px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Pulsing Visual Container */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(36, 75, 214, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: -6,
                    borderRadius: '50%',
                    background: 'rgba(36, 75, 214, 0.03)',
                    animation: 'cvPulse 3s ease-out infinite',
                  }}
                />
                <Compass size={32} className="text-[#244BD6]" style={{ strokeWidth: 1.5 }} />
              </div>

              <h2
                style={{
                  fontFamily: "'Space Grotesk'",
                  fontWeight: 700,
                  fontSize: 22,
                  color: '#0F1A3D',
                  margin: '0 0 10px',
                  letterSpacing: '-0.02em',
                }}
              >
                Center Map Around You?
              </h2>
              <p
                style={{
                  fontSize: 13.5,
                  color: '#5A6478',
                  lineHeight: 1.6,
                  margin: '0 0 24px',
                }}
              >
                Civora works best when we center the map around your current location so you can explore and report incidents in your immediate neighborhood.
              </p>

              {requestingLocation ? (
                <div
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px 0',
                    gap: 12,
                  }}
                >
                  <Loader2 className="animate-spin text-[#244BD6]" size={28} />
                  <span style={{ fontSize: 13, color: '#8A93A5', fontWeight: 500 }}>
                    Requesting browser permission...
                  </span>
                </div>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={async () => {
                      if (!navigator.geolocation) {
                        showToast('Geolocation is not supported by your browser.', 'info');
                        setUserLocation([37.7749, -122.4194]);
                        setLocationModalOpen(false);
                        return;
                      }
                      setRequestingLocation(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                          setRequestingLocation(false);
                          setLocationModalOpen(false);
                          showToast('Location configured successfully!', 'success');
                        },
                        (err) => {
                          console.warn('Geolocation capture failed:', err);
                          setUserLocation([37.7749, -122.4194]);
                          setRequestingLocation(false);
                          setLocationModalOpen(false);
                          showToast('Using default San Francisco neighborhood.', 'info');
                        },
                        { enableHighAccuracy: true, timeout: 8000 }
                      );
                    }}
                    style={{
                      width: '100%',
                      background: '#244BD6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      padding: '14px 18px',
                      fontFamily: "'IBM Plex Sans'",
                      fontWeight: 600,
                      fontSize: 14.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 10px 24px -10px rgba(36, 75, 214, 0.5)',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#1E3FA5')}
                    onMouseOut={(e) => (e.currentTarget.style.background = '#244BD6')}
                  >
                    <Navigation size={16} fill="currentColor" />
                    Share My Location
                  </button>

                  <button
                    onClick={() => {
                      setUserLocation([37.7749, -122.4194]);
                      setLocationModalOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#8A93A5',
                      fontFamily: "'IBM Plex Sans'",
                      fontWeight: 500,
                      fontSize: 13.5,
                      cursor: 'pointer',
                      marginTop: 10,
                      textDecoration: 'underline',
                      display: 'inline-block',
                      width: 'fit-content',
                      alignSelf: 'center',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = '#5A6478')}
                    onMouseOut={(e) => (e.currentTarget.style.color = '#8A93A5')}
                  >
                    Not interested to share location
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DETAIL PANEL — right sidebar for selected report
   ════════════════════════════════════════════════════════════════ */
function DetailPanel({ report, onClose, onSupport, showToast }: {
  report: CivicReport;
  onClose: () => void;
  onSupport: () => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}) {
  const sm = statusMeta(report.status);

  return (
    <>
      {/* Sticky back header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', padding: '11px 16px', background: 'rgba(255,255,255,.96)', borderBottom: '1px solid #EEF1F6' }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: '#F2F4F8', color: '#3A4456', fontFamily: "'IBM Plex Sans'", fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 9, cursor: 'pointer' }}>
          ‹ Back to map
        </button>
      </div>

      {/* Photo */}
      <div style={{ height: 152, background: '#EEF1F6', position: 'relative' }}>
        {report.photoUrl && <img src={report.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />}
        <div style={{ position: 'absolute', top: 14, left: 16, fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: '0.08em', color: 'rgba(19,26,42,.55)', background: 'rgba(255,255,255,.7)', padding: '4px 8px', borderRadius: 6 }}>
          {report.category?.toUpperCase()} · {report.id?.slice(0, 8)}
        </div>
        <div style={{ position: 'absolute', bottom: 14, right: 16, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: sm.pillBg, color: sm.pillFg }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.pillDot }} />{sm.pillLabel}
        </div>
      </div>

      <div style={{ padding: '18px 20px' }}>
        <div className="section-label">Public Incident File</div>
        <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 21, margin: '4px 0 2px', letterSpacing: '-0.01em' }}>{report.category}</h2>
        <div style={{ fontSize: 12.5, color: '#8A93A5', fontFamily: "'IBM Plex Mono'" }}>
          {report.id?.slice(0, 10)} · {report.timestamp?.seconds ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now'}
        </div>

        {/* Status / Severity grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '16px 0' }}>
          <div style={{ border: '1px solid #EEF1F6', borderRadius: 11, padding: 12 }}>
            <div className="section-label">Status</div>
            <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 15, marginTop: 4, color: sm.pillFg }}>{sm.pillLabel}</div>
          </div>
          <div style={{ border: '1px solid #EEF1F6', borderRadius: 11, padding: 12 }}>
            <div className="section-label">Severity</div>
            <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 15, marginTop: 4, color: report.severity === 'High' ? '#C2333A' : report.severity === 'Medium' ? '#9A6B00' : '#5A6478' }}>{report.severity}</div>
          </div>
        </div>

        {/* Department */}
        <div className="section-label">Assigned department</div>
        <div className="dept-badge" style={{ marginBottom: 18 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#244BD6' }} />
          {report.responsible_department}
        </div>

        {/* AI Severity Assessment */}
        {report.severityReasoning && (
          <div className="ai-accent-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#22B8CF)' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, color: '#6A4FD0' }}>AI Severity Assessment</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: '#4A5468', fontStyle: 'italic' }}>"{report.severityReasoning}"</div>
          </div>
        )}

        {/* Citizen notes */}
        <div className="section-label">Citizen notes</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3A4456', marginBottom: 18 }}>
          {report.userNotes || 'No notes added.'}
        </div>

        {/* AI Grievance Letter */}
        {report.formal_complaint_text && (
          <>
            <div className="section-label">AI-generated grievance letter</div>
            <div style={{ background: '#F7F9FC', border: '1px solid #EEF1F6', borderRadius: 11, padding: 14, fontFamily: "'IBM Plex Mono'", fontSize: 11.5, lineHeight: 1.7, color: '#4A5468', maxHeight: 150, overflowY: 'auto', marginBottom: 18 }}>
              {report.formal_complaint_text}
            </div>
          </>
        )}

        {/* Resolution auditor */}
        {report.status === 'Resolved' && (
          <div style={{ border: '1px solid #C9EAD6', borderRadius: 13, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#E4F5EC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, background: '#15A05A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>✓</span>
                <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 13.5, color: '#0F7A45' }}>Civora Resolution Auditor</span>
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, color: '#0F7A45', background: '#fff', padding: '3px 8px', borderRadius: 6 }}>Verified</span>
            </div>
            <div style={{ padding: '14px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0F7A45', marginBottom: 8 }}>✅ Verified Fixed</span>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#4A5468' }}>Issue marked as resolved by municipal staff. Civic record updated.</div>
            </div>
          </div>
        )}

        {/* Citizen Feedback */}
        {report.status === 'Resolved' && (
          <CitizenFeedbackPanel report={report} showToast={showToast} />
        )}

        {/* Support */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F7F9FC', border: '1px solid #EEF1F6', borderRadius: 12, padding: '13px 15px', marginTop: 16 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 18 }}>{report.confirmations || 1}</div>
            <div style={{ fontSize: 11, color: '#8A93A5' }}>support votes</div>
          </div>
          <button
            onClick={onSupport}
            className="btn-primary"
            style={{ padding: '11px 16px', fontSize: 13 }}
          >
            ▲ Support &amp; Confirm
          </button>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */
function CitizenFeedbackPanel({ report, showToast }: { report: CivicReport; showToast: (msg: string, type?: 'success' | 'info') => void }) {
  if (report.citizenFeedback) {
    return (
      <div style={{ border: '1px solid #EEF1F6', borderRadius: 13, padding: 14, marginBottom: 16 }}>
        <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Your feedback</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 999, background: '#E4F5EC', color: '#0F7A45' }}>
            {report.citizenFeedback}
          </span>
          <span style={{ fontSize: 11, color: '#8A93A5' }}>Feedback recorded</span>
        </div>
        {report.citizenFeedback === 'No' && (
          <button
            onClick={async () => {
              try {
                const docRef = doc(db, 'reports', report.id);
                await updateDoc(docRef, { status: 'Reported', reopenedAt: serverTimestamp() });
                showToast('Issue reopened and returned to dispatch queue.', 'success');
              } catch (err: any) {
                showToast('Reopen failed: ' + err.message, 'info');
              }
            }}
            className="btn-danger"
            style={{ marginTop: 10, width: '100%', textAlign: 'center' }}
          >
            ⚠ Reopen Issue
          </button>
        )}
      </div>
    );
  }
  return (
    <div style={{ border: '1px solid #EEF1F6', borderRadius: 13, padding: 14, marginBottom: 16 }}>
      <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Was this issue actually fixed?</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['Yes', 'Partially', 'No'] as const).map(val => (
          <button
            key={val}
            onClick={async () => {
              try {
                const docRef = doc(db, 'reports', report.id);
                await updateDoc(docRef, { citizenFeedback: val });
                showToast(val === 'No' ? 'Feedback submitted. You can now reopen this issue.' : 'Thank you for verifying!', val === 'No' ? 'info' : 'success');
              } catch (err: any) {
                showToast('Feedback failed: ' + err.message, 'info');
              }
            }}
            style={{
              flex: 1, border: '1px solid #E3E7EF', background: '#fff', color: '#5A6478',
              fontWeight: 600, fontSize: 13, padding: 9, borderRadius: 9, cursor: 'pointer',
              fontFamily: "'IBM Plex Sans'"
            }}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
function ToastBar({ message, type, onClose }: { message: string; type: 'success' | 'info'; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      className={`toast-bar ${type === 'success' ? 'toast-success' : 'toast-info'}`}
      style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: type === 'success' ? '#E4F5EC' : '#EAF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
        {type === 'success' ? '✅' : 'ℹ️'}
      </div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#131A2A', lineHeight: 1.45 }}>{message}</div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8A93A5', padding: '4px 6px', borderRadius: 6, lineHeight: 1 }}>✕</button>
    </motion.div>
  );
}
