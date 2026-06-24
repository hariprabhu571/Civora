import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
// @ts-ignore
import 'leaflet.heat';
import { CivicReport, CivicCategory, ReportStatus, SeverityLevel } from '../types';
import { Calendar, Filter, MapPin, Layers, Info, Trash2, Sliders, RefreshCw, Sparkles } from 'lucide-react';

interface TrendMapProps {
  reports: CivicReport[];
  onSeedData?: () => void;
}

export default function TrendMap({ reports, onSeedData }: TrendMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<any>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);

  // Filters State
  const [categoryFilter, setCategoryFilter] = useState<CivicCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'All'>('All');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'All'>('All');
  const [dateRange, setDateRange] = useState<'all' | '15days' | '7days'>('all'); // Note: Parent loads 30 days max
  const [unresolvedOnly, setUnresolvedOnly] = useState<boolean>(false);
  const [showHeatLayer, setShowHeatLayer] = useState<boolean>(true);
  const [mapZoom, setMapZoom] = useState<number>(12);

  // Filter coordinates centering (default San Francisco region)
  const defaultCenter: [number, number] = [37.7749, -122.4194];

  // Dynamically compute the center of active reports
  const mapCenter = useMemo((): [number, number] => {
    if (reports.length > 0) {
      const validReports = reports.filter(r => r.location && typeof r.location.lat === 'number' && typeof r.location.lng === 'number');
      if (validReports.length > 0) {
        const sumLat = validReports.reduce((acc, r) => acc + r.location.lat, 0);
        const sumLng = validReports.reduce((acc, r) => acc + r.location.lng, 0);
        return [sumLat / validReports.length, sumLng / validReports.length];
      }
    }
    return defaultCenter;
  }, [reports]);

  // 1. FILTERING & CACHING REPORTS
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // 1. Category Filter
      if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;

      // 2. Status Filter
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;

      // 3. Unresolved Only Filter
      if (unresolvedOnly && r.status === 'Resolved') return false;

      // 4. Severity Filter
      if (severityFilter !== 'All' && r.severity !== severityFilter) return false;

      // 5. Date Filter (relative to current timestamp)
      if (dateRange !== 'all') {
        const now = new Date();
        const daysLimit = dateRange === '7days' ? 7 : 15;
        const limitDate = new Date();
        limitDate.setDate(now.getDate() - daysLimit);
        
        const rDate = r.timestamp?.seconds 
          ? new Date(r.timestamp.seconds * 1000) 
          : new Date();
        if (rDate < limitDate) return false;
      }

      return true;
    });
  }, [reports, categoryFilter, statusFilter, severityFilter, dateRange, unresolvedOnly]);

  // Custom marker icon depending on status & severity level
  const getStatusIcon = (status: string, severity: string) => {
    let color = '#f43f5e'; // Red for Reported
    let shadowColor = 'rgba(244, 63, 94, 0.4)';
    if (status === 'Resolved') {
      color = '#10b981'; // Green
      shadowColor = 'rgba(16, 185, 129, 0.4)';
    } else if (status === 'Under Review') {
      color = '#f59e0b'; // Yellow
      shadowColor = 'rgba(245, 158, 11, 0.4)';
    }

    let size = 28;
    if (severity === 'High') {
      size = 36;
    } else if (severity === 'Low') {
      size = 20;
    }

    return L.divIcon({
      className: 'custom-status-marker',
      html: `
        <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
          <!-- Glowing outer ring -->
          <div class="absolute inset-0 rounded-full animate-pulse" style="background: ${color}; opacity: 0.15; transform: scale(1.35);"></div>
          <!-- Inner core dot -->
          <div class="relative rounded-full border border-white/30 text-white font-extrabold flex items-center justify-center select-none shadow-md" 
               style="background: ${color}; width: 100%; height: 100%; box-shadow: 0 0 12px ${shadowColor}; font-size: ${size > 28 ? '10px' : '8px'};">
            ${severity[0]}
          </div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  };

  // Compute custom clusters based on zoom & reports
  const clusters = useMemo(() => {
    // Zoom levels greater than 14 don't cluster
    if (mapZoom >= 15) {
      return filteredReports.map(r => ({
        isCluster: false,
        count: 1,
        center: [r.location.lat, r.location.lng] as [number, number],
        reports: [r]
      }));
    }

    const result: Array<{ isCluster: boolean; count: number; center: [number, number]; reports: CivicReport[] }> = [];
    const threshold = 1.0 / Math.pow(2.2, mapZoom - 4); // Adaptive threshold

    filteredReports.forEach((report) => {
      if (!report.location || typeof report.location.lat !== 'number' || typeof report.location.lng !== 'number') return;
      
      let added = false;
      for (const cluster of result) {
        const latDiff = Math.abs(cluster.center[0] - report.location.lat);
        const lngDiff = Math.abs(cluster.center[1] - report.location.lng);
        if (latDiff < threshold && lngDiff < threshold) {
          const n = cluster.count;
          cluster.center = [
            (cluster.center[0] * n + report.location.lat) / (n + 1),
            (cluster.center[1] * n + report.location.lng) / (n + 1)
          ];
          cluster.count += 1;
          cluster.isCluster = true;
          cluster.reports.push(report);
          added = true;
          break;
        }
      }
      if (!added) {
        result.push({
          isCluster: false,
          count: 1,
          center: [report.location.lat, report.location.lng],
          reports: [report]
        });
      }
    });

    return result;
  }, [filteredReports, mapZoom]);

  // INITIALIZE MAP LAYERS
  useEffect(() => {
    if (!mapElementRef.current) return;

    // Delete any Leaflet id set on the DOM object to prevent already initialized errors
    delete (mapElementRef.current as any)._leaflet_id;

    // Setup Leaflet map instance
    const map = L.map(mapElementRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      fadeAnimation: true
    }).setView(mapCenter, 12);

    // Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    // Zoom buttons in bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Feature group for markers
    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Update zoom state dynamically to handle adaptive clustering
    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    // Invalidate size to guarantee rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map view if center shifts and no reports are mapped yet
  useEffect(() => {
    if (mapInstanceRef.current && reports.length > 0) {
      const map = mapInstanceRef.current;
      map.panTo(mapCenter);
    }
  }, [mapCenter]);

  // RENDER DENSITY HEATMAP LAYER
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing heatmap layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!showHeatLayer || filteredReports.length === 0) return;

    // Transform points for Leaflet.heat
    // Format: [lat, lng, intensity]
    // We can weight by confirmations or simply treat each as a base intensity of 1.0. Let's make high severity weigh slightly more
    const points = filteredReports.map((r) => {
      let weight = 0.5;
      if (r.severity === 'High') weight = 1.0;
      else if (r.severity === 'Medium') weight = 0.7;
      return [r.location.lat, r.location.lng, weight] as [number, number, number];
    });

    try {
      // Create new Leaflet.heat layer
      // Gradient: darker red = more issues, cool colors = fewer issues
      const heatLayer = (L as any).heatLayer(points, {
        radius: 28,
        blur: 18,
        maxZoom: 15,
        gradient: {
          0.1: '#3b82f6', // cool blue (few)
          0.3: '#06b6d4', // cyan
          0.6: '#10b981', // green
          0.8: '#f59e0b', // orange/amber
          1.0: '#ef4444'  // dark red (most issues)
        }
      }).addTo(map);

      heatLayerRef.current = heatLayer;
    } catch (e) {
      console.error('Error generating Leaflet heat layer:', e);
    }
  }, [filteredReports, showHeatLayer]);

  // RENDER OVERLAY MARKERS & CLUSTERS ON MAP
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    // Clear previous markers
    group.clearLayers();

    // Loop through clusters (or individual markers)
    clusters.forEach((cluster) => {
      if (cluster.isCluster) {
        // Render a cluster circle with the count
        const clusterHtml = `
          <div class="relative flex items-center justify-center">
            <!-- Pulsing ring -->
            <div class="absolute w-14 h-14 rounded-full bg-violet-500/25 animate-ping" style="animation-duration: 2.2s;"></div>
            <!-- Core count bubble -->
            <div class="relative w-11 h-11 rounded-full flex flex-col items-center justify-center font-display font-black text-xs text-white border border-violet-400 shadow-xl" 
                 style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);">
              <span class="leading-none text-[11px]">${cluster.count}</span>
              <span class="text-[7px] uppercase tracking-wider text-violet-300 font-extrabold mt-0.5">Issues</span>
            </div>
          </div>
        `;

        const clusterIcon = L.divIcon({
          className: 'custom-leaflet-cluster',
          html: clusterHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        const marker = L.marker(cluster.center, { icon: clusterIcon });
        
        // Clicking a cluster zooms into its reports
        marker.on('click', () => {
          map.setView(cluster.center, Math.min(map.getZoom() + 2, 16));
        });

        group.addLayer(marker);
      } else {
        // Individual Report Marker
        const report = cluster.reports[0];
        const marker = L.marker([report.location.lat, report.location.lng], {
          icon: getStatusIcon(report.status, report.severity)
        });

        // Setup gorgeous popup inside map
        const statusBadgeColor = 
          report.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          report.status === 'Under Review' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
          'bg-rose-500/10 text-rose-400 border-rose-500/30';

        const severityBadgeColor = 
          report.severity === 'High' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
          report.severity === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

        const dateStr = report.timestamp?.seconds 
          ? new Date(report.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Recently';

        const popupDiv = document.createElement('div');
        popupDiv.className = 'w-64 p-1.5 flex flex-col font-sans text-slate-100 gap-2.5';
        popupDiv.innerHTML = `
          <div class="flex items-start gap-3">
            ${report.photoUrl ? `
              <div class="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0">
                <img src="${report.photoUrl}" referrerPolicy="no-referrer" class="w-full h-full object-cover">
              </div>
            ` : `
              <div class="w-12 h-12 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-center shrink-0 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                NO PIC
              </div>
            `}
            <div class="min-w-0 flex-1">
              <h4 class="font-extrabold text-xs text-white uppercase tracking-tight">${report.category}</h4>
              <p class="text-[9px] text-slate-400 mt-0.5">Filed ${dateStr}</p>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full border ${statusBadgeColor}">${report.status}</span>
            <span class="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full border ${severityBadgeColor}">${report.severity}</span>
          </div>

          <p class="text-[10px] text-slate-300 leading-relaxed italic border-l-2 border-violet-500/40 pl-2">
            "${report.userNotes || 'No notes description provided.'}"
          </p>
          
          <div class="text-[8px] uppercase tracking-widest text-slate-500 font-black flex items-center gap-1">
            💼 Dept: ${report.responsible_department}
          </div>
        `;

        marker.bindPopup(popupDiv, { minWidth: 240 });
        group.addLayer(marker);
      }
    });
  }, [clusters, showHeatLayer]);

  return (
    <div className="space-y-6">
      {/* Filters Overlay Panel */}
      <div className="glass rounded-2xl p-5 border border-white/5 relative overflow-hidden shadow-xl">
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
              <Sliders size={15} />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-white">Geographic Intelligence</h3>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Density heat mapping & active hot zones</p>
            </div>
          </div>

          {/* Seed Data Button if empty */}
          {reports.length === 0 && onSeedData && (
            <button
              onClick={onSeedData}
              className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-xl px-4 py-2 text-xs font-bold transition hover:opacity-90 active:scale-95 shadow-lg shadow-violet-500/20 cursor-pointer"
            >
              <Sparkles size={13} className="animate-pulse" /> Seeding Hotspot Test Reports
            </button>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Category</label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-violet-500 transition cursor-pointer appearance-none"
              >
                <option value="All">All Categories</option>
                <option value="Pothole">Potholes</option>
                <option value="Streetlight">Streetlights</option>
                <option value="Garbage/Waste">Garbage / Waste</option>
                <option value="Water Leakage">Water Leakages</option>
                <option value="Damaged Public Property">Public Property</option>
                <option value="Other">Other</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">▼</div>
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Status Filter</label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-violet-500 transition cursor-pointer appearance-none"
              >
                <option value="All">All Statuses</option>
                <option value="Reported">Reported</option>
                <option value="Under Review">Under Review</option>
                <option value="Resolved">Resolved</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">▼</div>
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Time Span</label>
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-violet-500 transition cursor-pointer appearance-none"
              >
                <option value="all">Last 30 Days</option>
                <option value="15days">Last 15 Days</option>
                <option value="7days">Last 7 Days</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">▼</div>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="flex flex-row sm:flex-col justify-end gap-3.5 select-none pt-2 sm:pt-0">
            {/* Show Heatmap Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={showHeatLayer}
                onChange={(e) => setShowHeatLayer(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-slate-900 text-violet-500 focus:ring-violet-500/20"
              />
              <span className="flex items-center gap-1"><Layers size={13} className="text-violet-400" /> Density Heat layer</span>
            </label>

            {/* Unresolved Only Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={unresolvedOnly}
                onChange={(e) => setUnresolvedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-slate-900 text-rose-500 focus:ring-rose-500/20"
              />
              <span className="flex items-center gap-1 text-rose-300">⚠️ Unresolved Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Map Content Box */}
      <div className="relative h-[480px] w-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-slate-950">
        {/* Map Container mount point */}
        <div ref={mapElementRef} className="w-full h-full relative z-[1]" id="trends-density-map" />

        {/* Ambient Vignette Overlay */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-[2]" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(6,8,15,0.45) 100%)' }} />

        {/* Floating Interactive Legends Panel */}
        <div className="absolute bottom-4 left-4 z-[10] backdrop-blur-xl bg-slate-950/85 border border-white/10 p-3.5 rounded-xl shadow-2xl max-w-xs font-sans text-slate-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
            <Info size={12} className="text-violet-400" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Map Legend Guide</h4>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-[10px] font-semibold text-slate-300">
            {/* Heat Intensity Legend */}
            {showHeatLayer && (
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Issue Density (Heatmap)</span>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 to-red-500 border border-white/5" />
                <div className="flex justify-between text-[8px] font-bold text-slate-400 px-0.5">
                  <span>Low Volume</span>
                  <span>Hot Zone</span>
                </div>
              </div>
            )}

            {/* Status Indicators */}
            <div className="space-y-1">
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Status Markers</span>
              <div className="grid grid-cols-3 gap-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Resolved</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Review</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Reported</span>
              </div>
            </div>

            {/* Severity Sizing */}
            <div className="space-y-1 border-t border-white/5 pt-1.5">
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Severity Marker Sizing</span>
              <div className="flex items-center justify-between gap-2.5 bg-white/[0.02] px-2 py-1 rounded border border-white/5 text-[9px]">
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400">Low <span className="text-[7px] text-slate-500 font-medium">(S)</span></span>
                <span>&rarr;</span>
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-400">Medium <span className="text-[7px] text-slate-500 font-medium">(M)</span></span>
                <span>&rarr;</span>
                <span className="flex items-center gap-1 text-[9px] font-black text-rose-400">High <span className="text-[7px] text-slate-500 font-medium">(L)</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
