import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Maximize2, MapPin, RefreshCw, ShieldCheck, 
  Camera, UploadCloud, AlertTriangle, Trash2 
} from 'lucide-react';
import { CivicReport, ReportStatus } from '../types';

interface ReportSidebarProps {
  selectedReport: CivicReport | null;
  setSelectedReport: (report: CivicReport | null) => void;
  isCapturingResolution: boolean;
  setIsCapturingResolution: (val: boolean) => void;
  resolutionPhoto: string | null;
  setResolutionPhoto: (val: string | null) => void;
  resolutionCoords: { lat: number; lng: number } | null;
  setResolutionCoords: (val: { lat: number; lng: number } | null) => void;
  gpsStatus: 'idle' | 'fetching' | 'success' | 'error';
  setGpsStatus: (val: 'idle' | 'fetching' | 'success' | 'error') => void;
  gpsError: string | null;
  setGpsError: (val: string | null) => void;
  cameraError: string | null;
  setCameraError: (val: string | null) => void;
  isCameraActive: boolean;
  setIsCameraActive: (val: boolean) => void;
  isVerifying: boolean;
  setIsVerifying: (val: boolean) => void;
  verificationError: string | null;
  setVerificationError: (val: string | null) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captureGPS: () => void;
  startCamera: () => void;
  stopCamera: () => void;
  captureCameraPhoto: () => void;
  handleResolutionFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  submitResolutionAudit: (report: CivicReport) => Promise<void>;
  updateReportStatus: (id: string, status: ReportStatus) => void;
  handleDeleteReport: (id: string, bypassConfirm?: boolean) => void;
  getCategoryPattern: (category: string) => string;
  getStatusBadge: (status: ReportStatus) => React.ReactNode;
  getDistanceInMeters: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export const ReportSidebar: React.FC<ReportSidebarProps> = ({
  selectedReport,
  setSelectedReport,
  isCapturingResolution,
  setIsCapturingResolution,
  resolutionPhoto,
  setResolutionPhoto,
  resolutionCoords,
  setResolutionCoords,
  gpsStatus,
  setGpsStatus,
  gpsError,
  setGpsError,
  cameraError,
  setCameraError,
  isCameraActive,
  setIsCameraActive,
  isVerifying,
  setIsVerifying,
  verificationError,
  setVerificationError,
  videoRef,
  captureGPS,
  startCamera,
  stopCamera,
  captureCameraPhoto,
  handleResolutionFileChange,
  submitResolutionAudit,
  updateReportStatus,
  handleDeleteReport,
  getCategoryPattern,
  getStatusBadge,
  getDistanceInMeters
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset confirmation state when report changes
  React.useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedReport?.id]);

