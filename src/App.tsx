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
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleStaffLogin = () => {
    if (pin === '1234') {
      onEnter('staff');
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 600);
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

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#3A4456', marginBottom: 7, letterSpacing: '0.01em' }}>Access PIN (hint: 1234)</label>
          <div className={pinError ? 'animate-shake' : ''} style={{ display: 'flex', gap: 9, marginBottom: 18 }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  flex: 1, height: 50, borderRadius: 11,
                  border: `${i === pin.length - 1 ? '2px solid #244BD6' : '1px solid #E3E7EF'}`,
                  background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'IBM Plex Mono'", fontSize: 20, fontWeight: 600,
                  boxShadow: i === pin.length - 1 ? '0 0 0 4px rgba(36,75,214,.12)' : 'none'
                }}
              >
                {pin[i] ? '●' : ''}
              </div>
            ))}
          </div>

          {/* Number pad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map(k => (
              <button
                key={k}
                onClick={() => {
                  if (k === '⌫') setPin(p => p.slice(0, -1));
                  else if (k === '✓') handleStaffLogin();
                  else if (pin.length < 4) setPin(p => p + k);
                }}
                style={{
                  height: 44, borderRadius: 10,
                  border: '1px solid #E3E7EF',
                  background: k === '✓' ? '#0F1A3D' : '#fff',
                  color: k === '✓' ? '#fff' : '#131A2A',
                  fontFamily: "'IBM Plex Mono'", fontWeight: 600, fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            onClick={handleStaffLogin}
            style={{ width: '100%', background: '#0F1A3D', color: '#fff', border: 'none', borderRadius: 11, padding: 14, fontFamily: "'IBM Plex Sans'", fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            onMouseOver={e => (e.currentTarget.style.background = '#1B2A57')}
            onMouseOut={e => (e.currentTarget.style.background = '#0F1A3D')}
          >
            Sign in to Dispatch Board
          </button>
        </div>
      </div>
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
            <aside style={{ width: 360, flexShrink: 0, borderRight: '1px solid #E3E7EF', background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }} className="hidden lg:flex">
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #EEF1F6' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <h2 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, margin: 0 }}>District Incidents</h2>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: '#8A93A5' }}>{reports.length} live</span>
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
                    <button onClick={() => setReportModalOpen(true)} style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#244BD6', background: 'none', border: 'none', cursor: 'pointer' }}>File a report →</button>
                  </div>
                ) : (
                  <>
                    {userUuid && (
                      <ReportImpact
                        reports={reports}
                        userUuid={userUuid}
                        onSelectReport={(id) => { setFocusedReportId(id); setSelectedReportId(null); }}
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
                          onClick={() => { setSelectedReportId(report.id); setFocusedReportId(report.id); }}
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
            </aside>

            {/* Center: map */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <MapContainer
                mode="view"
                reports={reports}
                center={mapFocusedReport?.location ? [mapFocusedReport.location.lat, mapFocusedReport.location.lng] : [37.7749, -122.4194]}
                selectedReportId={focusedReportId || selectedReportId}
                onSelectReport={(id) => { setSelectedReportId(id); setFocusedReportId(id); }}
              />
              {/* Floating report button on mobile */}
              <button
                onClick={() => setReportModalOpen(true)}
                className="lg:hidden"
                style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 500, width: 52, height: 52, borderRadius: '50%', background: '#244BD6', color: '#fff', border: 'none', fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(36,75,214,.7)' }}
              >
                +
              </button>
            </div>

            {/* Right: detail panel */}
            <AnimatePresence>
              {selectedReport && (
                <motion.aside
                  initial={{ x: 400, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 400, opacity: 0 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                  style={{ width: 400, flexShrink: 0, borderLeft: '1px solid #E3E7EF', background: '#fff', overflowY: 'auto', minHeight: 0, position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 50, boxShadow: '-20px 0 60px -20px rgba(0,0,0,.15)' }}
                  className="lg:relative lg:shadow-none"
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
                  />
                </div>
              </div>
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
