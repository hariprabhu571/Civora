import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, doc, updateDoc, increment, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { safeLocalStorage } from '../lib/storage';
import { CivicCategory, SeverityLevel, AIDraftData, LocationCoordinates, CivicReport } from '../types';
import { Upload, Mic, Trash2, ShieldAlert, Sparkles, AlertTriangle, FileText, Check, ArrowRight, Loader2, MapPin, Minimize, Camera } from 'lucide-react';
import MapContainer from './MapContainer';
import { motion, AnimatePresence } from 'motion/react';

// Distance calculation in meters (Haversine Formula)
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface ReportFormProps {
  onBackToMap: () => void;
  onSuccess: (reportId: string, isConfirmation: boolean) => void;
}

export default function ReportForm({ onBackToMap, onSuccess }: ReportFormProps) {
  // Current Form Stage
  // 'collect' -> 'analyzing' -> 'review' -> 'duplicate_screening' -> 'submitting'
  const [stage, setStage] = useState<'collect' | 'analyzing' | 'review' | 'submitting'>('collect');
  
  // Media Attachment States
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [imageBase64, setImageBase64] = useState<string>('');

  // Voice Inputs / Text Inputs
  const [userNotes, setUserNotes] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  
  // Audio Speech Recognition Ref
  const recognitionRef = useRef<any>(null);

  // Address and Location Coordinates
  const [coordinates, setCoordinates] = useState<LocationCoordinates>({ lat: 37.7749, lng: -122.4194 }); // SF Default
  const [locating, setLocating] = useState<boolean>(false);

  // Gemini AI Analysis Review Data
  const [aiDraft, setAiDraft] = useState<AIDraftData | null>(null);

  // Duplicate Matching states
  const [detectedDuplicate, setDetectedDuplicate] = useState<CivicReport | null>(null);
  const [duplicateReasoning, setDuplicateReasoning] = useState<string>('');
  const [reporterEmail, setReporterEmail] = useState<string>(() => safeLocalStorage.getItem('civic_user_email') || '');

  // Inline styling non-blocking alert wrapper
  const [formNotice, setFormNotice] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const showFormNotice = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setFormNotice({ message, type });
    setTimeout(() => {
      setFormNotice(prev => prev && prev.message === message ? null : prev);
    }, 6000);
  };

  const triggerAlert = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    showFormNotice(message, type);
    console.warn('Civora Notification:', message);
  };
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web Geolocation Capture on mount
  useEffect(() => {
    attemptGeolocation();
  }, []);

  const attemptGeolocation = () => {
    try {
      if (!navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocating(false);
        },
        (error) => {
          console.warn('Geolocation failed or blocked:', error.message);
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } catch (e) {
      console.warn('Geolocation invocation blocked:', e);
      setLocating(false);
    }
  };

  // Drag and Drop files handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processAttachment(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processAttachment(files[0]);
    }
  };

  const processAttachment = (file: File) => {
    const isVideoFile = file.type.startsWith('video/');
    setIsVideo(isVideoFile);
    setMediaFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setMediaPreview(result);
      if (!isVideoFile) {
        setImageBase64(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Extract first frame of video to analyse in Gemini on canvas
  const handleVideoLoadedMetadata = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    
    // Seek to 0.2 seconds to capture non-black initial frames
    video.currentTime = 0.2;
    
    video.onseeked = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const frameBase64 = canvas.toDataURL('image/jpeg');
      setImageBase64(frameBase64);
    };
  };

  // Web Speech API Voice Transcription Implementation
  const startRecording = () => {
    const SpeechLib = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechLib) {
      triggerAlert('Speech recognition is not supported in this browser. Please type the description in.', 'info');
      return;
    }

    const recognition = new SpeechLib();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setUserNotes((prev) => (prev ? prev + ' ' + transcript : transcript));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const triggerVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Stage 1: Trigger AI Classifier
  const analyzeIssueWithAI = async () => {
    if (!mediaPreview) {
      triggerAlert('Please upload a photo or video first so Gemini can analyze the issue details.', 'info');
      return;
    }

    setStage('analyzing');
    
    try {
      // call Express endpoint
      const response = await fetch('/api/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: isVideo ? 'image/jpeg' : mediaFile?.type || 'image/jpeg',
          userNotesByVoiceOrText: userNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failure processing image. Ensure Gemini API key is valid.');
      }

      const reportAnalysis = await response.json();
      setAiDraft({
        category: reportAnalysis.category || 'Other',
        severity: reportAnalysis.severity || 'Medium',
        severity_reasoning: reportAnalysis.severity_reasoning || '',
        responsible_department: reportAnalysis.responsible_department || 'Municipal Corporation',
        formal_complaint_text: reportAnalysis.formal_complaint_text || ''
      });
      
      setStage('review');

    } catch (err: any) {
      console.error(err);
      triggerAlert('Failed to analyze the issue: ' + (err.message || 'Server breakdown. Make sure GEMINI_API_KEY is configured in your settings.'), 'error');
      setStage('collect');
    }
  };

  // Stage 2: Editable Form Review Sync
  const handleReviewChange = (field: keyof AIDraftData, value: string) => {
    if (!aiDraft) return;
    setAiDraft({ ...aiDraft, [field]: value });
  };

  // Stage 3: Duplicate Screen & Submit
  const handleProceedSubmit = async () => {
    if (!aiDraft) return;
    setStage('submitting');
    
    try {
      console.log('[Duplicate Screening] Starting checks on submit...');
      console.log(`[Duplicate Screening] New report credentials: Category = "${aiDraft.category}", Lat = ${coordinates.lat}, Lng = ${coordinates.lng}`);

      // 1. Query close-by active reports from same Category (Client-side)
      const reportsQuery = query(
        collection(db, 'reports'),
        where('category', '==', aiDraft.category)
      );
      
      const querySnapshot = await getDocs(reportsQuery);
      const activeCloseReports: CivicReport[] = [];

      console.log(`[Duplicate Screening] Database returned ${querySnapshot.size} total reports matching category "${aiDraft.category}".`);

      querySnapshot.forEach((docSnap) => {
        const rData = docSnap.data();
        const docId = docSnap.id;
        
        if (rData.status === 'Resolved') {
          console.log(`[Duplicate Screening] Skipping matching for Report ID "${docId}" because status is already Resolved.`);
          return; 
        }

        if (!rData.location || rData.location.lat === undefined || rData.location.lng === undefined) {
          console.warn(`[Duplicate Screening] Report ID "${docId}" has missing or invalid coordinates nested under .location:`, rData.location);
          return;
        }

        // Parse to number safely in case they got stored as strings
        const refLat = Number(rData.location.lat);
        const refLng = Number(rData.location.lng);
        const userLat = Number(coordinates.lat);
        const userLng = Number(coordinates.lng);

        if (isNaN(refLat) || isNaN(refLng)) {
          console.warn(`[Duplicate Screening] SKIPPING Report ID "${docId}" - retrieved coordinates are NaN. Lat: ${rData.location.lat}, Lng: ${rData.location.lng}`);
          return;
        }

        const dist = getDistanceInMeters(userLat, userLng, refLat, refLng);
        
        console.log(`[Duplicate Screening] Comparing against active Report [ID: ${docId}] - Distance: ${dist.toFixed(2)} meters.`);

        // within roughly 110 meters
        if (dist <= 110) {
          console.log(`[Duplicate Screening] Match potential! Report [ID: ${docId}] is within 110m limit (calculated dist: ${dist.toFixed(2)}m) and will be evaluated by Gemini.`);
          activeCloseReports.push({ id: docId, ...rData } as CivicReport);
        } else {
          console.log(`[Duplicate Screening] Report [ID: ${docId}] is too far away (${dist.toFixed(2)}m > 110m). Excluded from matching.`);
        }
      });

      console.log(`[Duplicate Screening] Found a total of ${activeCloseReports.length} candidate reports in immediate proximity (< 110m) of same category.`);

      // 2. If close reports exist, summon Gemini to screen for duplicate real-world entity!
      if (activeCloseReports.length > 0) {
        console.log('[Duplicate Screening] Triggering Gemini comparison request proxy via /api/check-duplicate...', {
          newReport: {
            category: aiDraft.category,
            formal_complaint_text: aiDraft.formal_complaint_text,
            userNotes: userNotes
          },
          candidatesCount: activeCloseReports.length
        });

        try {
          const checkResponse = await fetch('/api/check-duplicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newReportDetails: {
                category: aiDraft.category,
                formal_complaint_text: aiDraft.formal_complaint_text,
                userNotes: userNotes
              },
              existingReports: activeCloseReports
            })
          });

          if (checkResponse.ok) {
            const duplicateVerdict = await checkResponse.json();
            console.log('[Duplicate Screening] API Verdict received successfully:', duplicateVerdict);

            if (duplicateVerdict.isDuplicate && duplicateVerdict.matchedReportId) {
              const matchedReport = activeCloseReports.find(r => r.id === duplicateVerdict.matchedReportId);
              if (matchedReport) {
                console.log(`[Duplicate Screening] DUPLICATE MATCH CONFIRMED by Gemini with existing report [ID: ${duplicateVerdict.matchedReportId}]. Confidence: ${duplicateVerdict.confidence}%.`);
                console.log(`[Duplicate Screening] Reason for match: ${duplicateVerdict.reasoning}`);
                setDetectedDuplicate(matchedReport);
                setDuplicateReasoning(duplicateVerdict.reasoning);
                // Hold execution! Let the user decide through the duplicate screen
                return;
              } else {
                console.warn(`[Duplicate Screening] Gemini flagged duplicate against ID [${duplicateVerdict.matchedReportId}], but that report ID was not found in our candidate list. Proceeding with submit...`);
              }
            } else {
              console.log('[Duplicate Screening] Gemini verified nearby candidate(s) but concluded this report is unique. Moving on to submit...');
            }
          } else {
            console.warn('[Duplicate Screening] Fail status returned from /api/check-duplicate:', checkResponse.status, checkResponse.statusText);
            triggerAlert('Duplicate check skipped due to high demand — report submitted normally', 'info');
          }
        } catch (fetchErr: any) {
          console.error('[Duplicate Screening] Network call or payload parse threw exception. Bypassing scan & failing open:', fetchErr);
          triggerAlert('Duplicate check skipped due to high demand — report submitted normally', 'info');
        }
      } else {
        console.log('[Duplicate Screening] Skipping Gemini screening call entirely since no nearby candidate tickets exist in the active area.');
      }

      // If no duplicates detected, execute saving immediately
      await executeReportSaving();

    } catch (err: any) {
      console.error(err);
      triggerAlert('Submission error: ' + err.message, 'error');
      setStage('review');
    }
  };

  // Compresses any uploaded image into a high-density, low-footprint base64 JPEG string
  // to avoid Firestore document limits (max 1MB per doc) and completely bypass missing Firebase Storage bucket product constraints.
  const compressBase64Image = (base64Str: string, maxW = 500, maxH = 500): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          if (w > h) {
            h = Math.round((h * maxW) / w);
            w = maxW;
          } else {
            w = Math.round((w * maxH) / h);
            h = maxH;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality JPEG compressed (~15KB to 30KB)
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  // Complete Firestore and Storage persistent upload
  const executeReportSaving = async () => {
    if (!aiDraft) return;
    
    try {
      let finalPhotoUrl = '';

      if (imageBase64) {
        console.log('Utilizing client-side high-density base64 compression. This is 100% free, requires zero storage buckets, completely bypasses CORS errors, and saves instantly.');
        finalPhotoUrl = await compressBase64Image(imageBase64);
      }

      const uid = safeLocalStorage.getItem('civic_user_uuid') || Math.random().toString(36).substring(2, 12);
      safeLocalStorage.setItem('civic_user_uuid', uid);

      if (reporterEmail.trim()) {
        safeLocalStorage.setItem('civic_user_email', reporterEmail.trim());
      }

      const payload = {
        photoUrl: finalPhotoUrl,
        category: aiDraft.category,
        severity: aiDraft.severity,
        severityReasoning: aiDraft.severity_reasoning,
        responsible_department: aiDraft.responsible_department,
        formal_complaint_text: aiDraft.formal_complaint_text,
        userNotes: userNotes,
        location: coordinates,
        status: 'Reported',
        timestamp: new Date(), // Standard client date
        confirmations: 1,
        confirmedUsers: [uid],
        reporterEmail: reporterEmail.trim() || null
      };

      const docRef = await addDoc(collection(db, 'reports'), payload);

      if (reporterEmail.trim()) {
        try {
          console.log('[Civora Mail] Triggering automated dispatch email for new report...');
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: reporterEmail.trim(),
              category: aiDraft.category,
              status: 'Reported',
              description: aiDraft.formal_complaint_text,
              beforeImage: finalPhotoUrl,
              severity: aiDraft.severity,
              responsible_department: aiDraft.responsible_department,
              reportId: docRef.id
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.simulated) {
              console.log('[Civora Mail] Simulated email logged successfully. Outbound SMTP restricted.');
              triggerAlert('Report logged! A copy of your official dispatch email was simulated and logged to the server logs.', 'success');
            } else if (data.previewUrl) {
              console.log('[Civora Mail] Ethereal live preview ready:', data.previewUrl);
              triggerAlert(`Report logged! Email sent. Preview in logs or open: ${data.previewUrl}`, 'success');
            } else {
              console.log('[Civora Mail] Email sent via SMTP relay.');
              triggerAlert('Report logged! A formal dispatch email notification has been sent.', 'success');
            }
          } else {
            const errorText = await res.text();
            console.warn('[Civora Mail] Email endpoint returned non-200:', errorText);
          }
        } catch (mailErr) {
          console.warn('[Civora Mail] Non-blocking mail dispatch failed:', mailErr);
        }
      }

      onSuccess(docRef.id, false);

    } catch (err: any) {
      console.error('Save failed:', err);
      triggerAlert('Save operation to database failed: ' + err.message, 'error');
      setStage('review');
    }
  };

  // Add confirmation to duplicate issue instead of duplicating
  const confirmDuplicateReport = async () => {
    if (!detectedDuplicate) return;
    setStage('submitting');

    try {
      const uid = safeLocalStorage.getItem('civic_user_uuid') || Math.random().toString(36).substring(2, 12);
      safeLocalStorage.setItem('civic_user_uuid', uid);

      // Verify if user already confirmed. If not, add support
      if (detectedDuplicate.confirmedUsers && detectedDuplicate.confirmedUsers.includes(uid)) {
        triggerAlert('You have already confirmed support for this reported issue earlier!', 'info');
        onSuccess(detectedDuplicate.id, true);
        return;
      }

      const docRef = doc(db, 'reports', detectedDuplicate.id);
      await updateDoc(docRef, {
        confirmations: increment(1),
        confirmedUsers: arrayUnion(uid)
      });

      onSuccess(detectedDuplicate.id, true);

    } catch (err: any) {
      console.error('Confirmation failed:', err);
      triggerAlert('Failed to support the existing ticket: ' + err.message, 'error');
      setStage('review');
    }
  };

  // Progress steps data
  const progressSteps = [
    { label: 'Evidence', active: stage === 'collect', completed: stage === 'analyzing' || stage === 'review' || stage === 'submitting' },
    { label: 'AI Analysis', active: stage === 'analyzing', completed: stage === 'review' || stage === 'submitting' },
    { label: 'Review & Submit', active: stage === 'review' || stage === 'submitting', completed: false },
  ];

  return (
    <div className="min-h-full py-4 px-4 md:px-8 font-sans">
      <div id="form-container" className="max-w-4xl mx-auto glass-heavy rounded-3xl shadow-2xl overflow-hidden border border-white/10 flex flex-col min-h-[500px] gradient-border">
        
        {/* Multi-step progress indicator */}
        <div className="px-6 md:px-8 pt-6 pb-2 animate-fade-in-up">
          <div className="flex items-center justify-between relative">
            {progressSteps.map((step, idx) => (
              <React.Fragment key={step.label}>
                {/* Step dot + label */}
                <div className="flex flex-col items-center z-10 relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                      step.active || step.completed
                        ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/25'
                        : 'bg-white/10 text-slate-500'
                    }`}
                  >
                    {step.completed ? <Check size={14} /> : idx + 1}
                  </div>
                  <span className={`text-[10px] font-semibold mt-1.5 tracking-wide ${
                    step.active || step.completed ? 'text-violet-300' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {/* Connecting line */}
                {idx < progressSteps.length - 1 && (
                  <div className="flex-1 h-[2px] mx-2 -mt-4 relative">
                    <div className="absolute inset-0 bg-white/10 rounded-full" />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                        step.completed
                          ? 'w-full bg-gradient-to-r from-violet-500 to-cyan-500'
                          : 'w-0'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Dynamic header */}
        <div id="form-header" className="py-5 px-6 md:px-8 text-white flex items-center justify-between relative">
          <div className="relative">
            <span className="text-[10px] uppercase tracking-widest font-extrabold bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 text-violet-300 px-3 py-1 rounded-full">Civora Citizen Dispatch</span>
            <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight mt-2.5 text-gradient-aurora">Report Civic Issue</h2>
          </div>
          <button 
            id="close-report-btn"
            onClick={onBackToMap}
            className="text-xs font-bold uppercase tracking-wider glass hover:border-violet-500/30 px-4 py-2 border border-white/10 rounded-xl transition duration-150 cursor-pointer text-slate-300"
          >
            Cancel
          </button>
        </div>

        {/* Dynamic Non-blocking alert notice banner */}
        {formNotice && (
          <div className={`mx-6 mb-2 px-4 py-3.5 text-xs font-semibold flex items-center justify-between transition-all rounded-xl glass ${
            formNotice.type === 'error' ? 'border-l-2 border-l-rose-400 text-rose-400' :
            formNotice.type === 'success' ? 'border-l-2 border-l-emerald-400 text-emerald-400' :
            'border-l-2 border-l-cyan-400 text-cyan-400'
          }`}>
            <span className="flex items-center gap-2">
              <span className="text-[15px]">{formNotice.type === 'error' ? '⚠️' : formNotice.type === 'success' ? '✅' : 'ℹ️'}</span>
              <span>{formNotice.message}</span>
            </span>
            <button className="text-[16px] leading-[0] font-sans hover:opacity-70 font-bold px-2 py-1 cursor-pointer" onClick={() => setFormNotice(null)}>×</button>
          </div>
        )}

        {/* Form Screens */}
        <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
          
          {/* STAGE 1: Data entry & attachments */}
          {stage === 'collect' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 flex-1"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Upload attachment Section */}
                <div className="space-y-3">
                  <label id="upload-lbl" className="block text-sm font-semibold text-slate-300">Issue Evidence (Photo/Video)</label>
                  
                  <div 
                    id="dropzone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('camera-file-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${mediaPreview ? 'border-violet-500/50 bg-violet-500/5' : 'border-white/10 hover:border-violet-500/50 hover:bg-white/5'}`}
                  >
                    <input 
                      id="camera-file-input"
                      type="file" 
                      accept="image/*,video/*" 
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {mediaPreview ? (
                      <div className="relative w-full max-h-[200px] overflow-hidden rounded-lg flex items-center justify-center bg-black group">
                        {isVideo ? (
                          <>
                            <video 
                              ref={videoRef}
                              src={mediaPreview} 
                              muted
                              onLoadedMetadata={handleVideoLoadedMetadata}
                              className="max-h-[190px] rounded"
                            />
                            <div className="absolute top-2 right-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                              Video
                            </div>
                          </>
                        ) : (
                          <img 
                            src={mediaPreview} 
                            referrerPolicy="no-referrer"
                            alt="Preview" 
                            className="max-h-[190px] object-contain rounded"
                          />
                        )}
                        {/* Glass overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-center justify-center" />
                        <button 
                          id="clear-media-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaFile(null);
                            setMediaPreview(null);
                            setIsVideo(false);
                            setImageBase64('');
                          }}
                          className="absolute bottom-2 right-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white p-2 rounded-full shadow-lg transition cursor-pointer z-10"
                          title="Remove media"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500/15 to-cyan-500/15 rounded-full flex items-center justify-center text-violet-400 mx-auto">
                          <Camera size={24} />
                        </div>
                        <p className="text-sm font-semibold text-white">Drag or Click to Upload photo/video</p>
                        <p className="text-xs text-slate-400 font-medium">Supports pothole, waste pile, water leakage, damages, etc.</p>
                      </div>
                    )}
                  </div>
                  {/* Hidden Canvas for Video Frame Capture */}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Notes Input & Voice Command */}
                <div className="flex flex-col">
                  <label id="notes-lbl" className="block text-sm font-semibold text-slate-300 mb-3">Casual Description / Notes</label>
                  
                  <div className="relative flex-1 min-h-[150px] flex flex-col glass-card rounded-xl overflow-hidden focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20 transition">
                    <textarea 
                      id="notes-textarea"
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="e.g. Terrible pothole near sector 4 corner, blocking traffic..."
                      className="w-full flex-1 p-4 bg-transparent outline-none resize-none text-[14px] text-white placeholder:text-slate-500"
                    />
                    
                    <div id="input-controls" className="p-2 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-2">
                        {isRecording ? (
                          <span className="flex items-center gap-1.5 font-bold text-rose-500">
                            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                            Listening...
                          </span>
                        ) : (
                          <span>or tap the mic to speak</span>
                        )}
                      </div>
                      
                      <button 
                        id="voice-mic-btn"
                        type="button"
                        onClick={triggerVoiceInput}
                        className={`p-2.5 rounded-full transition flex items-center justify-center shadow-sm cursor-pointer ${isRecording ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white ring-2 ring-rose-400/50 animate-pulse' : 'glass text-slate-300 hover:text-white'}`}
                      >
                        <Mic size={18} className={isRecording ? 'animate-bounce' : ''} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Map Position Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label id="location-lbl" className="block text-sm font-semibold text-slate-300">Incident Location Coordinates</label>
                  <button 
                    id="gps-locate-btn"
                    onClick={attemptGeolocation}
                    type="button"
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-bold transition cursor-pointer"
                  >
                    <MapPin size={14} /> {locating ? 'GPS Loading...' : 'Reset Geolocation'}
                  </button>
                </div>

                <div className="glass-card rounded-xl overflow-hidden p-0">
                  <div id="picker-map-box" className="h-44 rounded-xl overflow-hidden relative">
                    <MapContainer 
                      mode="select"
                      center={[coordinates.lat, coordinates.lng]}
                      onLocationChange={(lat, lng) => setCoordinates({ lat, lng })}
                    />
                    {/* Subtle gradient overlay at bottom of map */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#06080f]/60 to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div id="cta-row" className="pt-4 flex justify-end">
                <button 
                  id="submit-ai-classify-btn"
                  onClick={analyzeIssueWithAI}
                  disabled={!mediaPreview}
                  className={`flex items-center gap-2 rounded-xl px-8 py-3.5 font-display font-bold text-sm tracking-wide transition cursor-pointer ${!mediaPreview ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' : 'btn-aurora text-white shadow-md hover:shadow-lg'}`}
                >
                  <Sparkles size={18} />
                  Analyze Issue with Gemini AI
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 2: Gemini Investigating */}
          {stage === 'analyzing' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-6"
            >
              {/* Orbital loader with pulsing aurora glow */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Aurora glow behind */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/30 via-cyan-500/20 to-rose-500/30 blur-2xl animate-breathe" />
                {/* Center circle */}
                <div className="relative w-16 h-16 bg-[#06080f] rounded-full flex items-center justify-center border border-white/10 shadow-2xl z-10">
                  <Sparkles size={24} className="text-violet-400 animate-pulse" />
                </div>
                {/* Orbiting dot 1 - violet */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-violet-500 shadow-lg shadow-violet-500/50" />
                </div>
                {/* Orbiting dot 2 - cyan */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50" />
                </div>
                {/* Orbiting dot 3 - rose */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s' }}>
                  <div className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                </div>
              </div>
              <div className="space-y-2 animate-fade-in-up">
                <h3 className="text-xl font-display font-bold text-white">Calling Core Dispatch Intelligence...</h3>
                <p className="text-slate-400 text-sm max-w-md">Gemini AI is examining your image, analyzing severity and auto-drafting an official public grievance petition.</p>
              </div>
            </motion.div>
          )}

          {/* STAGE 3: Review and Edit Drafted Report */}
          {stage === 'review' && aiDraft && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 flex-1 text-slate-200"
            >
              {/* Success banner */}
              <div className="p-4 bg-gradient-to-r from-violet-500/5 to-cyan-500/5 border border-violet-500/15 rounded-xl flex items-start gap-3">
                <Sparkles size={20} className="text-violet-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-violet-300 text-sm">Gemini Audit Completed!</h4>
                  <p className="text-xs text-violet-400/80 font-medium animate-pulse">Please review, make any necessary adjustments to the fields, and finalize your public report.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left controls */}
                <div className="space-y-4">
                  <div className="glass-card rounded-xl p-4">
                    <label id="review-cat" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Issue Type Category</label>
                    <select 
                      id="draft-category"
                      value={aiDraft.category}
                      onChange={(e) => handleReviewChange('category', e.target.value as CivicCategory)}
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none font-medium focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/40"
                    >
                      <option value="Pothole">Pothole</option>
                      <option value="Streetlight">Streetlight</option>
                      <option value="Garbage/Waste">Garbage/Waste</option>
                      <option value="Water Leakage">Water Leakage</option>
                      <option value="Damaged Public Property">Damaged Public Property</option>
                      <option value="Traffic Signal Issue">Traffic Signal Issue</option>
                      <option value="Public Toilet Issue">Public Toilet Issue</option>
                      <option value="Tree Fallen">Tree Fallen</option>
                      <option value="Illegal Dumping">Illegal Dumping</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="glass-card rounded-xl p-4">
                    <label id="review-severity" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Severity Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Low', 'Medium', 'High'] as SeverityLevel[]).map((lev) => (
                        <button 
                          id={`sev-btn-${lev}`}
                          key={lev}
                          type="button"
                          onClick={() => handleReviewChange('severity', lev)}
                          className={`py-2 px-3 border rounded-lg text-xs font-bold text-center transition cursor-pointer ${aiDraft.severity === lev ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-md border-transparent' : 'glass border-white/5 hover:bg-white/5 text-slate-300'}`}
                        >
                          {lev}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card rounded-xl p-4">
                    <label id="review-reasoning" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">AI Severity Reasoning</label>
                    <textarea 
                      id="draft-severity-reasoning"
                      value={aiDraft.severity_reasoning}
                      onChange={(e) => handleReviewChange('severity_reasoning', e.target.value)}
                      className="w-full glass border border-white/10 rounded-lg px-3.5 py-2 text-xs text-slate-300 outline-none resize-none h-14 focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/40"
                    />
                  </div>

                  <div className="glass-card rounded-xl p-4">
                    <label id="review-dept" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Assigned Service Board (Department)</label>
                    <select 
                      id="draft-dept"
                      value={aiDraft.responsible_department}
                      onChange={(e) => handleReviewChange('responsible_department', e.target.value)}
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/40 font-semibold"
                    >
                      <option value="Municipal Corporation">Municipal Corporation</option>
                      <option value="Electricity Board">Electricity Board</option>
                      <option value="Sanitation Department">Sanitation Department</option>
                      <option value="Water Board">Water Board</option>
                    </select>
                  </div>

                  <div className="glass-card rounded-xl p-4 border border-violet-500/10">
                    <label id="review-email" className="block text-xs font-semibold uppercase tracking-wider text-violet-300 mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                      Email Address (Optional)
                    </label>
                    <input 
                      id="draft-reporter-email"
                      type="email"
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      placeholder="e.g. citizen@example.com"
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/40"
                    />
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5">
                      Enter your email to receive live, real-time automated updates, photos, and AI-audited resolution logs for this incident.
                    </p>
                  </div>
                </div>

                {/* Right control - petition box */}
                <div className="flex flex-col glass-card rounded-xl p-4">
                  <label id="review-text" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Formal Grievance Petition Text</label>
                  <textarea 
                    id="draft-formal-complaint"
                    value={aiDraft.formal_complaint_text}
                    onChange={(e) => handleReviewChange('formal_complaint_text', e.target.value)}
                    className="w-full flex-1 glass border border-white/10 rounded-lg p-4 font-mono text-xs leading-relaxed text-slate-200 outline-none min-h-[180px] focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/40 shadow-inner"
                  />
                </div>
              </div>

              {/* Duplicate modal overlay */}
              {detectedDuplicate && (
                <div id="duplicate-warning-modal" className="fixed inset-0 bg-[#06080f]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="glass-heavy max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl border border-amber-500/20"
                  >
                    <div id="warning-head" className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border-b border-white/5 p-5 flex items-center gap-3 text-amber-400">
                      <AlertTriangle size={24} className="animate-bounce" />
                      <div>
                        <h3 className="font-display font-semibold text-lg">Similar Active Issue Found</h3>
                        <p className="text-slate-400 text-[11px] font-medium">Within 100 meters, this real-world problem is already reported.</p>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <p className="text-xs text-slate-300 bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                        <strong>AI Auditor analysis:</strong> {duplicateReasoning}
                      </p>

                      <div className="border border-white/10 rounded-xl p-4 glass">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Existing Active Report #{detectedDuplicate.id.slice(0, 5)}</span>
                        <h4 className="font-bold text-white text-[14px] mt-0.5">{detectedDuplicate.category} ({detectedDuplicate.status})</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-3 italic leading-relaxed">
                          "{detectedDuplicate.formal_complaint_text}"
                        </p>
                        {detectedDuplicate.photoUrl && (
                          <div className="mt-2.5 w-full h-24 rounded-lg overflow-hidden border border-white/5">
                            <img src={detectedDuplicate.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-violet-400">
                          <span>🎯 {detectedDuplicate.confirmations || 1} Citizens support this ticket</span>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <button 
                          id="agree-confirm-duplicate-btn"
                          onClick={confirmDuplicateReport}
                          className="flex-1 text-center py-2.5 px-4 btn-aurora text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check size={14} /> Yes, Confirm & Support Ticket
                        </button>
                        <button 
                          id="force-submit-anyway-btn"
                          onClick={() => {
                            setDetectedDuplicate(null);
                            executeReportSaving();
                          }}
                          className="flex-1 text-center py-2.5 px-4 glass hover:bg-white/10 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          It's different, submit anyway
                        </button>
                        <button 
                          id="back-edit-warning-btn"
                          onClick={() => {
                            setDetectedDuplicate(null);
                            setStage('review');
                          }}
                          className="py-2.5 px-4 glass border border-white/10 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer hover:bg-white/5"
                        >
                          Keep Editing
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Action Buttons */}
              <div id="review-cta-row" className="pt-4 flex items-center justify-between border-t border-white/5">
                <button 
                  id="review-back-btn"
                  onClick={() => setStage('collect')}
                  className="px-6 py-2.5 glass hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Back to Form
                </button>

                <button 
                  id="review-submit-final-btn"
                  onClick={handleProceedSubmit}
                  className="flex items-center gap-2 btn-aurora text-white font-display font-bold px-8 py-3 rounded-xl transition shadow-md hover:shadow-lg cursor-pointer text-sm tracking-wide"
                >
                  <FileText size={18} />
                  Submit Official Complaint
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 4: Submitting files and records of complaint */}
          {stage === 'submitting' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-6"
            >
              {/* Enhanced orbital loader */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Pulsing glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/25 to-cyan-500/25 blur-2xl animate-breathe" />
                {/* Center */}
                <div className="relative w-14 h-14 bg-[#06080f] rounded-full flex items-center justify-center border border-white/10 z-10">
                  <Loader2 size={28} className="animate-spin text-violet-400" />
                </div>
                {/* Orbiting dots */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-violet-500 shadow-lg shadow-violet-500/50" />
                </div>
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50" />
                </div>
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4.5s' }}>
                  <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                </div>
              </div>
              <div className="space-y-1.5 animate-fade-in-up">
                <h3 className="text-lg font-display font-bold text-white">Uploading Civic Ticket...</h3>
                <p className="text-slate-400 text-xs max-w-md">Saving report details, image assets to Cloud and registering dispatch board.</p>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
