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
  const markerInstanceRef = useRef<L.Marker | null>(null);
  const reportsGroupRef = useRef<L.FeatureGroup | null>(null);

  // Civic light-theme map pin — teardrop shape
  const createMarkerHtml = (fillColor: string, borderColor: string) => `
    <div style="position:relative; width:20px; height:20px;">
      <div style="position:absolute; inset:-8px; border-radius:50%; background:${fillColor}; opacity:.3; animation: cvPulse 2.4s ease-out infinite;"></div>
      <div style="position:relative; width:20px; height:20px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); background:${fillColor}; border:3px solid #fff; box-shadow:0 4px 10px -2px rgba(0,0,0,.35);"></div>
    </div>
  `;

  const getSeverityIcon = (severity: string, status: string) => {
    let fillColor = '#E8A317'; // medium default
    if (status === 'Resolved') fillColor = '#15A05A';
    else if (severity === 'High') fillColor = '#E5484D';
    else if (severity === 'Low') fillColor = '#15A05A';

    return L.divIcon({
      className: 'custom-leaflet-pin',
      html: createMarkerHtml(fillColor, '#fff'),
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -22]
    });
  };

  const getSelectorIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-pin-select',
      html: `
        <div style="position:relative; width:22px; height:22px;">
          <div style="position:absolute; inset:-8px; border-radius:50%; background:rgba(36,75,214,.25); animation: cvPulse 2s ease-out infinite;"></div>
          <div style="position:relative; width:22px; height:22px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); background:#244BD6; border:3px solid #fff; box-shadow:0 4px 10px -2px rgba(0,0,0,.35);"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 22]
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current) return;

    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch (e) { /* ignore */ }
      mapInstanceRef.current = null;
    }

    if (mapElementRef.current) {
      delete (mapElementRef.current as any)._leaflet_id;
    }

    const map = L.map(mapElementRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      fadeAnimation: true
    }).setView(center, zoom);

    // CartoDB Positron — clean light map tiles matching Civora design
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    if (mode === 'view') {
      const reportsGroup = L.featureGroup().addTo(map);
      reportsGroupRef.current = reportsGroup;
    }

    setTimeout(() => { map.invalidateSize(); }, 100);

    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) { /* ignore */ }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const [lat, lng] = center;

  // Sync center
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const cur = map.getCenter();
    if (Math.abs(cur.lat - lat) > 0.0001 || Math.abs(cur.lng - lng) > 0.0001) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng]);

  // SELECT mode — draggable pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mode !== 'select') return;

    if (markerInstanceRef.current) markerInstanceRef.current.remove();

    const pickerMarker = L.marker([lat, lng], {
      icon: getSelectorIcon(),
      draggable: true
    }).addTo(map);

    markerInstanceRef.current = pickerMarker;

    pickerMarker.on('dragend', () => {
      const pos = pickerMarker.getLatLng();
      if (onLocationChange) onLocationChange(pos.lat, pos.lng);
    });

    const onMapClick = (e: L.LeafletMouseEvent) => {
      pickerMarker.setLatLng(e.latlng);
      if (onLocationChange) onLocationChange(e.latlng.lat, e.latlng.lng);
    };

    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      if (pickerMarker) pickerMarker.remove();
    };
  }, [mode, onLocationChange, lat, lng]);

  // VIEW mode — report pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = reportsGroupRef.current;
    if (!map || !group || mode !== 'view') return;

    group.clearLayers();

    reports.forEach((report) => {
      if (!report.location || typeof report.location.lat !== 'number' || typeof report.location.lng !== 'number') return;

      const marker = L.marker([report.location.lat, report.location.lng], {
        icon: getSeverityIcon(report.severity, report.status)
      });

      // Light-theme popup card
      const statusBg = report.status === 'Resolved' ? '#E4F5EC' : report.status === 'Under Review' ? '#FBF0D9' : '#FDECEC';
      const statusFg = report.status === 'Resolved' ? '#0F7A45' : report.status === 'Under Review' ? '#9A6B00' : '#C2333A';
      const statusDot = report.status === 'Resolved' ? '#15A05A' : report.status === 'Under Review' ? '#E8A317' : '#E5484D';

      const popupHtml = document.createElement('div');
      popupHtml.style.cssText = 'width:260px; padding:14px; font-family:"IBM Plex Sans",sans-serif; color:#131A2A;';
      popupHtml.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
          ${report.photoUrl
            ? `<div style="width:48px; height:48px; border-radius:8px; overflow:hidden; flex-shrink:0; border:1px solid #E3E7EF;"><img src="${report.photoUrl}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;"></div>`
            : `<div style="width:48px; height:48px; border-radius:8px; background:#F2F4F8; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:9px; color:#9AA4B5; font-weight:700;">NO PIC</div>`
          }
          <div style="flex:1; min-width:0;">
            <div style="font-family:'Space Grotesk'; font-weight:700; font-size:14px; margin-bottom:5px;">${report.category}</div>
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:3px 7px; border-radius:999px; background:${statusBg}; color:${statusFg};">
                <span style="width:5px; height:5px; border-radius:50%; background:${statusDot};"></span>${report.status}
              </span>
            </div>
          </div>
        </div>
        <p style="font-size:12px; color:#6A7488; font-style:italic; line-height:1.5; margin:0 0 10px;">"${(report.userNotes || 'No notes.').slice(0, 80)}…"</p>
        <button id="detail-btn-${report.id}" style="width:100%; background:#244BD6; color:#fff; border:none; border-radius:9px; padding:9px; font-family:'IBM Plex Sans'; font-weight:600; font-size:12.5px; cursor:pointer; box-shadow:0 6px 16px -8px rgba(36,75,214,.6);">
          View full details →
        </button>
      `;

      marker.bindPopup(popupHtml, { minWidth: 260 });

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

      if (selectedReportId && report.id === selectedReportId) {
        map.setView([report.location.lat, report.location.lng], 15);
        setTimeout(() => {
          try {
            if (map && typeof map.hasLayer === 'function' && map.hasLayer(marker)) {
              marker.openPopup();
            }
          } catch (e) { /* ignore */ }
        }, 300);
      }
    });
  }, [mode, reports, selectedReportId, onSelectReport]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} id={`map-${mode}-container`}>
      <div
        ref={mapElementRef}
        id={`map-${mode}`}
        style={{ width: '100%', height: '100%', background: '#E8EDF2' }}
      />
      {mode === 'select' && (
        <div
          style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 10,
            background: 'rgba(255,255,255,.92)', border: '1px solid #E3E7EF',
            borderRadius: 9, padding: '7px 12px', fontSize: 11.5, fontWeight: 600,
            color: '#3A4456', pointerEvents: 'none',
            backdropFilter: 'blur(6px)'
          }}
        >
          📍 Drag pin or tap map to update location
        </div>
      )}
    </div>
  );
}
