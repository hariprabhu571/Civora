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
    let color = '#E5484D'; // Red for Reported
    if (status === 'Resolved') color = '#15A05A';
    else if (status === 'Under Review') color = '#E8A317';

    let size = 20;
    if (severity === 'High') size = 24;
    else if (severity === 'Low') size = 16;

    return L.divIcon({
      className: 'custom-status-marker',
      html: `
        <div style="position:relative; width:${size}px; height:${size}px;">
          <div style="position:absolute; inset:-6px; border-radius:50%; background:${color}; opacity:.25; animation:cvPulse 2.4s ease-out infinite;"></div>
          <div style="position:relative; width:${size}px; height:${size}px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); background:${color}; border:2.5px solid #fff; box-shadow:0 3px 8px -2px rgba(0,0,0,.3);"></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size]
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

    // CartoDB Voyager — colorful light map tiles showing blue water, green forests, and colored roads
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    // Zoom buttons in top right
    L.control.zoom({
      position: 'topright'
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
            <div class="absolute w-14 h-14 rounded-full" style="background: rgba(36,75,214,.2); animation: cvPulse 2.2s ease-out infinite;"></div>
            <!-- Core count bubble -->
            <div class="relative w-11 h-11 rounded-full flex flex-col items-center justify-center font-sans font-bold text-xs" 
                 style="background: #244BD6; color: #fff; border: 3px solid #fff; box-shadow: 0 6px 16px -6px rgba(0,0,0,.4);">
              <span class="leading-none" style="font-size:11px;">${cluster.count}</span>
              <span style="font-size:7px; text-transform:uppercase; letter-spacing:.05em; color:rgba(255,255,255,.75); font-weight:700;">issues</span>
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
        popupDiv.style.cssText = 'width:240px; padding:12px; font-family:"IBM Plex Sans",sans-serif; color:#131A2A; display:flex; flex-direction:column; gap:8px;';
        popupDiv.innerHTML = `
          <div style="display:flex; align-items:flex-start; gap:10px;">
            ${report.photoUrl ? `
              <div style="width:44px; height:44px; border-radius:8px; overflow:hidden; flex-shrink:0; border:1px solid #E3E7EF;">
                <img src="${report.photoUrl}" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;">
              </div>
            ` : `
              <div style="width:44px; height:44px; border-radius:8px; background:#F2F4F8; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:9px; color:#9AA4B5; font-weight:700;">NO PIC</div>
            `}
            <div style="min-width:0; flex:1;">
              <h4 style="font-family:'Space Grotesk'; font-weight:700; font-size:13px; color:#131A2A; margin:0 0 3px;">${report.category}</h4>
              <p style="font-size:10px; color:#9AA4B5; margin:0;">Filed ${dateStr}</p>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:10px; font-weight:600; padding:3px 8px; border-radius:999px; background:${
              report.status === 'Resolved' ? '#E4F5EC' : report.status === 'Under Review' ? '#FBF0D9' : '#FDECEC'
            }; color:${
              report.status === 'Resolved' ? '#0F7A45' : report.status === 'Under Review' ? '#9A6B00' : '#C2333A'
            };">${report.status}</span>
            <span style="font-size:10px; font-weight:600; padding:3px 8px; border-radius:999px; background:${
              report.severity === 'High' ? '#FDECEC' : report.severity === 'Medium' ? '#FBF0D9' : '#EAEFF6'
            }; color:${
              report.severity === 'High' ? '#C2333A' : report.severity === 'Medium' ? '#9A6B00' : '#5A6478'
            };">${report.severity}</span>
          </div>

          <p style="font-size:11px; color:#6A7488; line-height:1.5; font-style:italic; border-left:2px solid rgba(124,92,252,.3); padding-left:8px; margin:0;">
            "${report.userNotes || 'No notes.'}"
          </p>
          
          <div style="font-size:10px; color:#8A93A5; font-weight:600; letter-spacing:0.04em; text-transform:uppercase;">
            💼 ${report.responsible_department}
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
      <div className="civic-card rounded-2xl p-5" style={{ overflow: 'hidden' }}>
        {/* no decorative blobs in light theme */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
              <Sliders size={15} />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm" style={{ color: '#131A2A' }}>Geographic Intelligence</h3>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Density heat mapping & active hot zones</p>
            </div>
          </div>

          {/* Seed Data Button if empty */}
          {reports.length === 0 && onSeedData && (
            <button
              onClick={onSeedData}
              className="btn-primary flex items-center gap-1.5"
              style={{ fontSize: 12, padding: '8px 14px', borderRadius: 9, boxShadow: 'none' }}
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
                style={{width:"100%",background:"#fff",border:"1px solid #E3E7EF",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:600,color:"#3A4456",cursor:"pointer",outline:"none"}}
              >
                <option value="All">All Categories</option>
                <option value="Pothole">Potholes</option>
                <option value="Streetlight">Streetlights</option>
                <option value="Garbage/Waste">Garbage / Waste</option>
                <option value="Water Leakage">Water Leakages</option>
                <option value="Damaged Public Property">Public Property</option>
                <option value="Traffic Signal Issue">Traffic Signals</option>
                <option value="Public Toilet Issue">Public Toilets</option>
                <option value="Tree Fallen">Fallen Trees</option>
                <option value="Illegal Dumping">Illegal Dumping</option>
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
                style={{width:"100%",background:"#fff",border:"1px solid #E3E7EF",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:600,color:"#3A4456",cursor:"pointer",outline:"none"}}
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
                style={{width:"100%",background:"#fff",border:"1px solid #E3E7EF",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:600,color:"#3A4456",cursor:"pointer",outline:"none"}}
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
      <div className="relative h-[400px] w-full rounded-xl overflow-hidden border" style={{ background: '#E8EDF2', borderColor: '#E3E7EF' }}>
        {/* Map Container mount point */}
        <div ref={mapElementRef} className="w-full h-full relative z-[1]" id="trends-density-map" />

        {/* Ambient Vignette Overlay */}
        {/* no vignette in light theme */}

        {/* Floating Interactive Legends Panel */}
        <div className="absolute bottom-4 left-4 z-[10] p-3.5 rounded-xl shadow-xl max-w-xs font-sans space-y-3" style={{ background: 'rgba(255,255,255,.95)', border: '1px solid #E3E7EF', backdropFilter: 'blur(6px)', color: '#131A2A' }}>
          <div className="flex items-center gap-2 pb-1.5" style={{ borderBottom: '1px solid #EEF1F6' }}>
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
            <div className="space-y-1 pt-1.5" style={{ borderTop: '1px solid #EEF1F6' }}>
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
