import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from './lib/firebase';
import { safeLocalStorage } from './lib/storage';
import { CivicReport, ReportStatus } from './types';
import MapContainer from './components/MapContainer';
import ReportForm from './components/ReportForm';
import AdminPanel from './components/AdminPanel';
import WeeklyTrends from './components/WeeklyTrends';
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
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'report' | 'trends' | 'admin'>('map');
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
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

  // Setup real-time listener for ALL reports
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: CivicReport[] = [];
      snapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() } as CivicReport);
      });
      setReports(docs);
      setLoading(false);
    }, (err) => {
      console.error('Snapshot read fail:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReportSuccess = (reportId: string, isConfirmation: boolean) => {
    if (isConfirmation) {
      showToast('Support vote successfully registered for existing complaint ticket!', 'success');
    } else {
      showToast('New formal grievance filed! Dispatched to the service board.', 'success');
    }
    setSelectedReportId(reportId);
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

  return (
    <div className="bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] min-h-screen text-slate-800 flex flex-col font-sans select-none relative overflow-x-hidden antialiased">
      
      {/* Background elegant grid mesh lines for designer finish */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000004_1px,transparent_1px),linear-gradient(to_bottom,#00000004_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Toast Alert bar */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            id="toast-notification"
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[90%] px-5 py-4 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-3 backdrop-blur-md ${toastType === 'success' ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-slate-900 border-slate-700 text-slate-100'}`}
          >
            <Sparkles size={16} className="text-indigo-400 animate-spin shrink-0" />
            <div className="flex-1 select-text">
              <span className="block text-slate-100">{toastMessage}</span>
            </div>
            <button id="close-toast" onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white transition p-1 hover:bg-white/10 rounded-lg">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main navigation Header */}
      <header id="app-header" className="sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-200/60 z-[1000] px-4 md:px-8 py-3.5 shadow-sm shadow-slate-100/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div 
            id="brand-logo"
            onClick={() => { setActiveTab('map'); setSelectedReportId(null); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 group-hover:shadow-indigo-600/40 group-hover:scale-105 active:scale-95 transition-all">
              <ShieldAlert size={20} className="group-hover:rotate-6 transition" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-display font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 leading-none">
                Civora
              </h1>
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1">District Civic Node</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav id="top-nav" className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-200/30">
            <button 
              id="nav-map-btn"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'map' ? 'bg-white text-slate-950 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <MapPin size={13} /> <span className="hidden sm:inline">Map Feed</span>
            </button>
            <button 
              id="nav-trends-btn"
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'trends' ? 'bg-white text-slate-950 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <TrendingUp size={13} /> <span className="hidden sm:inline">Civic Trends</span>
            </button>
            <button 
              id="nav-admin-btn"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-white text-slate-950 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Lock size={13} /> <span className="hidden sm:inline">Dispatch Board</span>
            </button>
          </nav>

          {/* Prompt CTA for citizens */}
          {activeTab !== 'report' && (
            <button 
              id="header-report-btn"
              onClick={() => { setActiveTab('report'); setSelectedReportId(null); }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-display font-bold px-4.5 py-2 rounded-xl text-xs transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 shadow-indigo-600/10"
            >
              <PlusCircle size={14} /> <span className="hidden md:inline">Report Incident</span><span className="md:hidden">Report</span>
            </button>
          )}

        </div>
      </header>

      {/* Main layout contents */}
      <main className="flex-1 flex flex-col relative">
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
              <div id="side-list-pane" className="w-full lg:w-96 bg-white/90 backdrop-blur-md border-r border-slate-200/60 shrink-0 flex flex-col h-1/2 lg:h-full z-[10] shadow-xl shadow-slate-100/10">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
                  <div>
                    <h2 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Feed Registry</h2>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                      District Incidents
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold">{reports.length}</span>
                    </h3>
                  </div>
                  
                  {/* Floating reporter trigger on mobile list header */}
                  <button 
                    id="mobile-fom-trigger-btn"
                    onClick={() => setActiveTab('report')}
                    className="md:hidden flex items-center gap-1 bg-indigo-600 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition"
                  >
                    <PlusCircle size={12} /> File
                  </button>
                </div>

                {/* Listing content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200">
                  {loading ? (
                    <div className="p-12 text-center text-xs text-slate-400 font-bold space-y-3">
                      <div className="relative w-8 h-8 mx-auto flex items-center justify-center">
                        <span className="absolute inline-block w-full h-full border-2 border-indigo-600/30 rounded-full" />
                        <span className="absolute inline-block w-full h-full border-t-2 border-indigo-600 rounded-full animate-spin" />
                      </div>
                      <p className="tracking-wide">Synchronizing coordinates...</p>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3 mt-4">
                      <p className="text-xs font-bold text-slate-800">All coordinates clear!</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">Be the first to report a broken streetlight, pothole, or trash pile in your neighborhood.</p>
                      <button 
                        id="empty-state-report-btn"
                        onClick={() => setActiveTab('report')}
                        className="mt-2 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition"
                      >
                        File rapid complaint &rarr;
                      </button>
                    </div>
                  ) : (
                    reports.map((report) => {
                      const dateStr = report.timestamp?.seconds 
                        ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'Just now';

                      const statusColor = 
                        report.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' :
                        report.status === 'Under Review' ? 'bg-cyan-50 text-cyan-700 border-cyan-100/60' :
                        'bg-rose-50 text-rose-700 border-rose-100/60';

                      const severityLeftBar = 
                        report.severity === 'High' ? 'border-l-4 border-l-rose-500' :
                        report.severity === 'Medium' ? 'border-l-4 border-l-amber-500' :
                        'border-l-4 border-l-emerald-500';

                      return (
                        <div 
                          id={`drawer-item-${report.id}`}
                          key={report.id}
                          onClick={() => setSelectedReportId(report.id)}
                          className={`group p-3.5 border rounded-2xl cursor-pointer transition-all duration-200 flex gap-3.5 relative overflow-hidden ${severityLeftBar} ${selectedReportId === report.id ? 'border-indigo-600 bg-indigo-50/10 shadow-md ring-1 ring-indigo-600' : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-lg shadow-sm hover:-translate-y-0.5'}`}
                        >
                          {report.photoUrl ? (
                            <div className="w-14 h-14 bg-slate-50 flex-shrink-0 overflow-hidden rounded-xl border border-slate-100">
                              <img src={report.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 bg-slate-50 rounded-xl shrink-0 flex items-center justify-center border border-slate-100 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              No pic
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <h4 className="text-[13px] font-extrabold text-slate-900 leading-none truncate group-hover:text-indigo-600 transition">{report.category}</h4>
                              <span className="text-[9px] text-slate-400 shrink-0 font-bold">{dateStr}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                              {report.userNotes || 'No citizen notes added.'}
                            </p>

                            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                              <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full ${statusColor}`}>{report.status}</span>
                              <span className="text-[9px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">💼 {report.responsible_department}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Center Map Box Section */}
              <div id="central-map-wrap" className="flex-1 relative h-1/2 lg:h-full">
                <MapContainer 
                  mode="view"
                  reports={reports}
                  center={selectedReportDetails?.location ? [selectedReportDetails.location.lat, selectedReportDetails.location.lng] : [37.7749, -122.4194]}
                  selectedReportId={selectedReportId}
                  onSelectReport={(reportId) => setSelectedReportId(reportId)}
                />
                
                {/* Floating button on maps */}
                <button 
                  id="map-floating-report-btn"
                  onClick={() => setActiveTab('report')}
                  className="absolute bottom-5 right-5 z-[500] md:hidden bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-xl active:scale-95 transition"
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
                    className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200/80 z-[1010] shadow-2xl p-6 flex flex-col h-full overflow-y-auto"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded">Public Incident File</span>
                        <h3 className="text-md font-display font-extrabold text-slate-900 leading-tight mt-1.5">Category: {selectedReportDetails.category}</h3>
                      </div>
                      <button 
                        id="close-drawer-btn"
                        onClick={() => setSelectedReportId(null)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-xl text-slate-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Photo */}
                    {selectedReportDetails.photoUrl && (
                      <div className="mt-4.5 w-full h-44 rounded-2xl overflow-hidden border border-slate-100 select-none shadow-sm relative group">
                        <img src={selectedReportDetails.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent pointer-events-none" />
                      </div>
                    )}

                    {/* Core stats parameters */}
                    <div className="mt-5 space-y-4 text-xs font-semibold">
                      <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Status</span>
                          <span className="text-slate-800 flex items-center gap-1.5 mt-1 font-extrabold text-[13px]">
                            {selectedReportDetails.status === 'Resolved' && <CheckCircle2 size={13} className="text-emerald-500" />}
                            {selectedReportDetails.status === 'Under Review' && <Clock size={13} className="text-cyan-500 animate-pulse" />}
                            {selectedReportDetails.status === 'Reported' && <Clock size={13} className="text-rose-500" />}
                            {selectedReportDetails.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Severity Level</span>
                          <span className={`inline-block mt-1 text-[11px] font-extrabold font-display`}>
                            {selectedReportDetails.severity === 'High' ? '🔴 High Severity' : selectedReportDetails.severity === 'Medium' ? '🟡 Medium Severity' : '🟢 Low Severity'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Assigned Service Department</span>
                        <p className="text-slate-800 font-bold flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                          💼 {selectedReportDetails.responsible_department}
                        </p>
                      </div>

                      {selectedReportDetails.severityReasoning && (
                        <div>
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">AI Severity Assessment Justification</span>
                          <p className="text-slate-500 text-[11px] leading-relaxed italic pr-2 font-medium bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                            "{selectedReportDetails.severityReasoning}"
                          </p>
                        </div>
                      )}

                      <div className="border-t border-slate-100 pt-3.5">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Citizen Notes</span>
                        <p className="text-slate-600 leading-relaxed text-[11px] font-medium bg-slate-50/30 border border-slate-100/50 p-3 rounded-xl">
                          "{selectedReportDetails.userNotes || 'No explicit citizen description recorded.'}"
                        </p>
                      </div>

                      <div className="border-t border-slate-100 pt-3.5">
                        <span className="text-[9px] uppercase font-extrabold tracking-wider text-indigo-600 flex items-center gap-1 mb-1.5">
                          <Sparkles size={11} className="text-indigo-500 animate-pulse" /> AI Generated Grievance Letter
                        </span>
                        <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl text-[11px] text-slate-200 font-mono leading-relaxed select-text shadow-inner max-h-[160px] overflow-y-auto">
                          {selectedReportDetails.formal_complaint_text}
                        </div>
                      </div>
                    </div>

                    {/* Support Signatures box */}
                    <div id="vote-box" className="mt-auto pt-4 border-t border-slate-100 space-y-3 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-extrabold">
                          <Users size={14} className="text-indigo-600" />
                          <span>{selectedReportDetails.confirmations || 1} Citizen backing signatures</span>
                        </div>
                      </div>

                      <button 
                        id="support-drawer-item-btn"
                        onClick={() => handleSupportReport(selectedReportDetails)}
                        className="w-full text-center py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-display rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-1.5"
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

      {/* Humble Footer branding */}
      <footer id="app-footer" className="bg-white/90 backdrop-blur-md border-t border-slate-200/50 py-3.5 text-center text-[9px] text-slate-400 font-extrabold shrink-0 tracking-wider">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>🛡️ CIVORA COOPERATIVE &copy; {new Date().getFullYear()}</span>
          <span>EMPOWERING COMMUNITIES VIA MUNICIPAL INTELLIGENCE</span>
        </div>
      </footer>

    </div>
  );
}
