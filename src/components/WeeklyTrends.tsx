import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Sparkles, 
  Calendar, 
  Loader2, 
  RefreshCw, 
  BarChart2, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import TrendMap from './TrendMap';
import { CivicCategory, ReportStatus, SeverityLevel } from '../types';

export default function WeeklyTrends() {
  const [loading, setLoading] = useState<boolean>(true);
  const [trendsText, setTrendsText] = useState<string>('');
  const [forecastText, setForecastText] = useState<string>('');
  const [reportsCount, setReportsCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  const [topCategory, setTopCategory] = useState<string>('N/A');
  const [mapReports, setMapReports] = useState<any[]>([]);
  const [chartCategory, setChartCategory] = useState<string>('All');

  const fetchTrendsData = async () => {
    setLoading(true);
    try {
      // Calculate date 30 days ago to fulfill performance boundary
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query for all reports in the last 30 days
      const reportsCollection = collection(db, 'reports');
      const q = query(reportsCollection, where('timestamp', '>=', thirtyDaysAgo));
      
      const snapshot = await getDocs(q);
      const docs: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({ id: doc.id, ...data });
      });

      // Filter reports from the last 7 days for the Gemini summary card and stats metrics
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const docs7Days = docs.filter((doc) => {
        const rDate = doc.timestamp?.seconds 
          ? new Date(doc.timestamp.seconds * 1000) 
          : new Date();
        return rDate >= sevenDaysAgo;
      });

      setReportsCount(docs7Days.length);
      const resolved = docs7Days.filter(r => r.status === 'Resolved').length;
      setResolvedCount(resolved);

      // Determine top category in last 7 days
      if (docs7Days.length > 0) {
        const counts: Record<string, number> = {};
        docs7Days.forEach((doc) => {
          counts[doc.category] = (counts[doc.category] || 0) + 1;
        });
        const sortedCats = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        setTopCategory(`${sortedCats[0][0]} (${sortedCats[0][1]} filed)`);
      } else {
        setTopCategory('None');
      }

      // Store the full 30 days of reports in state to feed the heatmap map
      setMapReports(docs);

      // Send the last 7 days of reports to the backend Gemini AI aggregations
      const response = await fetch('/api/generate-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: docs7Days })
      });

      if (!response.ok) {
        throw new Error('Gemini trends aggregation request failed.');
      }

      const result = await response.json();
      setTrendsText(result.summary || 'Summary compiled successfully.');
      setForecastText(result.forecast || 'Prediction unavailable. Check back in a moment.');

    } catch (err: any) {
      console.error('Error fetching trends:', err);
      setTrendsText('Failed to aggregate weekly metrics. Make sure you have reports submitted and GEMINI_API_KEY is configured in Settings.');
      setForecastText('Prediction unavailable. Check back in a moment.');
    } finally {
      setLoading(false);
    }
  };

  // Seed Mock Reports for Heatmap & Clusters testing
  const seedMockReports = async () => {
    try {
      setLoading(true);
      const reportsCollection = collection(db, 'reports');

      const categories: CivicCategory[] = [
        'Pothole',
        'Streetlight',
        'Garbage/Waste',
        'Water Leakage',
        'Damaged Public Property',
        'Traffic Signal Issue',
        'Public Toilet Issue',
        'Tree Fallen',
        'Illegal Dumping',
        'Other'
      ];

      const notesForCategory: Record<CivicCategory, string[]> = {
        'Pothole': [
          'Large deep pothole on the road surface causing cars to swerve.',
          'Asphalt crumbling near the intersection, needs repair.',
          'Severe pothole causing tire damage to multiple vehicles.',
          'Road erosion expanding after heavy rainfall.',
          'Multiple small potholes merging into a big hazard.'
        ],
        'Streetlight': [
          'Entire street block is dark because this streetlight is out.',
          'Light is flickering constantly, causing visual disturbance.',
          'Streetlight pole damaged and leaning dangerously.',
          'Bulb has been dead for over a week near the park.',
          'Light turns on and off randomly throughout the night.'
        ],
        'Garbage/Waste': [
          'Illegal dumping of furniture and plastic bags on the sidewalk.',
          'Public trash bin is overflowing and attracting rodents.',
          'Pile of construction debris left on the street corner.',
          'Unpleasant smell coming from discarded commercial waste.',
          'Plastic bottles and waste clogging the storm drain.'
        ],
        'Water Leakage': [
          'Water main leaking, clean drinking water flooding the street.',
          'Fire hydrant slowly leaking from the side valve.',
          'Sprinkler system in the median broken and spraying water on cars.',
          'Puddle of standing water has formed from an underground pipe leak.',
          'Water bubbling up through a crack in the concrete.'
        ],
        'Damaged Public Property': [
          'Bus stop glass panel shattered and scattered on the floor.',
          'Park bench is broken and unsafe for anyone to sit on.',
          'Municipal signage vandalized or knocked down.',
          'Metal fence surrounding the public garden is bent.',
          'Graffiti covering the historic neighborhood welcome sign.'
        ],
        'Traffic Signal Issue': [
          'Traffic light is completely dead at the major crossroads, causing dangerous near-misses.',
          'Green signal light bulb is burned out on the northbound lane.',
          'Pedestrian crossing walk/don\'t walk sign is stuck and not functioning.',
          'Traffic light controller box seems damaged and signals are blinking yellow indefinitely.',
          'Signal timing is mismatched causing severe gridlocks during rush hours.'
        ],
        'Public Toilet Issue': [
          'Municipal public toilet block has running water completely clogged and overflowing.',
          'Severe lack of hygiene, garbage pileup, and non-functional locks in public toilet booths.',
          'No water supply or lighting inside the local public restrooms.',
          'Broken sinks and leaking drainage pipe in the community toilets.',
          'Public restroom door broken off its hinges, needs urgent carpentry.'
        ],
        'Tree Fallen': [
          'Large old banyan tree branch snapped and is blocking two lanes of traffic.',
          'Heavy tree has collapsed across the road during overnight wind, pulling down overhead cables.',
          'Fallen tree branch resting on public power lines, posing a massive electrical hazard.',
          'Overturned dead tree blocking the entrance of the public municipal park.',
          'Broken tree limb hanging precariously over a busy sidewalk lane.'
        ],
        'Illegal Dumping': [
          'Commercial chemical barrels and tires dumped illegally in the vacant plot.',
          'Industrial waste pile dumped overnight along the riverbank path.',
          'Huge heap of construction debris and broken bricks dumped on a pedestrian green belt.',
          'Truck observed dumping bulk electronic waste in the residential corner alley.',
          'Illegal dumping of rotting fish boxes and food waste causing intense putrid odor.'
        ],
        'Other': [
          'Overgrown tree branches completely blocking the stop sign.',
          'Construction signs left behind after work was finished.',
          'Slippery sidewalk area near the community market.',
          'Stray wires exposed near the base of a traffic pole.',
          'Bollards damaged near the pedestrian crossing lane.'
        ]
      };

      const photoForCategory: Record<CivicCategory, string> = {
        'Pothole': 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
        'Streetlight': 'https://images.unsplash.com/photo-1509024644558-2f56ce76c490?auto=format&fit=crop&w=600&q=80',
        'Garbage/Waste': 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
        'Water Leakage': 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
        'Damaged Public Property': 'https://images.unsplash.com/photo-1599740831119-4727fdf22295?auto=format&fit=crop&w=600&q=80',
        'Traffic Signal Issue': 'https://images.unsplash.com/photo-1508349937151-22b68b72d5b1?auto=format&fit=crop&w=600&q=80',
        'Public Toilet Issue': 'https://images.unsplash.com/photo-1595856417561-20418456c507?auto=format&fit=crop&w=600&q=80',
        'Tree Fallen': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80',
        'Illegal Dumping': 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
        'Other': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80'
      };

      // Base latitude/longitude centered around San Francisco
      const baseLat = 37.7749;
      const baseLng = -122.4194;

      // Report counts per day from 6 days ago (Day 0) to today (Day 6): 2, 5, 3, 7, 4, 6, 3
      const dailyCounts = [2, 5, 3, 7, 4, 6, 3];
      const promises = [];

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const count = dailyCounts[dayOffset];
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (6 - dayOffset));

        for (let j = 0; j < count; j++) {
          const cat = categories[(dayOffset + j) % categories.length];
          const notesList = notesForCategory[cat];
          const notes = notesList[j % notesList.length];
          const photo = photoForCategory[cat];

          const lat = baseLat + (Math.random() - 0.5) * 0.015;
          const lng = baseLng + (Math.random() - 0.5) * 0.015;

          const severities: SeverityLevel[] = ['Low', 'Medium', 'High'];
          const statuses: ReportStatus[] = ['Reported', 'Under Review', 'Resolved'];

          const report = {
            photoUrl: photo,
            category: cat,
            severity: severities[(dayOffset + j) % 3],
            severityReasoning: `Automated assessment: Category ${cat} evaluated at severity level due to impact on community safety.`,
            responsible_department: cat === 'Pothole' || cat === 'Water Leakage' ? 'Department of Public Works' : 'Municipal Services Agency',
            formal_complaint_text: `Formal request regarding municipal issue: ${notes}. Location coordinates: [${lat.toFixed(4)}, ${lng.toFixed(4)}]. Immediate inspection requested.`,
            userNotes: notes,
            location: {
              lat: lat,
              lng: lng,
              address: `SF District ${dayOffset + 1}, San Francisco, CA`
            },
            status: statuses[(dayOffset + j) % 3],
            timestamp: Timestamp.fromDate(targetDate),
            confirmations: Math.floor(Math.random() * 5) + 1,
            confirmedUsers: []
          };

          promises.push(addDoc(reportsCollection, report));
        }
      }

      await Promise.all(promises);
      await fetchTrendsData();
    } catch (err) {
      console.error('Error seeding mock trend reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendsData();
  }, []);

  // Compute 7-day chart data ending today
  const chartData = useMemo(() => {
    const daysList = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysList.push({
        date: label,
        count: 0
      });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    mapReports.forEach((report) => {
      const rDate = report.timestamp?.seconds 
        ? new Date(report.timestamp.seconds * 1000) 
        : new Date();

      if (rDate >= sevenDaysAgo) {
        if (chartCategory === 'All' || report.category === chartCategory) {
          const rLabel = rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const match = daysList.find(d => d.date === rLabel);
          if (match) {
            match.count += 1;
          }
        }
      }
    });

    return daysList;
  }, [mapReports, chartCategory]);

  // Compute trend insight wording based on user requests:
  // "If trend is up: 'Report volume increasing. Hotspots may need intervention.'"
  // "If trend is down: 'Report volume decreasing. Current efforts working.'"
  // "If flat: 'Steady report rate. Consistent civic engagement.'"
  const trendInsight = useMemo(() => {
    if (chartData.length < 7) {
      return { text: "Steady report rate. Consistent civic engagement.", direction: "flat" };
    }
    
    const firstHalfSum = chartData[0].count + chartData[1].count + chartData[2].count;
    const secondHalfSum = chartData[4].count + chartData[5].count + chartData[6].count;

    if (secondHalfSum > firstHalfSum) {
      return {
        text: "Report volume increasing. Hotspots may need intervention.",
        direction: "up"
      };
    } else if (secondHalfSum < firstHalfSum) {
      return {
        text: "Report volume decreasing. Current efforts working.",
        direction: "down"
      };
    } else {
      return {
        text: "Steady report rate. Consistent civic engagement.",
        direction: "flat"
      };
    }
  }, [chartData]);

  return (
    <div id="weekly-trends-box" className="glass-heavy rounded-3xl shadow-2xl p-6 md:p-8 space-y-8 relative overflow-hidden">
      
      {/* Decorative aurora orbs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-violet-500/8 rounded-full blur-[100px] pointer-events-none animate-breathe" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none animate-breathe" style={{ animationDelay: '2s' }} />

      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-cyan-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-gradient-aurora font-display font-bold text-2xl leading-tight">Weekly Civic Impact</h2>
            <p className="text-slate-400 text-xs mt-0.5 font-medium">Real-time narrative summarizing municipal trends & developments</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {mapReports.length < 2 && (
            <button
              onClick={seedMockReports}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:opacity-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-violet-500/10 cursor-pointer"
              title="Add 7 days of test reports across various categories to build the charts"
            >
              Seed Trend Data
            </button>
          )}

          <button 
            id="trends-refresh-btn"
            onClick={fetchTrendsData}
            disabled={loading}
            className="p-2.5 glass hover:border-violet-500/30 text-slate-400 hover:text-violet-400 rounded-xl transition-all duration-300 disabled:opacity-50 active:scale-95 shadow-sm cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-5">
          {/* Orbital loader */}
          <div className="relative flex items-center justify-center w-16 h-16">
            <div className="absolute w-20 h-20 bg-gradient-to-br from-violet-500/15 to-cyan-500/15 rounded-full blur-xl animate-glow-pulse" />
            <div className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/30" />
            <div className="absolute w-full h-full animate-orbit" style={{ animationDuration: '1.8s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-lg shadow-violet-400/50" />
            </div>
            <div className="absolute w-full h-full animate-orbit" style={{ animationDuration: '2.4s', animationDelay: '0.6s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            </div>
            <div className="absolute w-full h-full animate-orbit" style={{ animationDuration: '3s', animationDelay: '1.2s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400 shadow-lg shadow-rose-400/50" />
            </div>
          </div>
          <div className="animate-fade-in-up">
            <p className="text-sm font-extrabold text-white">Synthesizing District Narrative...</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">Gemini AI is scanning active reports, calculating hot zones, and preparing your weekly digest.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in-up">
          
          {/* Geographic Heat Map Integration Centerpiece */}
          <TrendMap reports={mapReports} onSeedData={seedMockReports} />

          {/* 7-Day Trend Line Chart Card */}
          <div id="seven-day-trend-container" className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden shadow-xl space-y-6">
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
            
            {/* Chart Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                  <Activity size={15} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white">7-Day Incident Frequency</h3>
                  <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Historical report filing trajectories</p>
                </div>
              </div>

              {/* Interactive Dropdown Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Filter Category:</span>
                <div className="relative">
                  <select
                    id="chart-category-filter"
                    value={chartCategory}
                    onChange={(e) => setChartCategory(e.target.value)}
                    className="bg-slate-900/60 border border-white/10 rounded-xl pl-3.5 pr-8 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-violet-500 transition cursor-pointer appearance-none min-w-[145px]"
                  >
                    <option value="All">All Categories</option>
                    <option value="Pothole">Potholes</option>
                    <option value="Streetlight">Streetlights</option>
                    <option value="Garbage/Waste">Garbage & Waste</option>
                    <option value="Water Leakage">Water Leakages</option>
                    <option value="Damaged Public Property">Public Property</option>
                    <option value="Traffic Signal Issue">Traffic Signals</option>
                    <option value="Public Toilet Issue">Public Toilets</option>
                    <option value="Tree Fallen">Fallen Trees</option>
                    <option value="Illegal Dumping">Illegal Dumping</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500 text-[9px]">▼</div>
                </div>
              </div>
            </div>

            {/* Recharts Chart Wrapper */}
            <div className="h-[260px] w-full pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={10} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false}
                    dx={-5}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(139, 92, 246, 0.25)',
                      borderRadius: '12px',
                      color: '#f1f5f9',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#a78bfa' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-[11px] font-bold text-slate-300 ml-1.5">{value}</span>}
                  />
                  <Line 
                    name="Reports by Day" 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#0f172a' }}
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#8b5cf6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* One-line dynamic Insight Box */}
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center gap-2.5 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-xs">
                {trendInsight.direction === 'up' && (
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <TrendingUp size={13} />
                  </div>
                )}
                {trendInsight.direction === 'down' && (
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <TrendingDown size={13} />
                  </div>
                )}
                {trendInsight.direction === 'flat' && (
                  <div className="w-6 h-6 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 flex items-center justify-center shrink-0">
                    <Minus size={13} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-slate-400 font-semibold tracking-wider uppercase text-[8px] block">Service Analytics Insight</span>
                  <p id="trend-insight-text" className="text-slate-200 font-medium text-[11px] leading-tight mt-0.5">{trendInsight.text}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Main Gemini Statement Card */}
          <div className="glass-heavy gradient-border text-slate-100 p-6 md:p-7 rounded-2xl relative overflow-hidden shadow-2xl">
            {/* Ambient background glow */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <span className="text-[10px] uppercase font-black tracking-widest bg-gradient-to-r from-violet-950/80 to-cyan-950/80 border border-violet-500/20 text-violet-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 mb-4 w-fit">
                <Sparkles size={11} className="text-violet-300 animate-pulse shrink-0" /> Gemini Intelligence Summary
              </span>
              <span className="absolute -top-1 -left-1 text-6xl text-violet-500/10 font-serif leading-none select-none pointer-events-none">"</span>
              <p className="text-[14px] md:text-[16px] text-slate-200 leading-relaxed font-medium select-text italic pl-4">
                "{trendsText}"
              </p>
            </div>
          </div>

          {/* Predictive Civic Insights Card */}
          <div id="predictive-forecast-card" className="glass-heavy gradient-border text-slate-100 p-6 md:p-7 rounded-2xl relative overflow-hidden shadow-2xl">
            {/* Ambient background glow */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-black tracking-widest bg-gradient-to-r from-cyan-950/80 to-violet-950/80 border border-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
                    <Sparkles size={11} className="text-cyan-300 animate-pulse shrink-0" /> Gemini Forecast
                  </span>
                  {reportsCount > 0 ? (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      reportsCount >= 5 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {reportsCount >= 5 ? 'High confidence' : 'Moderate confidence'} ({reportsCount} {reportsCount === 1 ? 'report' : 'reports'})
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      No recent data
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-display font-black text-base text-white flex items-center gap-2">
                  📊 Next Week's Civic Forecast
                </h3>
                <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mt-0.5">AI-powered prediction based on 7-day trends</p>
              </div>

              <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 md:p-5 mt-2">
                <p className="text-[13px] md:text-[14px] text-slate-200 leading-relaxed font-medium select-text">
                  {forecastText || 'Generating predictive civic insights...'}
                </p>
              </div>
            </div>
          </div>

          {/* Bento Grid Metrics panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs font-semibold">
            
            {/* Metric Card 1 */}
            <div className="glass-card rounded-2xl p-5 hover:border-violet-500/15 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Logged (7 Days)</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/15 to-cyan-500/15 text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Calendar size={15} />
                </div>
              </div>
              <div>
                <span className="block font-display font-black text-3xl animate-count-up text-white mt-0.5">{reportsCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1">Community Grievances filed</span>
              </div>
            </div>

            {/* Metric Card 2 */}
            <div className="glass-card rounded-2xl p-5 hover:border-violet-500/15 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Resolved (7 Days)</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <CheckCircle2 size={15} />
                </div>
              </div>
              <div>
                <span className="block font-display font-black text-3xl animate-count-up text-emerald-400 mt-0.5">{resolvedCount}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1">Issues solved by services</span>
              </div>
            </div>

            {/* Metric Card 3 */}
            <div className="glass-card rounded-2xl p-5 hover:border-violet-500/15 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between gap-4 group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Active Hotspot Category</span>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/15 to-rose-500/15 text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <BarChart2 size={15} />
                </div>
              </div>
              <div>
                <span className="block text-md font-black text-violet-300 mt-1.5 truncate max-w-full leading-tight font-display">{topCategory}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1">Highest frequency complaint</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
