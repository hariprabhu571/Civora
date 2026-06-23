import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CivicReport, ReportStatus, CivicCategory, SeverityLevel } from '../types';
import { Trash2, AlertCircle, Clock, CheckCircle2, ChevronRight, Filter, Search, MapPin, Eye, FileSpreadsheet, Layers, Sparkles } from 'lucide-react';

export default function AdminPanel() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CivicReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterSeverity, setFilterSeverity] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Inline styling non-blocking alert notice state
  const [adminNotice, setAdminNotice] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const showAdminNotice = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAdminNotice({ message, type });
    setTimeout(() => {
      setAdminNotice(prev => prev && prev.message === message ? null : prev);
    }, 5000);
  };

  // Fetch reports in real-time
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: CivicReport[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as CivicReport);
      });
      setReports(loaded);
      setLoading(false);
      
      // Auto refresh active selected report if it changed
      if (selectedReport) {
        const refreshed = loaded.find(r => r.id === selectedReport.id);
        if (refreshed) {
          setSelectedReport(refreshed);
        }
      }
    }, (err) => {
      console.error('Error fetching reports:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedReport?.id]);

  // Status transitions
  const updateReportStatus = async (reportId: string, nextStatus: ReportStatus) => {
    try {
      const docRef = doc(db, 'reports', reportId);
      await updateDoc(docRef, { status: nextStatus });
      showAdminNotice(`Status successfully updated to ${nextStatus}`, 'success');
    } catch (err: any) {
      showAdminNotice('Failed to update status: ' + err.message, 'error');
    }
  };

  // Delete ticket
  const handleDeleteReport = async (reportId: string) => {
    let proceed = false;
    try {
      proceed = window.confirm('Are you sure you want to delete this civic grievance file from the community log? This is irreversible.');
    } catch (e) {
      console.warn('window.confirm blocked/unavailable in sandbox. Proceeding safely.', e);
      proceed = true; // Fallback to let the user delete in preview demo
    }

    if (!proceed) return;

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setSelectedReport(null);
      showAdminNotice('Grievance ticket successfully purged from municipal database.', 'success');
    } catch (err: any) {
      showAdminNotice('Delete failed: ' + err.message, 'error');
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((report) => {
    const matchesStatus = filterStatus === 'All' || report.status === filterStatus;
    const matchesSeverity = filterSeverity === 'All' || report.severity === filterSeverity;
    const matchesCategory = filterCategory === 'All' || report.category === filterCategory;
    const matchesSearch = 
      report.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.formal_complaint_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.userNotes && report.userNotes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      report.responsible_department.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSeverity && matchesCategory && matchesSearch;
  });

  const getSeverityBadge = (level: SeverityLevel) => {
    switch (level) {
      case 'High':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">High</span>;
      case 'Medium':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">Medium</span>;
      case 'Low':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">Low</span>;
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Reported':
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg text-xs font-bold leading-none">
            <Clock size={12} /> Reported
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 bg-sky-500/10 text-sky-405 border border-sky-500/20 px-2.5 py-1 rounded-lg text-xs font-bold leading-none animate-pulse">
            <AlertCircle size={12} /> Under Review
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-xs font-bold leading-none">
            <CheckCircle2 size={12} /> Resolved
          </span>
        );
    }
  };

  return (
    <div className="bg-transparent min-h-screen font-sans relative pb-12">
      {/* Dynamic Non-blocking alert notice banner */}
      {adminNotice && (
        <div className={`fixed top-6 right-6 z-[9999] max-w-md p-4.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-start gap-3.5 transition-all backdrop-blur-md ${
          adminNotice.type === 'error' ? 'bg-rose-950/95 text-rose-200 border-rose-900/60' :
          adminNotice.type === 'success' ? 'bg-slate-900/95 text-emerald-350 border-slate-800 shadow-xl' :
          'bg-indigo-950/95 text-indigo-300 border-indigo-900/60'
        }`}>
          <span className="text-[15px] leading-none">{adminNotice.type === 'error' ? '⚠️' : adminNotice.type === 'success' ? '✅' : 'ℹ️'}</span>
          <div className="flex-1 leading-relaxed">{adminNotice.message}</div>
          <button className="text-[14px] leading-none font-bold hover:opacity-75 p-1 hover:bg-white/10 rounded cursor-pointer" onClick={() => setAdminNotice(null)}>×</button>
        </div>
      )}

      {/* Banner / stats */}
      <div id="admin-header" className="bg-[#030712]/40 backdrop-blur-md text-white py-10 px-6 md:px-12 border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-900/60 px-3 py-1 rounded-full">Dispatch Command Panel</span>
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight mt-3">Grievance Dashboard</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-xl leading-relaxed">Review cataloged community incidents, authorize municipal work orders, and coordinate department responses in real-time.</p>
          </div>
          
          {/* Quick Counter widgets */}
          <div className="grid grid-cols-3 gap-3 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-sm w-full shadow-2xl">
            <div className="text-center">
              <span className="block text-2xl font-black text-white">{reports.length}</span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block mt-0.5">Total</span>
            </div>
            <div className="text-center border-x border-white/10 leading-none">
              <span className="block text-2xl font-black text-rose-400">
                {reports.filter(r => r.status === 'Reported').length}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block mt-0.5">New</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-black text-emerald-400">
                {reports.filter(r => r.status === 'Resolved').length}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block mt-0.5">Resolved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List and filtering control pane (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filters panel */}
            <div className="bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/10 flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                <input 
                  id="admin-search"
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Query department, keywords, category or ticket text..."
                  className="w-full pl-10 pr-4 py-2.5 border border-white/10 rounded-xl text-xs bg-slate-950/60 focus:bg-slate-950 text-white outline-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition duration-150"
                />
              </div>

              {/* Status and category dropdowns */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <select 
                  id="status-filter"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2.5 border border-white/10 bg-slate-950/80 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-white font-bold flex-1 md:flex-none cursor-pointer hover:bg-slate-950 transition"
                >
                  <option value="All">All Statuses</option>
                  <option value="Reported">Reported</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Resolved">Resolved</option>
                </select>

                <select 
                  id="category-filter"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2.5 border border-white/10 bg-slate-950/80 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-white font-bold flex-1 md:flex-none cursor-pointer hover:bg-slate-950 transition"
                >
                  <option value="All">All Categories</option>
                  <option value="Pothole">Pothole</option>
                  <option value="Streetlight">Streetlight</option>
                  <option value="Garbage/Waste">Garbage/Waste</option>
                  <option value="Water Leakage">Water Leakage</option>
                  <option value="Damaged Public Property">Damaged Public Property</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* List block */}
            {loading ? (
              <div className="p-20 text-center bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/10 space-y-3">
                <div className="relative w-8 h-8 mx-auto flex items-center justify-center">
                  <span className="absolute inline-block w-full h-full border-2 border-indigo-500/20 rounded-full" />
                  <span className="absolute inline-block w-full h-full border-t-2 border-indigo-400 rounded-full animate-spin" />
                </div>
                <p className="text-xs text-slate-400 font-extrabold tracking-wider uppercase mt-3">Sifting record logs...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-16 text-center bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl space-y-4 shadow-sm">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">No Matches in Log</h3>
                  <p className="text-[11px] text-slate-450 max-w-xs mx-auto mt-1 leading-relaxed">No reports matching your search or filters are currently available.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((report) => {
                  const dateStr = report.timestamp?.seconds 
                    ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : report.timestamp instanceof Date 
                      ? report.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Just now';

                  return (
                    <div 
                      id={`list-item-${report.id}`}
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center gap-4.5 ${selectedReport?.id === report.id ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-950/20 shadow-lg shadow-indigo-950/10' : 'border-white/5 bg-slate-950/30 hover:border-white/10 hover:bg-slate-900/40 hover:shadow-2xl shadow-md'}`}
                    >
                      {/* Avatar/Image */}
                      {report.photoUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-white/5">
                          <img src={report.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-355" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 text-slate-400 group-hover:bg-white/10 transition">
                          <Layers size={20} />
                        </div>
                      )}

                      {/* Summary */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-extrabold text-white text-[14px] leading-tight group-hover:text-indigo-400 transition">{report.category}</h3>
                          <span className="text-white/10 text-xs hidden sm:inline">|</span>
                          <span className="text-[10px] text-slate-450 font-extrabold tracking-wide uppercase">{dateStr}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-1 italic leading-relaxed">
                          "{report.userNotes || 'No notes description recorded. Read the formal text.'}"
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-400 bg-indigo-950/50 border border-indigo-900/30 px-2.5 py-0.5 rounded-full">
                            💼 {report.responsible_department}
                          </span>
                          <span className="text-[10px] text-slate-450 font-extrabold">
                            🎯 {report.confirmations || 1} support votes
                          </span>
                        </div>
                      </div>

                      {/* Right metadata badge indicators */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {getSeverityBadge(report.severity)}
                        <div className="flex items-center gap-1 text-[11px]">
                          {getStatusBadge(report.status)}
                          <ChevronRight size={14} className="text-slate-500 group-hover:translate-x-0.5 transition" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

           {/* Side Drawer: Detailed Audit and Transition board (Span 1) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              
              {selectedReport ? (
                <div id="inspector-card" className="bg-slate-900/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6 flex flex-col space-y-5 animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Card header */}
                  <div className="flex items-start justify-between border-b border-white/5 pb-4">
                    <div>
                      <span className="text-[9px] uppercase font-black tracking-widest text-indigo-400 block bg-indigo-950/80 px-2.5 py-1 rounded border border-indigo-900/40 w-fit">Ticket Auditor</span>
                      <h2 className="text-lg font-display font-extrabold text-white mt-2 leading-none">ID: {selectedReport.id.slice(0, 8).toUpperCase()}</h2>
                    </div>
                    <button 
                      id="close-inspector-btn"
                      onClick={() => setSelectedReport(null)}
                      className="text-[10px] uppercase font-bold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Attachment Photo container */}
                  {selectedReport.photoUrl && (
                    <div className="w-full h-44 rounded-2xl overflow-hidden border border-white/5 bg-slate-950 select-none relative group shadow-sm">
                      <img src={selectedReport.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" referrerPolicy="no-referrer" />
                      <a 
                        href={selectedReport.photoUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 bg-slate-950/90 hover:bg-slate-900 text-white text-[9px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-xl border border-white/10 shadow-lg transition"
                      >
                        Expand View
                      </a>
                    </div>
                  )}

                  {/* Main Details Grid */}
                  <div className="space-y-4 text-xs font-semibold">
                    <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-3.5">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-450 font-extrabold block mb-1">Incident Category</span>
                        <span className="text-white font-extrabold text-[13px]">{selectedReport.category}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-450 font-extrabold block mb-1">Assigned Branch</span>
                        <span className="text-white font-extrabold text-[13px]">{selectedReport.responsible_department}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-3.5">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-450 font-extrabold block mb-1">Severity / Urgency</span>
                        <div className="mt-1">{getSeverityBadge(selectedReport.severity)}</div>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-450 font-extrabold block mb-1">Public Support</span>
                        <span className="text-white font-extrabold block mt-1">{selectedReport.confirmations || 1} Backing Citizens</span>
                      </div>
                    </div>

                    {selectedReport.location && (
                      <div className="border-b border-white/5 pb-3.5">
                        <span className="text-[9px] uppercase tracking-wider text-slate-455 font-extrabold block mb-1">Coordinates</span>
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] bg-slate-950/60 border border-white/5 p-2 rounded-xl mt-1">
                          <MapPin size={11} className="text-indigo-400 shrink-0" />
                          <span>Lat: {selectedReport.location.lat.toFixed(5)}, Lng: {selectedReport.location.lng.toFixed(5)}</span>
                        </div>
                      </div>
                    )}

                    <div className="border-b border-white/5 pb-3.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-455 font-extrabold block mb-1">Raw User Description</span>
                      <p className="text-slate-300 font-medium italic select-text bg-slate-950/60 border border-white/5 p-3 rounded-xl mt-1 leading-relaxed">
                        "{selectedReport.userNotes || 'No notes description recorded.'}"
                      </p>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-black flex items-center gap-1 mb-1">
                        <Sparkles size={11} /> formal municipal grievance letter
                      </span>
                      <p className="text-slate-300 bg-slate-950/80 p-4 rounded-2xl border border-white/5 select-text leading-relaxed font-mono text-[11px] max-h-[140px] overflow-y-auto font-medium">
                        {selectedReport.formal_complaint_text}
                      </p>
                    </div>
                  </div>

                  {/* Transition operations board */}
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <span className="text-[9px] uppercase tracking-widest text-slate-455 font-black block">Status dispatch controls</span>
                    
                    <div className="flex gap-2 flex-wrap text-xs">
                      <button 
                        id="status-reported-btn"
                        onClick={() => updateReportStatus(selectedReport.id, 'Reported')}
                        disabled={selectedReport.status === 'Reported'}
                        className={`flex-1 py-2.5 rounded-xl font-bold transition border cursor-pointer ${selectedReport.status === 'Reported' ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed' : 'bg-slate-950/60 border-rose-900/40 hover:bg-rose-950/20 text-rose-400 active:scale-95'}`}
                      >
                        Reported
                      </button>

                      <button 
                        id="status-review-btn"
                        onClick={() => updateReportStatus(selectedReport.id, 'Under Review')}
                        disabled={selectedReport.status === 'Under Review'}
                        className={`flex-1 py-2.5 rounded-xl font-bold transition border cursor-pointer ${selectedReport.status === 'Under Review' ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed' : 'bg-slate-950/60 border-indigo-900/40 hover:bg-indigo-950/20 text-indigo-400 active:scale-95'}`}
                      >
                        In Review
                      </button>

                      <button 
                        id="status-resolved-btn"
                        onClick={() => updateReportStatus(selectedReport.id, 'Resolved')}
                        disabled={selectedReport.status === 'Resolved'}
                        className={`flex-1 py-2.5 rounded-xl font-bold transition border cursor-pointer ${selectedReport.status === 'Resolved' ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed' : 'bg-slate-950/60 border-emerald-900/40 hover:bg-emerald-950/20 text-emerald-400 active:scale-95'}`}
                      >
                        Resolved
                      </button>
                    </div>

                    <button 
                      id="admin-delete-btn"
                      onClick={() => handleDeleteReport(selectedReport.id)}
                      className="w-full py-3 bg-rose-600/90 hover:bg-rose-700 text-white rounded-xl text-xs font-bold font-display shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} /> Purge Public File
                    </button>
                  </div>

                </div>
              ) : (
                <div id="inspector-placeholder" className="bg-slate-900/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 text-center space-y-3.5">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm">Audit Inspector</h3>
                    <p className="text-[11px] text-slate-450 max-w-[200px] mx-auto mt-1 leading-relaxed">Select any reported incident card on the left list to evaluate, audit status, or dispatch action orders.</p>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
