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

  // SVGs for modern color-coded markers
  const createMarkerHtml = (color: string, label: string) => `
    <div class="relative flex items-center justify-center">
      <!-- Glow effect -->
      <div class="absolute w-8 h-8 rounded-full bg-${color}-500/25 animate-ping" style="animation-duration: 2s;"></div>
      <!-- Marker body -->
      <div class="relative w-7 h-7 rounded-full bg-slate-950 shadow-lg flex items-center justify-center border border-${color}-500 text-${color}-400 font-extrabold text-[11px] glowing-pin-${color}">
        ${label}
      </div>
      <!-- Tail -->
      <div class="absolute -bottom-1 w-2.5 h-2.5 rotate-45 bg-slate-950 border-r border-b border-${color}-500"></div>
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
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  };

  // Selector icon (draggable location picker)
  const getSelectorIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-pin-select',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-9 h-9 rounded-full bg-indigo-500/20 animate-pulse"></div>
          <div class="relative w-8 h-8 rounded-full bg-slate-950 shadow-lg flex items-center justify-center border border-indigo-500 text-indigo-400 glowing-pin-indigo">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="absolute -bottom-1 w-2 h-2 rotate-45 bg-slate-950 border-r border-b border-indigo-500"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
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

      // Prepare custom popup card content
      const statusBadgeColors = 
        report.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
        report.status === 'Under Review' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
        'bg-rose-500/10 text-rose-400 border-rose-500/30';

      const severityBadgeColors = 
        report.severity === 'High' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
        report.severity === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
        'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

      const popupHtml = document.createElement('div');
      popupHtml.className = 'w-64 p-1 flex flex-col font-sans text-slate-100';
      popupHtml.innerHTML = `
        <div class="flex items-start gap-2.5 mb-2.5">
          ${report.photoUrl ? `
            <div class="w-12 h-12 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 border border-slate-800">
              <img src="${report.photoUrl}" referrerPolicy="no-referrer" class="w-full h-full object-cover">
            </div>
          ` : `
            <div class="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
              <span class="text-slate-500 text-[10px] font-bold">NO IMG</span>
            </div>
          `}
          <div class="min-w-0 flex-1">
            <h4 class="font-black text-slate-100 border-b border-slate-800 pb-1 text-sm truncate tracking-tight">${report.category}</h4>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${statusBadgeColors}">${report.status}</span>
              <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${severityBadgeColors}">${report.severity}</span>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed italic">"${report.userNotes || 'No notes description provided.'}"</p>
        <button id="detail-btn-${report.id}" class="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer">
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
        className="w-full h-full border border-white/10 rounded-2xl shadow-2xl bg-slate-955 relative"
      />
      {mode === 'select' && (
        <div id="drag-tip" className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 border border-white/10 rounded-xl shadow-2xl pointer-events-none z-10">
          💡 Drag pin or tap map to update location
        </div>
      )}
    </div>
  );
}
