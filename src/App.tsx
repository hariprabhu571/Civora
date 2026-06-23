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
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col font-sans select-none relative overflow-x-hidden antialiased">
      
      {/* Toast Alert bar */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            id="toast-notification"
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full px-5 py-4 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-3 ${toastType === 'success' ? 'bg-indigo-900 border-indigo-700 text-white' : 'bg-slate-900 border-slate-700 text-slate-100'}`}
          >
            <Sparkles size={16} className="text-amber-400 animate-spin shrink-0" />
            <div className="flex-1 select-text">
              <span className="block text-slate-100">{toastMessage}</span>
            </div>
            <button id="close-toast" onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white transition">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main navigation Header */}
      <header id="app-header" className="sticky top-0 bg-white border-b border-slate-200/80 z-[1000] px-4 md:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo Brand */}
          <div 
            id="brand-logo"
            onClick={() => { setActiveTab('map'); setSelectedReportId(null); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:bg-indigo-700 transition">
              <ShieldAlert size={20} className="group-hover:rotate-6 transition" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Community Hero 
              </h1>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none mt-0.5">District Civic Node</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav id="top-nav" className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200/50">
            <button 
              id="nav-map-btn"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <MapPin size={14} /> Map Feed
            </button>
            <button 
              id="nav-trends-btn"
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'trends' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <TrendingUp size={14} /> Civic Trends
            </button>
            <button 
              id="nav-admin-btn"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/20' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Lock size={14} /> Dispatch Board
            </button>
          </nav>

          {/* Prompt CTA for citizens */}
          {activeTab !== 'report' && (
            <button 
              id="header-report-btn"
              onClick={() => { setActiveTab('report'); setSelectedReportId(null); }}
              className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-display font-semibold px-4 py-2 rounded-xl text-xs transition shadow-md hover:shadow-lg hover:-translate-y-0.5 transform shadow-indigo-600/10"
            >
              <PlusCircle size={15} /> Report Incident (60s)
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
              <div id="side-list-pane" className="w-full lg:w-96 bg-white border-r border-slate-200 shrink-0 flex flex-col h-1/2 lg:h-full z-[10]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Recent Incident Records</h2>
                    <p className="text-[10px] text-slate-400 font-semibold">{reports.length} reports filed in district</p>
                  </div>
                  
                  {/* Floating reporter trigger on mobile list header */}
                  <button 
                    id="mobile-fom-trigger-btn"
                    onClick={() => setActiveTab('report')}
                    className="md:hidden flex items-center gap-1.5 bg-indigo-600 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold"
                  >
                    <PlusCircle size={12} /> File
                  </button>
                </div>

                {/* Listing content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-bold space-y-2">
                      <span className="inline-block w-6 h-6 border-t-2 border-indigo-600 rounded-full animate-spin" />
                      <p>Synchronizing coordinates...</p>
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-slate-700">All coordinates clear!</p>
                      <p className="text-[10px] text-slate-400">Be the first to report a broken streetlight, pothole, or trash pile in your neighborhood.</p>
                      <button 
                        id="empty-state-report-btn"
                        onClick={() => setActiveTab('report')}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        File rapid complaint
                      </button>
                    </div>
                  ) : (
                    reports.map((report) => {
                      const dateStr = report.timestamp?.seconds 
                        ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : 'Just now';

                      const statusColor = 
                        report.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        report.status === 'Under Review' ? 'bg-cyan-50 text-cyan-700 border-cyan-100 animate-pulse' :
                        'bg-rose-50 text-rose-700 border-rose-100';

                      return (
                        <div 
                          id={`drawer-item-${report.id}`}
                          key={report.id}
                          onClick={() => setSelectedReportId(report.id)}
                          className={`p-3 border rounded-xl cursor-pointer transition flex gap-3 ${selectedReportId === report.id ? 'border-indigo-600 bg-indigo-50/5 ring-1 ring-indigo-600' : 'border-slate-200/80 hover:border-slate-300'}`}
                        >
                          {report.photoUrl ? (
                            <div className="w-12 h-12 bg-slate-50 flex-shrink-0 overflow-hidden rounded-lg border">
                              <img src={report.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center border text-[10px] text-slate-400 font-bold uppercase">
                              No pic
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-[13px] font-bold text-slate-800 leading-none truncate">{report.category}</h4>
                              <span className="text-[9px] text-slate-400 shrink-0 font-semibold">{dateStr}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                              "{report.userNotes || 'No citizen notes added.'}"
                            </p>

                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className={`px-1 text-[9px] font-bold border rounded ${statusColor}`}>{report.status}</span>
                              <span className="text-[9px] text-slate-400 font-semibold">💼 {report.responsible_department}</span>
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
                  className="absolute bottom-5 right-5 z-[500] md:hidden bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-xl transition"
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
                    id="complaint-detail-drawer"
                    className="absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-white border-l border-slate-200 z-[1010] shadow-2xl p-6 flex flex-col h-full overflow-y-auto"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest text-indigo-600 font-extrabold">Public Incident File</span>
                        <h3 className="text-md font-display font-semibold text-slate-900 leading-none mt-0.5">Category: {selectedReportDetails.category}</h3>
                      </div>
                      <button 
                        id="close-drawer-btn"
                        onClick={() => setSelectedReportId(null)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Photo */}
                    {selectedReportDetails.photoUrl && (
                      <div className="mt-4 w-full h-44 rounded-xl overflow-hidden border select-none">
                        <img src={selectedReportDetails.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}

                    {/* Core stats parameters */}
                    <div className="mt-4 space-y-3.5 text-xs font-semibold">
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Status</span>
                          <span className="text-slate-800 flex items-center gap-1.5 mt-0.5 font-bold">
                            {selectedReportDetails.status === 'Resolved' && <CheckCircle2 size={12} className="text-emerald-500" />}
                            {selectedReportDetails.status === 'Under Review' && <Clock size={12} className="text-cyan-500 animate-pulse" />}
                            {selectedReportDetails.status === 'Reported' && <Clock size={12} className="text-rose-500" />}
                            {selectedReportDetails.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Severity Level</span>
                          <span className="text-slate-800 font-extrabold font-display mt-0.5 block">{selectedReportDetails.severity}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Assigned Service Department</span>
                        <p className="text-slate-800 font-bold flex items-center gap-1.5 bg-slate-100/50 border px-2.5 py-1.5 rounded-lg">
                          💼 {selectedReportDetails.responsible_department}
                        </p>
                      </div>

                      {selectedReportDetails.severityReasoning && (
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block mb-0.5">AI Severity Analysis justification</span>
                          <p className="text-slate-500 text-[11px] leading-relaxed italic pr-2">
                            "{selectedReportDetails.severityReasoning}"
                          </p>
                        </div>
                      )}

                      <div className="border-t pt-3">
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Citizen notes</span>
                        <p className="text-slate-600 leading-relaxed text-[11px] pr-2">
                          "{selectedReportDetails.userNotes || 'No explicit citizen description recorded.'}"
                        </p>
                      </div>

                      <div className="border-t pt-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 flex items-center gap-1 mb-1">
                          <Sparkles size={11} /> AI Generated Grievance Letter
                        </span>
                        <div className="bg-indigo-50/20 border border-indigo-100 p-3.5 rounded-xl text-[11px] text-slate-700 font-mono leading-relaxed select-text shadow-inner">
                          {selectedReportDetails.formal_complaint_text}
                        </div>
                      </div>
                    </div>

                    {/* Support Signatures box */}
                    <div id="vote-box" className="mt-5 pt-4 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                          <Users size={14} className="text-indigo-600" />
                          <span>{selectedReportDetails.confirmations || 1} support votes registered</span>
                        </div>
                      </div>

                      <button 
                        id="support-drawer-item-btn"
                        onClick={() => handleSupportReport(selectedReportDetails)}
                        className="w-full text-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-display rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5"
                      >
                        👍 Support & Confirm This Issue
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
              className="flex-1 max-w-7xl mx-auto w-full"
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

      {/* Humble Footer footer branding */}
      <footer id="app-footer" className="bg-white border-t py-4 text-center text-[10px] text-slate-400 font-bold shrink-0">
        <div className="max-w-7xl mx-auto">
          <span>🛡️ COMMUNITY HERO COOPERATIVE &copy; {new Date().getFullYear()} — UNITING NEIGHBORHOODS VIA AI</span>
        </div>
      </footer>

    </div>
  );
}
