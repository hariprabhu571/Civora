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
import { 
  ShieldAlert, 
  MapPin, 
  PlusCircle, 
  Sparkles, 
  TrendingUp, 
  Lock, 
  Clock, 
  CheckCircle2, 
  MessageSquare,
  AlertOctagon,
  Users,
  ChevronRight,
  X,
  Smartphone,
  Calendar,
  FileWarning
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'report' | 'trends' | 'admin'>('map');
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [focusedReportId, setFocusedReportId] = useState<string | null>(null);
  const [userUuid, setUserUuid] = useState<string | null>(null);

  // Initialize and persist userUuid
  useEffect(() => {
    let uid = safeLocalStorage.getItem('civic_user_uuid');
    if (!uid) {
      uid = Math.random().toString(36).substring(2, 12);
      safeLocalStorage.setItem('civic_user_uuid', uid);
    }
    setUserUuid(uid);
  }, []);
  
  // Real time Toast alerts state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info'>('success');

  // Trigger local notification toaster
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const previousStatusesRef = useRef<{ [id: string]: ReportStatus }>({});

  // Setup real-time listener for ALL reports
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: CivicReport[] = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as CivicReport);
      });

      // Avoid showing status change toasts during the very first render/fetch
      const isFirstLoad = Object.keys(previousStatusesRef.current).length === 0 && docs.length > 0;
      const currentUserId = userUuid || safeLocalStorage.getItem('civic_user_uuid');

      if (!isFirstLoad) {
        // Find documents that changed status
        docs.forEach((newReport) => {
          const oldStatus = previousStatusesRef.current[newReport.id];
          if (oldStatus && oldStatus !== newReport.status) {
            // Check if this report was filed/supported by the current user
            const isUserReport = currentUserId && newReport.confirmedUsers && newReport.confirmedUsers.includes(currentUserId);
            
            let message = '';
            let type: 'success' | 'info' = 'info';

            if (newReport.status === 'Under Review') {
              message = isUserReport 
                ? `Your ${newReport.category} report has been marked Under Review!` 
                : `A citizen's ${newReport.category} report has been marked Under Review!`;
              type = 'info';
            } else if (newReport.status === 'Resolved') {
              message = isUserReport 
                ? `Your ${newReport.category} report has been successfully Resolved!` 
                : `A citizen's ${newReport.category} report has been successfully Resolved!`;
              type = 'success';
            } else if (newReport.status === 'Reported') {
              // Status went back to reported (unlikely but possible)
              message = isUserReport
                ? `Your ${newReport.category} report has been reset to Reported status.`
                : `A citizen's ${newReport.category} report status reset to Reported.`;
              type = 'info';
            }

            if (message) {
              showToast(message, type);
            }
          }
        });
      }

      // Update the previous statuses cache
      const newStatuses: { [id: string]: ReportStatus } = {};
      docs.forEach((report) => {
        newStatuses[report.id] = report.status;
      });
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
    if (isConfirmation) {
      showToast('Support vote successfully registered for existing complaint ticket!', 'success');
    } else {
      showToast('New formal grievance filed! Dispatched to the service board.', 'success');
    }
    setSelectedReportId(reportId);
    setFocusedReportId(reportId);
    setActiveTab('map');
  };

  // Confirm / add support vote on current active selected report detail drawer
  const handleSupportReport = async (report: CivicReport) => {
    try {
      const uid = safeLocalStorage.getItem('civic_user_uuid') || Math.random().toString(36).substring(2, 12);
      safeLocalStorage.setItem('civic_user_uuid', uid);

      if (report.confirmedUsers && report.confirmedUsers.includes(uid)) {
        showToast('You have already backed support on this ticket!', 'info');
        return;
      }

      const docRef = doc(db, 'reports', report.id);
      await updateDoc(docRef, {
        confirmations: increment(1),
        confirmedUsers: arrayUnion(uid)
      });

      showToast('Thank you for verifying! Support signature registered.', 'success');

    } catch (err: any) {
      console.error(err);
      showToast('Support submission failed: ' + err.message, 'info');
    }
  };

  const selectedReportDetails = reports.find(r => r.id === selectedReportId);
  const mapFocusedReportId = focusedReportId || selectedReportId;
  const mapFocusedReport = reports.find(r => r.id === mapFocusedReportId);

  return (
    <div className="bg-[#06080f] text-slate-100 min-h-screen flex flex-col font-sans select-none relative overflow-x-hidden antialiased">
      
      {/* Aurora Background */}
      <div className="aurora-bg">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
        <div className="aurora-orb aurora-orb-4" />
        <div className="aurora-grid" />
      </div>

      {/* Toast Alert bar */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            id="toast-notification"
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[90%] rounded-2xl shadow-2xl glass-heavy overflow-hidden ${toastType === 'success' ? 'border-l-2 border-l-emerald-400' : 'border-l-2 border-l-violet-400'}`}
          >
            <div className="px-5 py-4 flex items-center gap-3 text-xs font-semibold">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toastType === 'success' ? 'bg-emerald-500/15' : 'bg-violet-500/15'}`}>
                <Sparkles size={14} className={`${toastType === 'success' ? 'text-emerald-400' : 'text-violet-400'} animate-pulse`} />
              </div>
              <div className="flex-1 select-text">
                <span className="block text-slate-100">{toastMessage}</span>
              </div>
              <button id="close-toast" onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white transition p-1.5 hover:bg-white/10 rounded-lg cursor-pointer">
                <X size={15} />
              </button>
            </div>
            {/* Animated shrinking progress bar */}
            <div className="h-[2px] w-full bg-white/5">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 4.5, ease: 'linear' }}
                className={`h-full ${toastType === 'success' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-gradient-to-r from-violet-400 to-cyan-400'}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main navigation Header */}
      <header id="app-header" className="sticky top-0 glass-heavy z-[1000] px-4 md:px-8 py-4 shadow-2xl shadow-black/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div 
            id="brand-logo"
            onClick={() => { setActiveTab('map'); setSelectedReportId(null); setFocusedReportId(null); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 group-hover:scale-105 active:scale-95 transition-all">
              <ShieldAlert size={20} className="group-hover:rotate-6 transition animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-display font-black tracking-tight text-gradient-aurora flex items-center gap-1.5 leading-none">
                Civora
              </h1>
              <p className="text-[9px] text-violet-400 uppercase font-black tracking-widest mt-1">AI-Powered Civic Intelligence</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav id="top-nav" className="flex items-center gap-1 bg-white/[0.03] p-1.5 rounded-xl border border-white/5 shadow-inner backdrop-blur-sm">
            <button 
              id="nav-map-btn"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'map' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20 font-extrabold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <MapPin size={13} /> <span className="hidden sm:inline">Map Feed</span>
            </button>
            <button 
              id="nav-trends-btn"
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'trends' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20 font-extrabold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <TrendingUp size={13} /> <span className="hidden sm:inline">Civic Trends</span>
            </button>
            <button 
              id="nav-admin-btn"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'admin' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20 font-extrabold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Lock size={13} /> <span className="hidden sm:inline">Dispatch Board</span>
            </button>
          </nav>

          {/* Prompt CTA for citizens */}
          {activeTab !== 'report' && (
            <button 
              id="header-report-btn"
              onClick={() => { setActiveTab('report'); setSelectedReportId(null); setFocusedReportId(null); }}
              className="btn-aurora rounded-xl px-5 py-2.5 text-xs font-display font-bold tracking-wide flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle size={14} /> <span className="hidden md:inline">Report Incident</span><span className="md:hidden">Report</span>
            </button>
          )}

        </div>
      </header>

      {/* Main layout contents */}
      <main className="flex-1 flex flex-col relative z-[1]">
        <AnimatePresence mode="wait">
          
          {/* TAB: Interactive map with listings */}
          {activeTab === 'map' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col lg:flex-row relative h-[calc(100vh-73px)] overflow-hidden"
              id="map-tab-container"
            >
              {/* Left sidebar listing of real-time entries */}
              <div id="side-list-pane" className="w-full lg:w-96 glass-heavy shrink-0 flex flex-col h-1/2 lg:h-full z-[10] shadow-2xl border-r border-white/5">
                <div className="p-4 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[10px] uppercase font-black text-violet-400 tracking-widest">Live Feed</h2>
                      <h3 className="text-sm font-black text-white mt-1.5 flex items-center gap-2">
                        District Incidents
                        <span className="px-2.5 py-0.5 bg-gradient-to-r from-violet-500/15 to-cyan-500/15 border border-violet-500/20 text-violet-300 rounded-full text-[10px] font-black">{reports.length}</span>
                      </h3>
                    </div>
                    
                    {/* Floating reporter trigger on mobile list header */}
                    <button 
                      id="mobile-fom-trigger-btn"
                      onClick={() => setActiveTab('report')}
                      className="md:hidden flex items-center gap-1 btn-aurora text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold"
                    >
                      <PlusCircle size={12} /> File
                    </button>
                  </div>
                  {/* Gradient separator line */}
                  <div className="mt-3 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
                </div>

                {/* Listing content */}
                <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3.5 scrollbar-thin scrollbar-thumb-white/5">
                  {loading ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-bold space-y-5">
                      {/* Orbital loading animation */}
                      <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 shadow-lg shadow-violet-500/40" />
                        <div className="absolute inset-0 animate-orbit">
                          <div className="w-2 h-2 rounded-full bg-violet-400 shadow-md shadow-violet-500/50" />
                        </div>
                        <div className="absolute inset-0 animate-orbit" style={{ animationDelay: '1s', animationDuration: '2.5s' }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-md shadow-cyan-500/50" />
                        </div>
                        <div className="absolute inset-0 animate-orbit" style={{ animationDelay: '2s', animationDuration: '3.5s' }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-500/50" />
                        </div>
                      </div>
                      <p className="tracking-widest text-slate-500 uppercase text-[10px]">Synchronizing coordinates...</p>
                    </div>
                  ) : (
                    <>
                      {userUuid && (
                        <ReportImpact 
                          reports={reports} 
                          userUuid={userUuid} 
                          onSelectReport={(reportId) => {
                            setFocusedReportId(reportId);
                            setSelectedReportId(null);
                            
                            // Smooth scroll the map wrapper into view on mobile/tablet
                            setTimeout(() => {
                              const mapWrap = document.getElementById('central-map-wrap');
                              if (mapWrap) {
                                mapWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }, 80);

                            // Scroll to drawer-item elements if needed
                            const elem = document.getElementById(`drawer-item-${reportId}`);
                            if (elem) {
                              elem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                          }}
                        />
                      )}

                      {reports.length === 0 ? (
                        <div className="p-8 text-center glass-card rounded-2xl space-y-4 mt-4">
                          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 border border-violet-500/20 flex items-center justify-center">
                            <FileWarning size={24} className="text-violet-400" />
                          </div>
                          <p className="text-sm font-bold text-white">All coordinates clear!</p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">Be the first to report a broken streetlight, pothole, or trash pile in your neighborhood.</p>
                          <button 
                            id="empty-state-report-btn"
                            onClick={() => setActiveTab('report')}
                            className="mt-1 text-xs font-black text-gradient-aurora hover:opacity-80 transition"
                          >
                            File rapid complaint &rarr;
                          </button>
                        </div>
                      ) : (
                        reports.map((report) => {
                          const dateStr = report.timestamp?.seconds 
                            ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : 'Just now';

                          const statusClass = 
                            report.status === 'Resolved' ? 'status-resolved' :
                            report.status === 'Under Review' ? 'status-review' :
                            'status-reported';

                          const severityLevel = 
                            report.severity === 'High' ? 'high' :
                            report.severity === 'Medium' ? 'medium' :
                            'low';

                          return (
                            <div 
                              id={`drawer-item-${report.id}`}
                              key={report.id}
                              onClick={() => {
                                setSelectedReportId(report.id);
                                setFocusedReportId(report.id);
                              }}
                              className={`group glass-card p-3.5 rounded-2xl cursor-pointer transition-all duration-200 flex gap-3.5 relative overflow-hidden hover:shadow-violet-500/5 hover:shadow-lg ${selectedReportId === report.id ? 'ring-1 ring-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10' : ''}`}
                            >
                              {/* Severity dot indicator */}
                              <div className="absolute top-3 left-3">
                                <div className={`severity-dot severity-dot-${severityLevel}`} />
                              </div>

                              {report.photoUrl ? (
                                <div className="w-14 h-14 bg-slate-950 flex-shrink-0 overflow-hidden rounded-xl border border-white/5 ml-4">
                                  <img src={report.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-305" referrerPolicy="no-referrer" />
                                </div>
                              ) : (
                                <div className="w-14 h-14 bg-slate-950 rounded-xl shrink-0 flex items-center justify-center border border-white/5 text-[9px] text-slate-500 font-bold uppercase tracking-wider ml-4">
                                  No pic
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-1.5">
                                  <h4 className="text-[13px] font-extrabold text-white leading-none truncate group-hover:text-violet-400 transition">{report.category}</h4>
                                  <span className="text-[9px] text-slate-500 shrink-0 font-extrabold uppercase flex items-center gap-1">
                                    <Calendar size={9} className="text-slate-600" />
                                    {dateStr}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed italic">
                                  "{report.userNotes || 'No citizen notes added.'}"
                                </p>

                                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${statusClass}`}>{report.status}</span>
                                  <span className="text-[9px] text-slate-400 font-extrabold bg-slate-950/40 border border-white/5 px-2 py-0.5 rounded-full">💼 {report.responsible_department}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Center Map Box Section */}
              <div id="central-map-wrap" className="flex-1 relative h-1/2 lg:h-full">
                <MapContainer 
                  mode="view"
                  reports={reports}
                  center={mapFocusedReport?.location ? [mapFocusedReport.location.lat, mapFocusedReport.location.lng] : [37.7749, -122.4194]}
                  selectedReportId={mapFocusedReportId}
                  onSelectReport={(reportId) => {
                    setSelectedReportId(reportId);
                    setFocusedReportId(reportId);
                  }}
                />
                
                {/* Floating button on maps */}
                <button 
                  id="map-floating-report-btn"
                  onClick={() => setActiveTab('report')}
                  className="absolute bottom-5 right-5 z-[500] md:hidden btn-aurora text-white rounded-full p-4 shadow-xl active:scale-95 transition"
                  title="File public complaint"
                >
                  <PlusCircle size={22} />
                </button>
              </div>

              {/* Right Sidebar drawer for explicit report details */}
              <AnimatePresence>
                {selectedReportDetails && (
                  <motion.div 
                    initial={{ x: 380, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 380, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    id="complaint-detail-drawer"
                    className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-[#080c18]/95 glass-heavy z-[1010] shadow-2xl p-6 flex flex-col h-full overflow-y-auto"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 text-violet-300 px-2.5 py-1 rounded-md">Public Incident File</span>
                        <h3 className="text-md font-display font-extrabold text-white leading-tight mt-2">Category: {selectedReportDetails.category}</h3>
                      </div>
                      <button 
                        id="close-drawer-btn"
                        onClick={() => {
                          setSelectedReportId(null);
                          setFocusedReportId(null);
                        }}
                        className="glass p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Photo */}
                    {selectedReportDetails.photoUrl && (
                      <div className="mt-4.5 w-full h-44 rounded-2xl overflow-hidden border border-white/10 select-none shadow-sm relative group">
                        <img src={selectedReportDetails.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#080c18] via-transparent to-transparent pointer-events-none" />
                      </div>
                    )}

                    {/* Core stats parameters */}
                    <div className="mt-5 space-y-4 text-xs font-semibold">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="glass-card p-3.5 rounded-2xl">
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Status</span>
                          <span className="text-white flex items-center gap-1.5 mt-1 font-extrabold text-[13px]">
                            {selectedReportDetails.status === 'Resolved' && <CheckCircle2 size={13} className="text-emerald-400" />}
                            {selectedReportDetails.status === 'Under Review' && <Clock size={13} className="text-cyan-400 animate-pulse" />}
                            {selectedReportDetails.status === 'Reported' && <Clock size={13} className="text-rose-400" />}
                            {selectedReportDetails.status}
                          </span>
                        </div>
                        <div className="glass-card p-3.5 rounded-2xl">
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Severity Level</span>
                          <span className="flex items-center gap-2 mt-1.5">
                            <div className={`severity-dot severity-dot-${selectedReportDetails.severity === 'High' ? 'high' : selectedReportDetails.severity === 'Medium' ? 'medium' : 'low'}`} />
                            <span className="text-[11px] font-extrabold font-display text-white">
                              {selectedReportDetails.severity === 'High' ? 'High Severity' : selectedReportDetails.severity === 'Medium' ? 'Medium Severity' : 'Low Severity'}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Assigned Service Department</span>
                        <p className="text-white font-bold flex items-center gap-1.5 glass-card px-3 py-2.5 rounded-xl">
                          💼 {selectedReportDetails.responsible_department}
                        </p>
                      </div>

                      {selectedReportDetails.severityReasoning && (
                        <div>
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">AI Severity Assessment Justification</span>
                          <p className="text-slate-300 text-[11px] leading-relaxed italic pr-2 font-medium glass p-3 rounded-xl">
                            "{selectedReportDetails.severityReasoning}"
                          </p>
                        </div>
                      )}

                      <div className="border-t border-white/5 pt-3.5">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Citizen Notes</span>
                        <div className="glass gradient-border rounded-xl p-3">
                          <p className="text-slate-300 leading-relaxed text-[11px] font-medium">
                            "{selectedReportDetails.userNotes || 'No explicit citizen description recorded.'}"
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-3.5">
                        <span className="text-[9px] uppercase font-extrabold tracking-wider flex items-center gap-1 mb-1.5">
                          <Sparkles size={11} className="text-violet-400 animate-pulse" />
                          <span className="text-gradient-cool">AI Generated Grievance Letter</span>
                        </span>
                        <div className="glass gradient-border rounded-2xl p-4 text-[11px] text-slate-200 font-mono leading-relaxed select-text shadow-inner max-h-[160px] overflow-y-auto whitespace-pre-wrap">
                          {selectedReportDetails.formal_complaint_text}
                        </div>
                      </div>
                    </div>

                    {/* Citizen Feedback Component */}
                    {selectedReportDetails.status === 'Resolved' && (
                      <div id="citizen-feedback-panel" className="border-t border-white/5 pt-4 mt-4 shrink-0">
                        <span className="text-[9px] uppercase font-black tracking-wider flex items-center gap-1 mb-2 text-violet-400">
                          <MessageSquare size={11} className="text-violet-400" />
                          Citizen Verification
                        </span>
                        
                        {selectedReportDetails.citizenFeedback ? (
                          <div className="glass gradient-border rounded-xl p-3.5 space-y-3">
                            <p className="text-[11px] text-slate-300 font-medium">
                              Was this issue actually fixed?
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                                Answer: {selectedReportDetails.citizenFeedback}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {selectedReportDetails.citizenFeedback === 'No' ? '🔴 Unresolved' : '🟢 Feedback recorded'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 italic leading-relaxed">
                              Thank you for helping us keep our community records accurate!
                            </p>
                            
                            {selectedReportDetails.citizenFeedback === 'No' && (
                              <div className="pt-2.5 border-t border-white/5">
                                <p className="text-[10px] text-slate-400 mb-2">
                                  Since the issue was not resolved, you can reopen it:
                                </p>
                                <button
                                  id="reopen-issue-btn"
                                  onClick={async () => {
                                    try {
                                      const docRef = doc(db, 'reports', selectedReportDetails.id);
                                      await updateDoc(docRef, {
                                        status: 'Reported',
                                        reopenedAt: serverTimestamp()
                                      });
                                      showToast('Incident reopened successfully and sent back to dispatch queue.', 'success');
                                    } catch (err: any) {
                                      console.error('Failed to reopen:', err);
                                      showToast('Reopen failed: ' + err.message, 'info');
                                    }
                                  }}
                                  className="w-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 text-xs py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <AlertOctagon size={13} className="animate-pulse" />
                                  Reopen Issue
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="glass gradient-border rounded-xl p-4 space-y-3">
                            <p className="text-[11px] text-slate-200 font-bold">
                              Was this issue actually fixed?
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                id="feedback-yes-btn"
                                onClick={async () => {
                                  try {
                                    const docRef = doc(db, 'reports', selectedReportDetails.id);
                                    await updateDoc(docRef, { citizenFeedback: 'Yes' });
                                    showToast('Thank you for verifying! Feedback recorded.', 'success');
                                  } catch (err: any) {
                                    console.error(err);
                                    showToast('Failed to submit feedback: ' + err.message, 'info');
                                  }
                                }}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-300 text-[11px] py-2 rounded-lg font-extrabold transition cursor-pointer text-center select-none"
                              >
                                Yes
                              </button>
                              <button
                                id="feedback-partially-btn"
                                onClick={async () => {
                                  try {
                                    const docRef = doc(db, 'reports', selectedReportDetails.id);
                                    await updateDoc(docRef, { citizenFeedback: 'Partially' });
                                    showToast('Thank you for verifying! Feedback recorded.', 'success');
                                  } catch (err: any) {
                                    console.error(err);
                                    showToast('Failed to submit feedback: ' + err.message, 'info');
                                  }
                                }}
                                className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-300 text-[11px] py-2 rounded-lg font-extrabold transition cursor-pointer text-center select-none"
                              >
                                Partially
                              </button>
                              <button
                                id="feedback-no-btn"
                                onClick={async () => {
                                  try {
                                    const docRef = doc(db, 'reports', selectedReportDetails.id);
                                    await updateDoc(docRef, { citizenFeedback: 'No' });
                                    showToast('Feedback submitted. You can now choose to reopen this issue.', 'info');
                                  } catch (err: any) {
                                    console.error(err);
                                    showToast('Failed to submit feedback: ' + err.message, 'info');
                                  }
                                }}
                                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-[11px] py-2 rounded-lg font-extrabold transition cursor-pointer text-center select-none"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Support Signatures box */}
                    <div id="vote-box" className="mt-auto pt-4 border-t border-white/5 space-y-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-extrabold">
                          <Users size={14} className="text-violet-400" />
                          <span>{selectedReportDetails.confirmations || 1} Citizen backing signatures</span>
                        </div>
                      </div>

                      <button 
                        id="support-drawer-item-btn"
                        onClick={() => handleSupportReport(selectedReportDetails)}
                        className="btn-aurora rounded-xl w-full py-3.5 text-sm font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        👍 Back & Endorse This Issue
                      </button>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB: Form reporter */}
          {activeTab === 'report' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 max-w-7xl mx-auto w-full py-6 md:py-10 px-4 md:px-8"
              id="report-tab-container"
            >
              <ReportForm 
                onBackToMap={() => setActiveTab('map')} 
                onSuccess={handleReportSuccess} 
              />
            </motion.div>
          )}

          {/* TAB: Weekly trends summarizer */}
          {activeTab === 'trends' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 max-w-4xl mx-auto w-full py-8 px-4"
              id="trends-tab-container"
            >
              <WeeklyTrends />
            </motion.div>
          )}

          {/* TAB: Admin Dashboard */}
          {activeTab === 'admin' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 w-full"
              id="admin-tab-container"
            >
              <AdminPanel />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Premium Footer */}
      <footer id="app-footer" className="glass shrink-0 relative z-[1]">
        {/* Gradient top border */}
        <div className="h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
        <div className="py-4 text-center text-[9px] font-extrabold tracking-widest">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400">
            <span>🛡️ <span className="text-gradient-aurora">CIVORA</span> COOPERATIVE &copy; {new Date().getFullYear()}</span>
            <span>EMPOWERING COMMUNITIES VIA MUNICIPAL INTELLIGENCE</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
