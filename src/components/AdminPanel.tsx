import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CivicReport, ReportStatus, CivicCategory, SeverityLevel } from '../types';
import { Trash2, AlertCircle, Clock, CheckCircle2, ChevronRight, Filter, Search, MapPin, Eye, FileSpreadsheet, Layers, Sparkles, Lock, ShieldAlert, UploadCloud, ShieldCheck, Camera, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminPanel() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<CivicReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Resolution verification state
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Resolution capture interactive states
  const [isCapturingResolution, setIsCapturingResolution] = useState<boolean>(false);
  const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(null);
  const [resolutionCoords, setResolutionCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Lock/PIN security controls
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('civora_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [shake, setShake] = useState<boolean>(false);

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

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (pin === '1234') {
      try {
        sessionStorage.setItem('civora_admin_unlocked', 'true');
      } catch (err) {
        console.warn('Session storage write failed.', err);
      }
      setIsUnlocked(true);
      setPinError(null);
      showAdminNotice('Administrator access granted. Dispatch Board unlocked.', 'success');
    } else {
      setPinError('Access denied: Invalid administrative PIN.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
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

  // Start webcam feed
  const startCamera = async () => {
    try {
      setCameraError(null);
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Webcam start failed:', err);
      setCameraError('Unable to open live camera. Please use file upload instead.');
      setIsCameraActive(false);
    }
  };

  // Stop webcam feed
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Capture image from live webcam
  const captureCameraPhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setResolutionPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  // Fetch coordinates using navigator.geolocation
  const captureGPS = () => {
    setGpsStatus('fetching');
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('HTML5 Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setResolutionCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsStatus('success');
      },
      (err) => {
        console.warn('GPS coordinates fetch error:', err);
        setGpsStatus('error');
        setGpsError(`GPS Access Denied: ${err.message}.`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Distance calculator
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Status transitions
  const updateReportStatus = async (reportId: string, nextStatus: ReportStatus) => {
    if (nextStatus === 'Resolved') {
      showAdminNotice('Resolved status requires a geo-tagged photograph audit. Please use the "Verify & Resolve" panel below.', 'error');
      return;
    }
    try {
      const docRef = doc(db, 'reports', reportId);
      await updateDoc(docRef, { status: nextStatus });
      showAdminNotice(`Status successfully updated to ${nextStatus}`, 'success');
    } catch (err: any) {
      showAdminNotice('Failed to update status: ' + err.message, 'error');
    }
  };

  // Perform resolution photo audit comparison using Gemini
  const submitResolutionAudit = async (report: CivicReport) => {
    if (!resolutionPhoto) {
      showAdminNotice('A resolution photograph is required for verification.', 'error');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      let gpsMetadata = null;
      if (resolutionCoords && report.location) {
        const dist = getDistanceInMeters(
          report.location.lat,
          report.location.lng,
          resolutionCoords.lat,
          resolutionCoords.lng
        );
        gpsMetadata = {
          distanceMeters: dist,
          beforeCoords: [report.location.lat, report.location.lng],
          afterCoords: [resolutionCoords.lat, resolutionCoords.lng]
        };
      }

      showAdminNotice('Submitting resolution photos and GPS audit metadata to Gemini...', 'info');

      // 1. Verify with server endpoint
      const verifyRes = await fetch('/api/verify-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beforeImage: report.photoUrl,
          afterImage: resolutionPhoto,
          category: report.category,
          gpsMetadata
        })
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        throw new Error(errData.details || errData.error || 'Resolution audit process failed.');
      }

      const verifyData = await verifyRes.json();

      // 2. Upload photo to get persistent URL
      showAdminNotice('Storing audited resolution image in community files...', 'info');
      const uploadRes = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: resolutionPhoto })
      });

      let resolutionPhotoUrl = resolutionPhoto;
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        resolutionPhotoUrl = uploadData.downloadUrl;
      }

      const docRef = doc(db, 'reports', report.id);
      
      if (verifyData.verified === 'verified') {
        await updateDoc(docRef, {
          resolutionPhotoUrl,
          resolutionVerified: 'verified',
          resolutionConfidence: verifyData.confidence,
          resolutionExplanation: verifyData.explanation,
          status: 'Resolved'
        });
        showAdminNotice('Civic issue successfully verified and marked as Resolved!', 'success');
        
        // Reset local resolution states
        setIsCapturingResolution(false);
        setResolutionPhoto(null);
        setResolutionCoords(null);
        setGpsStatus('idle');
      } else {
        // Unresolved / Failed Audit! Keep current status (do NOT mark as resolved)
        await updateDoc(docRef, {
          resolutionPhotoUrl,
          resolutionVerified: 'unresolved',
          resolutionConfidence: verifyData.confidence,
          resolutionExplanation: verifyData.explanation
        });
        setVerificationError(`AI Audit Rejected: ${verifyData.explanation} (Confidence: ${verifyData.confidence}%)`);
        showAdminNotice('Audit Rejected: The repair work has been flagged as incomplete or unresolved.', 'error');
      }

    } catch (err: any) {
      console.error('Audit error:', err);
      setVerificationError(err?.message || 'Verification audit encountered an error.');
      showAdminNotice('Resolution verification failed: ' + (err?.message || err), 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handles standard file uploads to set local resolutionPhoto state
  const handleResolutionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setResolutionPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
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
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
            <span className="severity-dot severity-dot-high !w-[6px] !h-[6px]" />
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
            <span className="severity-dot severity-dot-medium !w-[6px] !h-[6px]" />
            Medium
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
            <span className="severity-dot severity-dot-low !w-[6px] !h-[6px]" />
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Reported':
        return (
          <span className="status-reported inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold leading-none">
            <Clock size={10} /> Reported
          </span>
        );
      case 'Under Review':
        return (
          <span className="status-review inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold leading-none animate-pulse">
            <AlertCircle size={10} /> Under Review
          </span>
        );
      case 'Resolved':
        return (
          <span className="status-resolved inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold leading-none">
            <CheckCircle2 size={10} /> Resolved
          </span>
        );
    }
  };

  if (!isUnlocked) {
    return (
      <div className="bg-[#05070c] min-h-[85vh] font-sans relative flex items-center justify-center p-4">
        {/* Decorative aurora orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-[120px] pointer-events-none animate-glow-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-glow-pulse delay-200" />
        
        {/* Ambient grid background matching the main app */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

        <div 
          id="pin-lock-container"
          className={`glass-heavy gradient-border max-w-sm w-full rounded-3xl p-6 md:p-8 text-center shadow-2xl relative overflow-hidden transition-all duration-300 ${shake ? 'animate-shake border-rose-500/30' : ''}`}
        >
          {/* Top Lock Badge */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-rose-500/10 border border-violet-500/20 flex items-center justify-center mb-6 shadow-inner relative group">
            <Lock size={24} className="text-violet-400 group-hover:scale-110 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border border-black" />
          </div>

          <div className="space-y-2 mb-6">
            <span className="text-[10px] uppercase font-black tracking-widest text-violet-300 bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 px-3 py-1 rounded-full inline-block">
              Secured Dispatch Command
            </span>
            <h2 className="text-lg font-display font-bold text-white tracking-tight pt-1">
              Administrator Verification
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto font-medium">
              Please enter the 4-digit administrative security code to coordinate municipal operations.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-5">
            {/* Dots Display */}
            <div className="flex justify-center gap-3.5 py-2">
              {[0, 1, 2, 3].map((index) => (
                <div 
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    pin.length > index 
                      ? 'bg-gradient-to-r from-violet-500 to-cyan-400 border-transparent scale-110 shadow-[0_0_10px_rgba(139,92,246,0.5)]' 
                      : 'border-white/20 bg-slate-950/40'
                  }`}
                />
              ))}
            </div>

            {/* Hidden actual input (for keyboard support) */}
            <input 
              id="admin-pin-hidden-input"
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 4) setPin(val);
              }}
              placeholder="••••"
              className="sr-only"
              autoFocus
            />

            {/* Simulated Keyboard Access or Direct View */}
            <div className="relative">
              <input 
                id="admin-pin-display-input"
                type="password"
                maxLength={4}
                value={pin}
                readOnly
                placeholder="Enter PIN"
                className="w-full text-center tracking-[0.75em] text-sm font-bold py-2.5 px-4 rounded-xl glass-card text-white placeholder-slate-600 outline-none border border-white/5 focus:border-violet-500/30 transition shadow-inner cursor-pointer"
                onClick={() => {
                  const el = document.getElementById('admin-pin-hidden-input');
                  if (el) el.focus();
                }}
              />
            </div>

            {pinError && (
              <p className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 px-3 animate-fade-in flex items-center justify-center gap-1.5">
                <ShieldAlert size={12} className="shrink-0" /> {pinError}
              </p>
            )}

            {/* Custom interactive keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1 text-xs">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  id={`numpad-btn-${num}`}
                  key={num}
                  type="button"
                  onClick={() => {
                    if (pin.length < 4) {
                      setPin(prev => prev + num);
                      setPinError(null);
                    }
                  }}
                  className="py-2.5 rounded-xl glass-card text-xs text-white font-bold hover:bg-white/10 active:scale-95 transition cursor-pointer select-none"
                >
                  {num}
                </button>
              ))}
              <button
                id="numpad-btn-clear"
                type="button"
                onClick={() => {
                  setPin('');
                  setPinError(null);
                }}
                className="py-2.5 rounded-xl glass-card text-[10px] text-slate-400 font-extrabold hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition cursor-pointer select-none"
              >
                Clear
              </button>
              <button
                id="numpad-btn-0"
                type="button"
                onClick={() => {
                  if (pin.length < 4) {
                    setPin(prev => prev + '0');
                    setPinError(null);
                  }
                }}
                className="py-2.5 rounded-xl glass-card text-xs text-white font-bold hover:bg-white/10 active:scale-95 transition cursor-pointer select-none"
              >
                0
              </button>
              <button
                id="numpad-btn-enter"
                type="submit"
                className="py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-[10px] text-white font-extrabold hover:brightness-110 active:scale-95 transition cursor-pointer select-none flex items-center justify-center shadow-lg shadow-violet-500/20"
              >
                Unlock
              </button>
            </div>

            {/* Helper Hint */}
            <div className="pt-2 text-[10px] text-slate-500 font-semibold tracking-wide">
              🔑 <span className="font-extrabold text-slate-400">HINT:</span> ADMIN DEFAULT PIN IS <span className="font-mono bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-slate-300 font-bold">1234</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent min-h-screen font-sans relative pb-12">
      {/* Dynamic Non-blocking alert notice banner */}
      {adminNotice && (
        <div className={`glass-heavy fixed top-6 right-6 z-[9999] max-w-md p-4.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-start gap-3.5 animate-fade-in-up ${
          adminNotice.type === 'error' ? 'border-l-2 border-l-rose-400' :
          adminNotice.type === 'success' ? 'border-l-2 border-l-emerald-400' :
          'border-l-2 border-l-violet-400'
        }`}>
          <span className="text-[15px] leading-none">{adminNotice.type === 'error' ? '⚠️' : adminNotice.type === 'success' ? '✅' : 'ℹ️'}</span>
          <div className={`flex-1 leading-relaxed ${
            adminNotice.type === 'error' ? 'text-rose-200' :
            adminNotice.type === 'success' ? 'text-emerald-300' :
            'text-violet-300'
          }`}>{adminNotice.message}</div>
          <button className="text-[14px] leading-none font-bold hover:opacity-75 p-1 hover:bg-white/10 rounded cursor-pointer text-slate-400 hover:text-white transition" onClick={() => setAdminNotice(null)}>×</button>
        </div>
      )}

      {/* Banner / stats */}
      <div id="admin-header" className="glass-heavy text-white py-10 px-6 md:px-12 border-b border-white/5 relative overflow-hidden">
        {/* Aurora decorative orbs */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-violet-500/15 rounded-full blur-[100px] pointer-events-none animate-glow-pulse" />
        <div className="absolute -bottom-16 right-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-glow-pulse delay-200" />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-violet-300 bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 px-3 py-1 rounded-full inline-block">Dispatch Command Panel</span>
            <h1 className="text-2xl md:text-3xl text-gradient-aurora font-display font-bold tracking-tight mt-3">Grievance Dashboard</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl leading-relaxed">Review cataloged community incidents, authorize municipal work orders, and coordinate department responses in real-time.</p>
          </div>
          
          {/* Quick Counter widgets */}
          <div className="grid grid-cols-3 gap-3 max-w-sm w-full">
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                <Layers size={14} className="text-violet-400" />
              </div>
              <span className="block text-2xl font-black text-white animate-count-up">{reports.length}</span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block mt-0.5">Total</span>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/10 flex items-center justify-center">
                <AlertCircle size={14} className="text-rose-400" />
              </div>
              <span className="block text-2xl font-black text-rose-400 animate-count-up">
                {reports.filter(r => r.status === 'Reported').length}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold block mt-0.5">New</span>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <span className="block text-2xl font-black text-emerald-400 animate-count-up">
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
            <div className="glass rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                <input 
                  id="admin-search"
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Query department, keywords, category or ticket text..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs glass-card text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition duration-150"
                />
              </div>

              {/* Status and category dropdowns */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <Filter size={14} className="text-violet-400 hidden md:block shrink-0" />
                <select 
                  id="status-filter"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="glass px-3 py-2.5 rounded-xl text-sm text-white font-bold flex-1 md:flex-none cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition"
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
                  className="glass px-3 py-2.5 rounded-xl text-sm text-white font-bold flex-1 md:flex-none cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition"
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
              <div className="glass p-20 text-center rounded-3xl space-y-4">
                {/* Orbital loader */}
                <div className="relative w-12 h-12 mx-auto flex items-center justify-center">
                  <span className="absolute w-full h-full rounded-full border border-violet-500/20" />
                  <span className="absolute w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 animate-orbit" />
                  <span className="absolute w-2 h-2 rounded-full bg-violet-400/60 animate-orbit" style={{ animationDelay: '0.5s', animationDuration: '2s' }} />
                  <span className="absolute w-6 h-6 rounded-full border border-cyan-500/15 animate-pulse-ring" />
                </div>
                <p className="text-xs text-slate-400 font-extrabold tracking-wider uppercase animate-fade-in-up">Sifting record logs...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="glass p-16 text-center rounded-3xl space-y-4">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500/15 to-cyan-500/15 border border-violet-500/10 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <Layers size={22} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-sm">No Matches in Log</h3>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">No reports matching your search or filters are currently available.</p>
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
                      className={`group glass-card p-4 rounded-2xl transition-all duration-300 cursor-pointer flex items-center gap-4.5 ${selectedReport?.id === report.id ? 'ring-1 ring-violet-500/40 bg-violet-500/5 shadow-lg shadow-violet-500/10' : 'hover:shadow-2xl'}`}
                    >
                      {/* Avatar/Image */}
                      {report.photoUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-white/5 group-hover:border-violet-500/20 transition-colors duration-300">
                          <img src={report.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-355" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5 text-slate-400 group-hover:border-violet-500/20 transition-colors duration-300">
                          <Layers size={20} />
                        </div>
                      )}

                      {/* Summary */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-display font-bold text-white text-[14px] leading-tight group-hover:text-violet-400 transition">{report.category}</h3>
                          <span className="text-white/10 text-xs hidden sm:inline">|</span>
                          <span className="text-[10px] text-slate-500 font-extrabold tracking-wide uppercase">{dateStr}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-1 italic leading-relaxed">
                          "{report.userNotes || 'No notes description recorded. Read the formal text.'}"
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-violet-400 bg-violet-950/50 border border-violet-900/30 px-2.5 py-0.5 rounded-full">
                            💼 {report.responsible_department}
                          </span>
                          <span className="text-[10px] text-slate-500 font-extrabold">
                            🎯 {report.confirmations || 1} support votes
                          </span>
                        </div>
                      </div>

                      {/* Right metadata badge indicators */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {getSeverityBadge(report.severity)}
                        <div className="flex items-center gap-1 text-[11px]">
                          {getStatusBadge(report.status)}
                          <ChevronRight size={14} className="text-slate-500 group-hover:translate-x-0.5 group-hover:rotate-12 transition-transform duration-300" />
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
                <div id="inspector-card" className="glass-heavy rounded-3xl shadow-2xl p-6 flex flex-col space-y-5 animate-fade-in-up relative overflow-hidden">
                  {/* Decorative aurora orbs */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/8 rounded-full blur-3xl pointer-events-none animate-glow-pulse" />
                  <div className="absolute bottom-10 -left-10 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none animate-glow-pulse delay-300" />
                  
                  {/* Card header */}
                  <div className="flex items-start justify-between border-b border-white/5 pb-4 relative">
                    <div>
                      <span className="text-[9px] uppercase font-black tracking-widest text-violet-300 block bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 px-2.5 py-1 rounded-full w-fit">Ticket Auditor</span>
                      <h2 className="text-lg font-display font-extrabold text-white mt-2 leading-none">ID: {selectedReport.id.slice(0, 8).toUpperCase()}</h2>
                    </div>
                    <button 
                      id="close-inspector-btn"
                      onClick={() => setSelectedReport(null)}
                      className="glass text-[10px] uppercase font-bold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Attachment Photo container */}
                  {selectedReport.photoUrl && (
                    <div className="w-full h-44 rounded-2xl overflow-hidden border border-white/5 bg-slate-950 select-none relative group shadow-sm">
                      <img src={selectedReport.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" referrerPolicy="no-referrer" />
                      {/* Gradient overlay */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#06080f]/80 to-transparent pointer-events-none" />
                      <a 
                        href={selectedReport.photoUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 glass text-white text-[9px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-xl shadow-lg transition hover:border-violet-500/20"
                      >
                        Expand View
                      </a>
                    </div>
                  )}

                  {/* Main Details Grid */}
                  <div className="space-y-4 text-xs font-semibold relative">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass-card rounded-xl p-3">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Incident Category</span>
                        <span className="text-white font-extrabold text-[13px]">{selectedReport.category}</span>
                      </div>
                      <div className="glass-card rounded-xl p-3">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Assigned Branch</span>
                        <span className="text-white font-extrabold text-[13px]">{selectedReport.responsible_department}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass-card rounded-xl p-3">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Severity / Urgency</span>
                        <div className="mt-1">{getSeverityBadge(selectedReport.severity)}</div>
                      </div>
                      <div className="glass-card rounded-xl p-3">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Public Support</span>
                        <span className="text-white font-extrabold block mt-1">{selectedReport.confirmations || 1} Backing Citizens</span>
                      </div>
                    </div>

                    {selectedReport.location && (
                      <div className="glass-card rounded-xl p-3">
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Coordinates</span>
                        <div className="flex items-center gap-1.5 glass rounded-lg font-mono text-[11px] text-slate-300 p-2 mt-1">
                          <MapPin size={11} className="text-violet-400 shrink-0" />
                          <span>Lat: {selectedReport.location.lat.toFixed(5)}, Lng: {selectedReport.location.lng.toFixed(5)}</span>
                        </div>
                      </div>
                    )}

                    <div className="glass-card rounded-xl p-3">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Raw User Description</span>
                      <p className="text-slate-300 font-medium italic select-text glass rounded-lg p-3 mt-1 leading-relaxed border-violet-500/10">
                        "{selectedReport.userNotes || 'No notes description recorded.'}"
                      </p>
                    </div>

                    <div className="glass-card rounded-xl p-3">
                      <span className="text-[9px] uppercase tracking-wider text-violet-400 font-black flex items-center gap-1 mb-1">
                        <Sparkles size={11} /> formal municipal grievance letter
                      </span>
                      <p className="text-slate-300 glass rounded-xl p-4 select-text leading-relaxed font-mono text-[11px] max-h-[140px] overflow-y-auto font-medium border-violet-500/10 mt-1">
                        {selectedReport.formal_complaint_text}
                      </p>
                    </div>

                    {/* Secure Resolution Verification Flow or Completed Audit board */}
                    {isCapturingResolution ? (
                      /* ACTIVE VERIFICATION PORTAL */
                      <div id="resolution-capture-portal" className="glass-card rounded-2xl p-4 border border-cyan-500/30 relative overflow-hidden space-y-4 animate-fade-in">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-[10px] uppercase font-black tracking-wider text-cyan-400 flex items-center gap-1.5">
                            <ShieldCheck size={13} className="text-cyan-400" /> Resolution Dispatch Audit
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCapturingResolution(false);
                              setResolutionPhoto(null);
                              setResolutionCoords(null);
                              setGpsStatus('idle');
                              setGpsError(null);
                              stopCamera();
                            }}
                            className="text-[9px] uppercase font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 transition"
                          >
                            Cancel
                          </button>
                        </div>

                        <p className="text-slate-400 text-[10.5px] leading-relaxed font-medium">
                          To successfully resolve this incident, you must supply a geo-tagged photograph at the repair site. Gemini will inspect it against the original report to verify the fix.
                        </p>

                        {/* STEP 1: Geotag verification */}
                        <div className="space-y-2">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block">Step 1: Location Verification</span>
                          <div className="glass-card rounded-xl p-3 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                                <MapPin size={11} className="text-cyan-400" /> Site Coordinates
                              </span>
                              {gpsStatus === 'fetching' ? (
                                <span className="text-[9px] text-cyan-400 font-bold animate-pulse flex items-center gap-1">
                                  <RefreshCw size={8} className="animate-spin" /> Fetching GPS...
                                </span>
                              ) : gpsStatus === 'success' ? (
                                <span className="text-[9px] text-emerald-400 font-bold">✓ Geotagged</span>
                              ) : gpsStatus === 'error' ? (
                                <span className="text-[9px] text-rose-400 font-bold">⚠️ GPS Offline</span>
                              ) : (
                                <span className="text-[9px] text-slate-500 font-bold">Pending Lock</span>
                              )}
                            </div>

                            {resolutionCoords ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2 bg-slate-950/40 rounded-lg text-slate-300 border border-white/5">
                                  <div>
                                    <span className="text-[8px] text-slate-500 block">Capture Latitude</span>
                                    <span>{resolutionCoords.lat.toFixed(5)}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-slate-500 block">Capture Longitude</span>
                                    <span>{resolutionCoords.lng.toFixed(5)}</span>
                                  </div>
                                </div>
                                
                                {selectedReport.location && (() => {
                                  const dist = getDistanceInMeters(
                                    selectedReport.location.lat,
                                    selectedReport.location.lng,
                                    resolutionCoords.lat,
                                    resolutionCoords.lng
                                  );
                                  const isClose = dist <= 150;
                                  return (
                                    <div className={`p-2 rounded-lg border text-[10.5px] font-semibold flex items-start gap-1.5 ${
                                      isClose 
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                    }`}>
                                      <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                                      <div>
                                        Distance: <span className="font-extrabold">{dist.toFixed(1)} meters</span> from reported issue.
                                        <span className="block text-[8.5px] opacity-75 mt-0.5">
                                          {isClose ? '✓ Secure operator location validated.' : '⚠️ Warning: Operator position is offset from original issue.'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={captureGPS}
                                className="w-full py-2 bg-gradient-to-r from-cyan-950 to-violet-950 hover:brightness-110 border border-cyan-500/30 text-cyan-300 rounded-xl text-[10.5px] font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                              >
                                <MapPin size={11} /> Request Current Geotag Coordinates
                              </button>
                            )}
                            {gpsError && (
                              <p className="text-[9px] text-amber-400 font-semibold bg-amber-500/5 border border-amber-500/10 rounded p-1.5">
                                ⚠️ Geolocation bypass enabled. You may still proceed with photograph submission.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* STEP 2: Photograph Capture / Upload */}
                        <div className="space-y-2">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block">Step 2: Photographic Proof</span>
                          
                          {resolutionPhoto ? (
                            /* Photo captured preview */
                            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-slate-950">
                              <img src={resolutionPhoto} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => setResolutionPhoto(null)}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition"
                                >
                                  Retake / Remove Photo
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Live camera or upload selector */
                            <div className="space-y-2">
                              {isCameraActive ? (
                                <div className="relative rounded-xl overflow-hidden border border-violet-500/20 bg-slate-950 aspect-video flex flex-col justify-end">
                                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                                  <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={captureCameraPhoto}
                                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-[10.5px] font-bold shadow-lg transition active:scale-95"
                                    >
                                      📸 Snap Photo
                                    </button>
                                    <button
                                      type="button"
                                      onClick={stopCamera}
                                      className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10.5px] font-bold transition"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {/* Direct Camera Button */}
                                  <button
                                    type="button"
                                    onClick={startCamera}
                                    className="flex flex-col items-center justify-center border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl p-4 transition group text-center cursor-pointer"
                                  >
                                    <Camera size={20} className="text-slate-400 group-hover:text-violet-400 transition mb-1.5" />
                                    <span className="text-[10px] text-slate-300 font-bold">Use Live Camera</span>
                                  </button>

                                  {/* File Upload Button */}
                                  <label className="flex flex-col items-center justify-center border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] rounded-xl p-4 transition group text-center cursor-pointer">
                                    <UploadCloud size={20} className="text-slate-400 group-hover:text-cyan-400 transition mb-1.5" />
                                    <span className="text-[10px] text-slate-300 font-bold">Upload After Photo</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleResolutionFileChange}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              )}
                              {cameraError && <p className="text-[9px] text-rose-400 font-medium">{cameraError}</p>}
                            </div>
                          )}
                        </div>

                        {/* Audit Verification trigger */}
                        <div className="pt-2 border-t border-white/5 space-y-2">
                          {isVerifying ? (
                            <div className="space-y-2 py-2 text-center">
                              <div className="relative w-7 h-7 mx-auto flex items-center justify-center">
                                <span className="absolute w-full h-full rounded-full border border-cyan-500/20" />
                                <span className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 animate-orbit" />
                              </div>
                              <p className="text-[10px] text-cyan-300 font-bold tracking-wider uppercase animate-pulse">
                                Gemini Analyzing Photographs & GPS...
                              </p>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => submitResolutionAudit(selectedReport)}
                              disabled={!resolutionPhoto}
                              className={`w-full py-2.5 rounded-xl text-xs font-bold font-display shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                resolutionPhoto 
                                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:brightness-110 text-white shadow-emerald-500/10' 
                                  : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                              }`}
                            >
                              <ShieldCheck size={13} /> Submit Resolution for AI Audit
                            </button>
                          )}

                          {verificationError && (
                            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-1 animate-fade-in">
                              <span className="text-[10px] font-bold flex items-center gap-1">
                                <AlertTriangle size={11} /> Verification Failure
                              </span>
                              <p className="text-[9.5px] leading-normal font-medium opacity-90">{verificationError}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* AUDIT BOARD VIEW (Either Resolved or Not Resolved) */
                      selectedReport.status === 'Resolved' && (
                        <div id="resolution-verification-panel" className="glass-card rounded-xl p-4 border border-violet-500/20 relative overflow-hidden space-y-3.5 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <ShieldCheck size={12} className="text-emerald-400" /> Civora Resolution Auditor
                            </span>
                            {selectedReport.resolutionConfidence !== undefined && (
                              <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full">
                                {selectedReport.resolutionConfidence}% Match
                              </span>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              {selectedReport.resolutionVerified === 'verified' ? (
                                <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-xs font-bold">
                                  ✅ Verified Fixed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-xl text-xs font-bold">
                                  ⚠️ Not yet resolved, still visible
                                </span>
                              )}
                            </div>

                            {/* Comparison Photos view side by side */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <span className="text-[8px] uppercase tracking-wider text-slate-500 font-black block mb-1">Before photo</span>
                                <div className="h-24 rounded-lg overflow-hidden border border-white/5 bg-slate-950 relative group">
                                  <img src={selectedReport.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                              </div>
                              <div>
                                <span className="text-[8px] uppercase tracking-wider text-slate-500 font-black block mb-1">After photo</span>
                                <div className="h-24 rounded-lg overflow-hidden border border-white/5 bg-slate-950 relative group">
                                  <img src={selectedReport.resolutionPhotoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                              </div>
                            </div>

                            <div className="glass rounded-xl p-3 bg-white/[0.01]">
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold block mb-1">Auditor Verdict Details</span>
                              <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
                                {selectedReport.resolutionExplanation}
                              </p>
                            </div>

                            {/* Option to re-verify / re-upload */}
                            <div className="pt-1.5 flex justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCapturingResolution(true);
                                  setResolutionPhoto(null);
                                  setResolutionCoords(null);
                                  setGpsStatus('idle');
                                  setGpsError(null);
                                }}
                                className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                              >
                                <UploadCloud size={11} /> Re-verify / Upload New Proof
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Transition operations board (Hides during active resolution capture to avoid confusion) */}
                  {!isCapturingResolution && (
                    <div className="pt-4 border-t border-white/5 space-y-4 relative">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black block">Status dispatch controls</span>
                      
                      <div className="flex gap-2 flex-wrap text-xs">
                        <button 
                          id="status-reported-btn"
                          onClick={() => updateReportStatus(selectedReport.id, 'Reported')}
                          disabled={selectedReport.status === 'Reported'}
                          className={`flex-1 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${selectedReport.status === 'Reported' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white cursor-not-allowed opacity-70' : 'glass hover:bg-rose-500/10 hover:border-rose-500/20 text-rose-400 active:scale-95'}`}
                        >
                          Reported
                        </button>

                        <button 
                          id="status-review-btn"
                          onClick={() => updateReportStatus(selectedReport.id, 'Under Review')}
                          disabled={selectedReport.status === 'Under Review'}
                          className={`flex-1 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${selectedReport.status === 'Under Review' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white cursor-not-allowed opacity-70' : 'glass hover:bg-cyan-500/10 hover:border-cyan-500/20 text-cyan-400 active:scale-95'}`}
                        >
                          In Review
                        </button>

                        <button 
                          id="status-resolved-btn"
                          onClick={() => {
                            setIsCapturingResolution(true);
                            setResolutionPhoto(null);
                            setResolutionCoords(null);
                            setGpsStatus('idle');
                            setGpsError(null);
                          }}
                          disabled={selectedReport.status === 'Resolved'}
                          className={`flex-1 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${selectedReport.status === 'Resolved' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white cursor-not-allowed opacity-70' : 'glass hover:bg-emerald-500/10 hover:border-emerald-500/20 text-emerald-400 active:scale-95'}`}
                        >
                          Verify & Resolve
                        </button>
                      </div>

                      <button 
                        id="admin-delete-btn"
                        onClick={() => handleDeleteReport(selectedReport.id)}
                        className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl text-xs font-bold font-display shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={13} /> Purge Public File
                      </button>
                    </div>
                  )}

                </div>
              ) : (
                <div id="inspector-placeholder" className="glass-heavy rounded-3xl shadow-2xl p-8 text-center space-y-3.5">
                  <div className="w-14 h-14 bg-gradient-to-br from-violet-500/15 to-cyan-500/15 border border-violet-500/10 rounded-2xl flex items-center justify-center mx-auto text-violet-400 shadow-inner">
                    <Eye size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white text-sm">Audit Inspector</h3>
                    <p className="text-xs text-slate-400 max-w-[200px] mx-auto mt-1 leading-relaxed">Select any reported incident card on the left list to evaluate, audit status, or dispatch action orders.</p>
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