  return (
    <AnimatePresence>
      {selectedReport && (
        <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSelectedReport(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />

          {/* Sidebar Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-[480px] bg-white h-screen shadow-2xl flex flex-col z-[1010] border-l border-[#E2E8F0]"
          >
            {/* Header Section */}
            <div className="flex items-start justify-between border-b border-[#EEF1F6] pb-4 px-6 pt-6 bg-slate-50">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-[#8A93A5] block">TICKET INSPECTION</span>
                <h2 className="text-xl font-bold text-[#0F1A3D] mt-0.5">CV-{selectedReport.id.slice(0, 4).toUpperCase()}</h2>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="bg-[#F1F3F7] hover:bg-[#E2E8F0] text-[#4A5568] px-3 py-1.5 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X size={14} /> Clear selection
              </button>
            </div>

            {/* Main Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* visual card/pattern container */}
              <div className="w-full h-44 rounded-2xl overflow-hidden border border-[#E2E8F0] select-none relative group shadow-sm bg-slate-50">
                {selectedReport.photoUrl ? (
                  <img src={selectedReport.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div 
                    className="w-full h-full animate-pulse" 
                    style={{ background: getCategoryPattern(selectedReport.category) }} 
                  />
                )}
                <a 
                  href={selectedReport.photoUrl || '#'} 
                  target="_blank" 
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!selectedReport.photoUrl) e.preventDefault();
                  }}
                  className="absolute bottom-3 right-3 bg-white hover:bg-slate-50 text-[#0F1A3D] text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-md border border-[#E2E8F0] transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 size={11} /> Expand view
                </a>
              </div>

              {/* Title block */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#0F1A3D] leading-tight">{selectedReport.category}</h1>
                  <p className="text-sm text-[#5C6479] font-medium mt-0.5">{selectedReport.responsible_department}</p>
                </div>
                <div className="shrink-0 mt-1">
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#FAFAFA] border border-[#EEF1F6] rounded-2xl p-4 text-center flex flex-col justify-center items-center shadow-sm">
                  <span className="text-[10px] text-[#8A93A5] font-extrabold uppercase tracking-wider block mb-1">Severity</span>
                  <span className={`text-[14px] font-extrabold ${
                    selectedReport.severity === 'High' ? 'text-[#D03B43]' :
                    selectedReport.severity === 'Medium' ? 'text-[#C47417]' :
                    'text-[#4A5568]'
                  }`}>{selectedReport.severity}</span>
                </div>
                <div className="bg-[#FAFAFA] border border-[#EEF1F6] rounded-2xl p-4 text-center flex flex-col justify-center items-center shadow-sm">
                  <span className="text-[10px] text-[#8A93A5] font-extrabold uppercase tracking-wider block mb-1">Support</span>
                  <span className="text-[#0F1A3D] font-extrabold text-[15px]">{selectedReport.confirmations || 1}</span>
                </div>
                <div className="bg-[#FAFAFA] border border-[#EEF1F6] rounded-2xl p-4 text-center flex flex-col justify-center items-center shadow-sm">
                  <span className="text-[10px] text-[#8A93A5] font-extrabold uppercase tracking-wider block mb-1">Ward</span>
                  <span className="text-[#0F1A3D] font-extrabold text-[15px]">{((selectedReport.id.charCodeAt(0) + selectedReport.id.charCodeAt(selectedReport.id.length - 1)) % 15) + 1}</span>
                </div>
              </div>

              {/* Coordinates Section */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#8A93A5] tracking-wider block">COORDINATES</span>
                {selectedReport.location ? (
                  <p className="text-[13px] font-bold text-[#4A5568] font-mono">
                    {selectedReport.location.lat.toFixed(4)}° N, {selectedReport.location.lng.toFixed(4)}° E
                  </p>
                ) : (
                  <p className="text-[13px] font-bold text-[#4A5568] font-mono">Not Recorded</p>
                )}
              </div>

              {/* Description / Notes */}
              <div className="space-y-1.5">
                <p className="text-[14px] text-[#5C6479] italic leading-relaxed font-sans">
                  "{selectedReport.userNotes || 'No notes description recorded.'}"
                </p>
              </div>

              {/* Formal Municipal Grievance letter if present */}
              {selectedReport.formal_complaint_text && (
                <div className="bg-[#FAFAFA] border border-[#EEF1F6] rounded-2xl p-4">
                  <span className="text-[10px] uppercase font-bold text-[#8A93A5] tracking-wider block mb-2">Formal Grievance Text</span>
                  <p className="text-[12px] text-[#4A5568] font-mono leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                    {selectedReport.formal_complaint_text}
                  </p>
                </div>
              )}

              {/* Resolution workflow card */}
              <div className="bg-[#F8FAFC] border border-dashed border-[#CBD5E0] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[14px] font-bold text-[#0F1A3D]">Resolution workflow</h4>
                    <p className="text-xs text-[#718096] mt-0.5">Capture proof of work, then run AI verification.</p>
                  </div>
                </div>

                {isCapturingResolution ? (
                  <div className="space-y-4 border-t border-[#EEF1F6] pt-4 animate-fade-in">
                    {/* STEP 1: Geotag verification */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-wider text-[#8A93A5] font-extrabold block">Step 1: Location Verification</span>
                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#4A5568] font-bold flex items-center gap-1">
                            <MapPin size={11} className="text-[#244BD6]" /> Site Coordinates
                          </span>
                          {gpsStatus === 'fetching' ? (
                            <span className="text-[10px] text-[#244BD6] font-bold animate-pulse flex items-center gap-1">
                              <RefreshCw size={10} className="animate-spin" /> Fetching GPS...
                            </span>
                          ) : gpsStatus === 'success' ? (
                            <span className="text-[10px] text-emerald-600 font-bold">✓ Geotagged</span>
                          ) : gpsStatus === 'error' ? (
                            <span className="text-[10px] text-rose-600 font-bold">⚠️ GPS Offline</span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold">Pending Lock</span>
                          )}
                        </div>

                        {resolutionCoords ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2 bg-slate-50 rounded-lg text-slate-600 border border-[#E2E8F0]">
                              <div>
                                <span className="text-[8px] text-slate-400 block uppercase">Capture Latitude</span>
                                <span>{resolutionCoords.lat.toFixed(5)}</span>
                              </div>
                              <div>
                                <span className="text-[8px] text-slate-400 block uppercase">Capture Longitude</span>
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
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                    : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                  <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                                  <div>
                                    Distance: <span className="font-extrabold">{dist.toFixed(1)} meters</span> from reported issue.
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={captureGPS}
                            className="w-full py-2 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F1A3D] rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <MapPin size={11} /> Request Current Geotag Coordinates
                          </button>
                        )}
                      </div>
                    </div>

                    {/* STEP 2: Photograph Capture / Upload */}
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase tracking-wider text-[#8A93A5] font-extrabold block">Step 2: Photographic Proof</span>
                      
                      {resolutionPhoto ? (
                        <div className="relative rounded-xl overflow-hidden border border-[#E2E8F0] aspect-video bg-slate-50">
                          <img src={resolutionPhoto} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => setResolutionPhoto(null)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Retake / Remove Photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {isCameraActive ? (
                            <div className="relative rounded-xl overflow-hidden border border-violet-200 bg-black aspect-video flex flex-col justify-end">
                              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                              <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={captureCameraPhoto}
                                  className="px-3.5 py-1.5 bg-[#244BD6] text-white rounded-lg text-[11px] font-bold shadow-lg transition active:scale-95 cursor-pointer"
                                >
                                  📸 Snap Photo
                                </button>
                                <button
                                  type="button"
                                  onClick={stopCamera}
                                  className="px-3.5 py-1.5 bg-white/20 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                                >
                                  Cancel
                                  </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={startCamera}
                                className="flex flex-col items-center justify-center border border-[#E2E8F0] bg-white hover:bg-slate-50 rounded-xl p-4 transition group text-center cursor-pointer shadow-sm"
                              >
                                <Camera size={20} className="text-slate-400 group-hover:text-[#244BD6] transition mb-1.5" />
                                <span className="text-[11px] text-slate-700 font-bold">Use Live Camera</span>
                              </button>

                              <label className="flex flex-col items-center justify-center border border-[#E2E8F0] bg-white hover:bg-slate-50 rounded-xl p-4 transition group text-center cursor-pointer shadow-sm">
                                <UploadCloud size={20} className="text-slate-400 group-hover:text-[#244BD6] transition mb-1.5" />
                                <span className="text-[11px] text-slate-700 font-bold">Upload Photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleResolutionFileChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}
                          {cameraError && <p className="text-[9.5px] text-rose-500 font-medium">{cameraError}</p>}
                        </div>
                      )}
                    </div>

                    {/* Audit Verification trigger */}
                    <div className="pt-2 border-t border-[#EEF1F6] space-y-2">
                      {isVerifying ? (
                        <div className="space-y-2 py-2 text-center">
                          <div className="relative w-7 h-7 mx-auto flex items-center justify-center">
                            <span className="absolute w-full h-full rounded-full border border-[#244BD6]/20" />
                            <span className="absolute w-2 h-2 rounded-full bg-[#244BD6] animate-orbit" />
                          </div>
                          <p className="text-[10px] text-[#244BD6] font-bold tracking-wider uppercase animate-pulse">
                            Gemini Analyzing Proof...
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => submitResolutionAudit(selectedReport)}
                          disabled={!resolutionPhoto}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold font-display shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            resolutionPhoto 
                              ? 'bg-[#244BD6] hover:bg-[#1C3EBF] text-white shadow-blue-500/10' 
                              : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                          }`}
                        >
                          <ShieldCheck size={13} /> Submit Resolution for AI Audit
                        </button>
                      )}

                      {verificationError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 space-y-1 animate-fade-in">
                          <span className="text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle size={11} /> Verification Failure
                          </span>
                          <p className="text-[9.5px] leading-normal font-medium opacity-90">{verificationError}</p>
                        </div>
                      )}

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
                        className="w-full py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : selectedReport.status === 'Resolved' ? (
                  <div className="space-y-3.5 border-t border-[#EEF1F6] pt-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-emerald-600" /> Civora Resolution Auditor
                      </span>
                      {selectedReport.resolutionConfidence !== undefined && (
                        <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full">
                          {selectedReport.resolutionConfidence}% Match
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {selectedReport.resolutionVerified === 'verified' ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-bold">
                            ✅ Verified Fixed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-xl text-xs font-bold">
                            ⚠️ Not yet resolved, still visible
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black block mb-1">Before photo</span>
                          <div className="h-24 rounded-lg overflow-hidden border border-[#E2E8F0] bg-slate-50 relative group">
                            <img src={selectedReport.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-black block mb-1">After photo</span>
                          <div className="h-24 rounded-lg overflow-hidden border border-[#E2E8F0] bg-slate-50 relative group">
                            <img src={selectedReport.resolutionPhotoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-3">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-1">Auditor Verdict Details</span>
                        <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                          {selectedReport.resolutionExplanation}
                        </p>
                      </div>

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
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          <UploadCloud size={11} /> Re-verify / Upload New Proof
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCapturingResolution(true);
                        setResolutionPhoto(null);
                        setResolutionCoords(null);
                        setGpsStatus('idle');
                        setGpsError(null);
                        // default to camera
                        startCamera();
                      }}
                      className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F1A3D] rounded-xl py-2 px-3 text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <Camera size={13} /> Use camera
                    </button>
                    <label className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F1A3D] rounded-xl py-2 px-3 text-xs font-bold transition shadow-sm cursor-pointer">
                      <UploadCloud size={13} /> Upload photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleResolutionFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Status dispatch controls */}
              {!isCapturingResolution && (
                <div className="space-y-3.5 pt-4" style={{ borderTop: '1px solid #EEF1F6' }}>
                  <span className="text-[10px] uppercase font-bold text-[#8A93A5] tracking-wider block">STATUS DISPATCH CONTROLS</span>
                  
                  <div className="flex gap-2 text-xs">
                    <button 
                      onClick={() => updateReportStatus(selectedReport.id, 'Reported')}
                      disabled={selectedReport.status === 'Reported' || selectedReport.status === 'Resolved'}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold border transition ${
                        selectedReport.status === 'Reported'
                          ? 'bg-[#FFEBEB] text-[#D03B43] border-[#F3D2D3]'
                          : selectedReport.status === 'Resolved'
                            ? 'bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0] cursor-not-allowed opacity-50'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      Set Reported
                    </button>

                    <button 
                      onClick={() => updateReportStatus(selectedReport.id, 'Under Review')}
                      disabled={selectedReport.status === 'Under Review' || selectedReport.status === 'Resolved'}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold border transition ${
                        selectedReport.status === 'Under Review'
                          ? 'bg-[#FFF4E5] text-[#C47417] border-[#F0D5B1]'
                          : selectedReport.status === 'Resolved'
                            ? 'bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0] cursor-not-allowed opacity-50'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      Under Review
                    </button>

                    <button 
                      onClick={() => {
                        setIsCapturingResolution(true);
                        setResolutionPhoto(null);
                        setResolutionCoords(null);
                        setGpsStatus('idle');
                        setGpsError(null);
                      }}
                      disabled={selectedReport.status === 'Resolved'}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold border transition cursor-pointer ${
                        selectedReport.status === 'Resolved'
                          ? 'bg-[#E6FFFA] text-[#1D8A74] border-[#C2F3EA]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Set Resolved
                    </button>
                  </div>

                  {/* Delete button with inline confirmation */}
                  {!showDeleteConfirm ? (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full py-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mt-4 cursor-pointer"
                    >
                      <Trash2 size={13} /> Remove report
                    </button>
                  ) : (
                    <div className="mt-4 p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl space-y-3 animate-fade-in">
                      <p className="text-xs text-rose-700 font-bold text-center leading-relaxed">
                        ⚠️ Are you sure? This action is permanent and will completely purge this grievance file from the municipal log.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            handleDeleteReport(selectedReport.id, true);
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer text-center"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer text-center"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
