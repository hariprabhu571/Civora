import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CivicReport } from '../types';

interface MapContainerProps {
  mode: 'view' | 'select';
  reports?: CivicReport[];
  center: [number, number];
  zoom?: number;
  onLocationChange?: (lat: number, lng: number) => void;
  selectedReportId?: string | null;
  onSelectReport?: (reportId: string) => void;
}

export default function MapContainer({
  mode,
  reports = [],
  center,
  zoom = 13,
  onLocationChange,
  selectedReportId,
  onSelectReport
}: MapContainerProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null); // For single draggable select pin
  const reportsGroupRef = useRef<L.FeatureGroup | null>(null);

  // SVGs for modern color-coded markers — enhanced with double pulse + gradient body
  const createMarkerHtml = (color: string, label: string) => `
    <div class="relative flex items-center justify-center">
      <!-- Double pulse rings: fast + slow -->
      <div class="absolute w-10 h-10 rounded-full bg-${color}-500/20 animate-ping" style="animation-duration: 1.5s;"></div>
      <div class="absolute w-12 h-12 rounded-full bg-${color}-500/10 animate-ping" style="animation-duration: 3s;"></div>
      <!-- Marker body with gradient -->
      <div class="relative w-8 h-8 rounded-full shadow-lg flex items-center justify-center border border-${color}-500 text-${color}-400 font-extrabold text-[11px] glowing-pin-${color}" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);">
        ${label}
      </div>
      <!-- Tail with matching gradient -->
      <div class="absolute -bottom-1 w-2.5 h-2.5 rotate-45 border-r border-b border-${color}-500" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);"></div>
    </div>
  `;

  // Custom icon factory
  const getSeverityIcon = (severity: string) => {
    let color = 'amber';
    let label = 'M';
    if (severity === 'High') {
      color = 'red';
      label = 'H';
    } else if (severity === 'Low') {
      color = 'emerald';
      label = 'L';
    }

    return L.divIcon({
      className: 'custom-leaflet-pin',
      html: createMarkerHtml(color, label),
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34]
    });
  };

  // Selector icon (draggable location picker) — enhanced with violet/cyan gradient ring + double pulse
  const getSelectorIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-pin-select',
      html: `
        <div class="relative flex items-center justify-center">
          <!-- Double pulse rings -->
          <div class="absolute w-11 h-11 rounded-full animate-pulse" style="background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(6,182,212,0.1) 100%);"></div>
          <div class="absolute w-14 h-14 rounded-full animate-ping" style="animation-duration: 2.5s; background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.05) 100%);"></div>
          <!-- Pin body with violet-cyan gradient ring -->
          <div class="relative w-9 h-9 rounded-full shadow-lg flex items-center justify-center glowing-pin-indigo" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); border: 2px solid transparent; background-clip: padding-box; box-shadow: 0 0 0 2px rgba(139,92,246,0.6), 0 0 15px rgba(139,92,246,0.3), 0 0 30px rgba(6,182,212,0.15);">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#selectorGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <defs><linearGradient id="selectorGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <!-- Tail -->
          <div class="absolute -bottom-1.5 w-2.5 h-2.5 rotate-45" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); border-right: 2px solid rgba(139,92,246,0.6); border-bottom: 2px solid rgba(139,92,246,0.6);"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn('Leaflet instance removal warning:', e);
      }
      mapInstanceRef.current = null;
    }

    if (mapElementRef.current) {
      // In React 18 StrictMode or HMR, re-renders can mount on the same DOM element.
      // We delete any Leaflet id set on the DOM object to prevent the 'Map container is already initialized' error.
      delete (mapElementRef.current as any)._leaflet_id;
    }

    // Set up Leaflet map instance
    const map = L.map(mapElementRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      fadeAnimation: true
    }).setView(center, zoom);

    // Standard high-quality responsive civic tiling (CartoDB Dark Matter for futuristic premium dark theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    // Add zoom buttons to bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Set up feature groups
    if (mode === 'view') {
      const reportsGroup = L.featureGroup().addTo(map);
      reportsGroupRef.current = reportsGroup;
    }

    // Leaflet needs resize trigger when placed inside responsive flex rows
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Map cleanup during unmount warning:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const [lat, lng] = center;

  // Sync Map center updates (e.g. on auto-position trigger)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentCenter = map.getCenter();
    const isDifferent = Math.abs(currentCenter.lat - lat) > 0.0001 || Math.abs(currentCenter.lng - lng) > 0.0001;
    if (isDifferent) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng]);

  // Handle Mode: SELECT Location Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mode !== 'select') return;

    // Clean up older selector marker
    if (markerInstanceRef.current) {
      markerInstanceRef.current.remove();
    }

    // Create a draggable selector pin
    const pickerMarker = L.marker([lat, lng], {
      icon: getSelectorIcon(),
      draggable: true
    }).addTo(map);

    markerInstanceRef.current = pickerMarker;

    // Emit changes back to parent
    pickerMarker.on('dragend', () => {
      const position = pickerMarker.getLatLng();
      if (onLocationChange) {
        onLocationChange(position.lat, position.lng);
      }
    });

    // Clicking map also repositions picker
    const onMapClick = (e: L.LeafletMouseEvent) => {
      pickerMarker.setLatLng(e.latlng);
      if (onLocationChange) {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      if (pickerMarker) pickerMarker.remove();
    };
  }, [mode, onLocationChange, lat, lng]);

  // Handle Mode: VIEW Pins Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = reportsGroupRef.current;
    if (!map || !group || mode !== 'view') return;

    // Clear previous markers
    group.clearLayers();

    // Map through existing database reports
    reports.forEach((report) => {
      if (!report.location || typeof report.location.lat !== 'number' || typeof report.location.lng !== 'number') return;

      const marker = L.marker([report.location.lat, report.location.lng], {
        icon: getSeverityIcon(report.severity)
      });

      // Prepare custom popup card content with premium styling
      const statusBadgeColors = 
        report.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
        report.status === 'Under Review' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
        'bg-rose-500/10 text-rose-400 border-rose-500/30';

      const severityDotColor = 
        report.severity === 'High' ? '#f43f5e' :
        report.severity === 'Medium' ? '#f59e0b' :
        '#10b981';

      const severityBadgeColors = 
        report.severity === 'High' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
        report.severity === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
        'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

      const popupHtml = document.createElement('div');
      popupHtml.className = 'w-64 p-1 flex flex-col font-sans text-slate-100';
      popupHtml.innerHTML = `
        <div class="flex items-start gap-2.5 mb-2.5">
          ${report.photoUrl ? `
            <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-white/10">
              <img src="${report.photoUrl}" referrerPolicy="no-referrer" class="w-full h-full object-cover">
            </div>
          ` : `
            <div class="w-12 h-12 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0">
              <span class="text-slate-500 text-[10px] font-bold">NO IMG</span>
            </div>
          `}
          <div class="min-w-0 flex-1">
            <h4 class="font-bold text-sm tracking-tight text-slate-100 pb-1.5 mb-1.5" style="border-bottom: 2px solid transparent; border-image: linear-gradient(90deg, #8b5cf6, #06b6d4) 1;">${report.category}</h4>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${statusBadgeColors}">${report.status}</span>
              <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${severityBadgeColors} flex items-center gap-1">
                <span style="width:5px;height:5px;border-radius:50%;background:${severityDotColor};display:inline-block;"></span>
                ${report.severity}
              </span>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed italic">"${report.userNotes || 'No notes description provided.'}"</p>
        <button id="detail-btn-${report.id}" class="w-full text-center py-2.5 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer hover:opacity-90 active:scale-95" style="background: linear-gradient(135deg, #8b5cf6, #06b6d4); border-radius: 0.75rem; font-weight: 700; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.25);">
          View Audit Details &rarr;
        </button>
      `;

      marker.bindPopup(popupHtml, { minWidth: 260 });

      // Handle popup click to trigger external state changes inside React
      marker.on('popupopen', () => {
        const btn = document.getElementById(`detail-btn-${report.id}`);
        if (btn && onSelectReport) {
          btn.addEventListener('click', () => {
            onSelectReport(report.id);
            map.closePopup();
          });
        }
      });

      group.addLayer(marker);

      // Auto open if selected via app list
      if (selectedReportId && report.id === selectedReportId) {
        map.setView([report.location.lat, report.location.lng], 15);
        setTimeout(() => {
          try {
            if (map && typeof map.hasLayer === 'function' && map.hasLayer(marker)) {
              marker.openPopup();
            }
          } catch (e) {
            console.warn('Marker popup auto-open safe catch:', e);
          }
        }, 300);
      }
    });

  }, [mode, reports, selectedReportId, onSelectReport]);

  return (
    <div className="relative w-full h-full" id={`map-${mode}-container`}>
      <div 
        ref={mapElementRef} 
        id={`map-${mode}`}
        className="w-full h-full border border-white/5 rounded-2xl shadow-2xl bg-slate-955 relative"
      />
      {/* Vignette overlay on map edges */}
      <div 
        className="absolute inset-0 rounded-2xl pointer-events-none z-[2]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(6,8,15,0.4) 100%)' }}
      />
      {mode === 'select' && (
        <div id="drag-tip" className="absolute bottom-4 left-4 backdrop-blur-xl text-white text-[10px] uppercase tracking-wider font-extrabold px-3.5 py-2 rounded-xl shadow-2xl pointer-events-none z-10" style={{ background: 'rgba(8,12,24,0.9)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(139,92,246,0.15)' }}>
          📍 Drag pin or tap map to update location
        </div>
      )}
    </div>
  );
}
