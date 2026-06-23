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
        return <span className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">High</span>;
      case 'Medium':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">Medium</span>;
      case 'Low':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">Low</span>;
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Reported':
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-bold leading-none">
            <Clock size={12} /> Reported
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold leading-none animate-pulse">
            <AlertCircle size={12} /> Under Review
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold leading-none">
            <CheckCircle2 size={12} /> Resolved
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans relative">
      {/* Dynamic Non-blocking alert notice banner */}
      {adminNotice && (
        <div className={`fixed top-4 right-4 z-[9999] max-w-md p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-start gap-3 transition-all animate-bounce ${
          adminNotice.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          adminNotice.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100' :
          'bg-sky-50 text-sky-700 border-sky-200'
        }`}>
          <span className="text-[15px] leading-none">{adminNotice.type === 'error' ? '⚠️' : adminNotice.type === 'success' ? '✅' : 'ℹ️'}</span>
          <div className="flex-1">{adminNotice.message}</div>
          <button className="text-[14px] leading-none font-bold hover:opacity-75 relative -top-1" onClick={() => setAdminNotice(null)}>×</button>
        </div>
      )}

      {/* Banner / stats */}
      <div id="admin-header" className="bg-slate-900 text-white py-8 px-6 md:px-12 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">DISPATCH PANEL</span>
            <h1 className="text-2xl md:text-3xl font-display font-semibold mt-1">Grievance Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Review cataloged community incidents, authorize work permits, and update resolver statuses.</p>
          </div>
          
          {/* Quick Counter widgets */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 max-w-sm w-full">
            <div className="text-center">
              <span className="block text-xl font-extrabold text-white">{reports.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total</span>
            </div>
            <div className="text-center border-x border-slate-700/60 leading-none">
              <span className="block text-xl font-extrabold text-rose-400">
                {reports.filter(r => r.status === 'Reported').length}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">New</span>
            </div>
            <div className="text-center">
              <span className="block text-xl font-extrabold text-emerald-400">
                {reports.filter(r => r.status === 'Resolved').length}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Resolved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List and filtering control pane (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Filters panel */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input 
                  id="admin-search"
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Query department, keywords, category or ticket text..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-indigo-500 focus:ring-1 focus:ring-indigo-100 transition"
                />
              </div>

              {/* Status and category dropdowns */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <select 
                  id="status-filter"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 text-slate-700 font-medium flex-1 md:flex-none"
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
                  className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-100 text-slate-700 font-medium flex-1 md:flex-none"
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
              <div className="p-16 text-center bg-white border rounded-2xl">
                <span className="inline-block w-8 h-8 rounded-full border-t-2 border-indigo-600 animate-spin" />
                <p className="text-xs text-slate-400 font-semibold mt-3">Sifting municipal record logs...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-16 text-center bg-white border border-dashed rounded-2xl space-y-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700">No Incidents Found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">There are no reported civic issues that match your active filter tags or search terms.</p>
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
                      className={`group bg-white p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${selectedReport?.id === report.id ? 'border-indigo-600 ring-2 ring-indigo-50 bg-indigo-50/5' : 'border-slate-200/80 hover:border-indigo-200 hover:shadow-md shadow-sm'}`}
                    >
                      {/* Avatar/Image */}
                      {report.photoUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                          <img src={report.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 border text-slate-400">
                          <Layers size={20} />
                        </div>
                      )}

                      {/* Summary */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 border-slate-100 text-[15px]">{report.category}</h3>
                          <span className="text-slate-400 text-xs">|</span>
                          <span className="text-[11px] text-slate-500 font-medium">{dateStr}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic leading-relaxed">
                          "{report.userNotes || 'No user notes added. Read the formal text.'}"
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[10px] text-slate-400 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition">
                            💼 {report.responsible_department}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            🎯 {report.confirmations || 1} support votes
                          </span>
                        </div>
                      </div>

                      {/* Right metadata badge indicators */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {getSeverityBadge(report.severity)}
                        <div className="flex items-center gap-1 text-[11px]">
                          {getStatusBadge(report.status)}
                          <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition" />
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
                <div id="inspector-card" className="bg-white rounded-2xl shadow-xl border border-slate-200/70 p-6 flex flex-col space-y-5 animate-fade-in">
                  
                  {/* Card header */}
                  <div className="flex items-start justify-between border-b pb-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 block">TICKET INSPECTION</span>
                      <h2 className="text-lg font-display font-semibold text-slate-800 leading-tight mt-0.5">#{selectedReport.id.slice(0, 8)}</h2>
                    </div>
                    <button 
                      id="close-inspector-btn"
                      onClick={() => setSelectedReport(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded hover:bg-slate-100 transition"
                    >
                      Clear Selection
                    </button>
                  </div>

                  {/* Attachment Photo container */}
                  {selectedReport.photoUrl && (
                    <div className="w-full h-44 rounded-xl overflow-hidden border bg-slate-50 select-none relative">
                      <img src={selectedReport.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <a 
                        href={selectedReport.photoUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 bg-black/70 hover:bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-md transition"
                      >
                        🔍 Expand Image
                      </a>
                    </div>
                  )}

                  {/* Main Details Grid */}
                  <div className="space-y-4 text-xs font-semibold">
                    <div className="grid grid-cols-2 gap-4 border-b pb-3.5">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Incident Category</span>
                        <span className="text-slate-800">{selectedReport.category}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Assigned Branch</span>
                        <span className="text-slate-800">{selectedReport.responsible_department}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-b pb-3.5">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Severity / Urgency</span>
                        <div>{getSeverityBadge(selectedReport.severity)}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Public Support</span>
                        <span className="text-slate-800">{selectedReport.confirmations || 1} Citizen Support Signatures</span>
                      </div>
                    </div>

                    {selectedReport.location && (
                      <div className="border-b pb-3.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Exact Coordinates</span>
                        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                          <MapPin size={12} className="text-indigo-600" />
                          <span>Lat: {selectedReport.location.lat.toFixed(5)}, Lng: {selectedReport.location.lng.toFixed(5)}</span>
                        </div>
                      </div>
                    )}

                    <div className="border-b pb-3.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">User raw description</span>
                      <p className="text-slate-600 font-medium italic select-text">
                        "{selectedReport.userNotes || 'No notes description recorded.'}"
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1 mb-1">
                        <Sparkles size={11} /> AI generated Grievance letter
                      </span>
                      <p className="text-slate-700 bg-indigo-50/20 p-3 rounded-lg border border-indigo-100/40 select-text leading-relaxed font-mono text-[11px]">
                        {selectedReport.formal_complaint_text}
                      </p>
                    </div>
                  </div>

                  {/* Transition operations board */}
                  <div className="pt-3 border-t space-y-3.5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">DISPATCH TRANSITIONS</span>
                    
                    <div className="flex gap-2 flex-wrap text-xs">
                      <button 
                        id="status-reported-btn"
                        onClick={() => updateReportStatus(selectedReport.id, 'Reported')}
                        disabled={selectedReport.status === 'Reported'}
                        className={`flex-1 py-2 rounded-lg font-bold transition border ${selectedReport.status === 'Reported' ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-rose-200 hover:bg-rose-50 text-rose-700'}`}
                      >
                        Set Reported
                      </button>

                      <button 
                        id="status-review-btn"
                        onClick={() => updateReportStatus(selectedReport.id, 'Under Review')}
                        disabled={selectedReport.status === 'Under Review'}
                        className={`flex-1 py-2 rounded-lg font-bold transition border ${selectedReport.status === 'Under Review' ? 'bg-slate-100 border-slate-200 text-slate-400 animate-none' : 'bg-white border-blue-200 hover:bg-blue-50 text-blue-700'}`}
                      >
                        Under Review
                      </button>

                      <button 
                        id="status-resolved-btn"
                        onClick={() => updateReportStatus(selectedReport.id, 'Resolved')}
                        disabled={selectedReport.status === 'Resolved'}
                        className={`flex-1 py-2 rounded-lg font-bold transition border ${selectedReport.status === 'Resolved' ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-emerald-200 hover:bg-emerald-50 text-emerald-700'}`}
                      >
                        Set Resolved
                      </button>
                    </div>

                    <button 
                      id="admin-delete-btn"
                      onClick={() => handleDeleteReport(selectedReport.id)}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-display shadow hover:shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={13} /> Delete Incriminating File
                    </button>
                  </div>

                </div>
              ) : (
                <div id="inspector-placeholder" className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700">Audit Inspector</h3>
                    <p className="text-xs text-slate-400 max-w-[200px] mx-auto mt-1">Select any incident row on the left to verify details, send work permits and updates.</p>
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
