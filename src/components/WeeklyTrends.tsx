import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from 'recharts';
import TrendMap from './TrendMap';
import { CivicCategory, ReportStatus, SeverityLevel } from '../types';

export default function WeeklyTrends() {
  const [loading, setLoading] = useState(true);
  const [trendsText, setTrendsText] = useState('');
  const [forecastText, setForecastText] = useState('');
  const [reportsCount, setReportsCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [topCategory, setTopCategory] = useState('N/A');
  const [mapReports, setMapReports] = useState<any[]>([]);
  const [chartCategory, setChartCategory] = useState('All');

  const fetchTrendsData = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const q = query(collection(db, 'reports'), where('timestamp', '>=', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      const docs: any[] = [];
      snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const docs7Days = docs.filter(d => {
        const rDate = d.timestamp?.seconds ? new Date(d.timestamp.seconds * 1000) : new Date();
        return rDate >= sevenDaysAgo;
      });

      setReportsCount(docs7Days.length);
      setResolvedCount(docs7Days.filter(r => r.status === 'Resolved').length);

      if (docs7Days.length > 0) {
        const counts: Record<string, number> = {};
        docs7Days.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setTopCategory(`${top[0]} (${top[1]})`);
      } else {
        setTopCategory('None');
      }

      setMapReports(docs);

      const response = await fetch('/api/generate-trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: docs7Days })
      });
      if (!response.ok) throw new Error('Gemini trends request failed.');
      const result = await response.json();
      setTrendsText(result.summary || 'Summary compiled.');
      setForecastText(result.forecast || 'Prediction unavailable. Check back in a moment.');
    } catch (err: any) {
      console.error('Error fetching trends:', err);
      setTrendsText('Failed to aggregate weekly metrics. Make sure you have reports submitted and GEMINI_API_KEY is configured in Settings.');
      setForecastText('Prediction unavailable. Check back in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const seedMockReports = async () => {
    try {
      setLoading(true);
      const reportsCollection = collection(db, 'reports');
      const categories: CivicCategory[] = ['Pothole','Streetlight','Garbage/Waste','Water Leakage','Damaged Public Property','Traffic Signal Issue','Public Toilet Issue','Tree Fallen','Illegal Dumping','Other'];
      const baseLat = 37.7749, baseLng = -122.4194;
      const dailyCounts = [2, 5, 3, 7, 4, 6, 3];
      const promises: Promise<any>[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const count = dailyCounts[dayOffset];
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (6 - dayOffset));
        for (let j = 0; j < count; j++) {
          const cat = categories[(dayOffset + j) % categories.length];
          const lat = baseLat + (Math.random() - 0.5) * 0.015;
          const lng = baseLng + (Math.random() - 0.5) * 0.015;
          const severities: SeverityLevel[] = ['Low', 'Medium', 'High'];
          const statuses: ReportStatus[] = ['Reported', 'Under Review', 'Resolved'];
          promises.push(addDoc(reportsCollection, {
            category: cat,
            severity: severities[(dayOffset + j) % 3],
            severityReasoning: `Automated assessment for ${cat}.`,
            responsible_department: cat === 'Pothole' ? 'Municipal Corporation' : cat === 'Streetlight' ? 'Electricity Board' : 'Sanitation Department',
            formal_complaint_text: `Formal grievance regarding ${cat} at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}.`,
            userNotes: `${cat} issue reported in test data.`,
            location: { lat, lng, address: `SF District ${dayOffset + 1}, CA` },
            status: statuses[(dayOffset + j) % 3],
            timestamp: Timestamp.fromDate(targetDate),
            confirmations: Math.floor(Math.random() * 5) + 1,
            confirmedUsers: []
          }));
        }
      }
      await Promise.all(promises);
      await fetchTrendsData();
    } catch (err) {
      console.error('Seed error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrendsData(); }, []);

  const chartData = useMemo(() => {
    const daysList = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      daysList.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: 0 });
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    mapReports.forEach(r => {
      const rDate = r.timestamp?.seconds ? new Date(r.timestamp.seconds * 1000) : new Date();
      if (rDate >= sevenDaysAgo && (chartCategory === 'All' || r.category === chartCategory)) {
        const rLabel = rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const match = daysList.find(d => d.date === rLabel);
        if (match) match.count += 1;
      }
    });
    return daysList;
  }, [mapReports, chartCategory]);

  const trendInsight = useMemo(() => {
    if (chartData.length < 7) return { text: 'Steady report rate. Consistent civic engagement.', direction: 'flat' };
    const first = chartData[0].count + chartData[1].count + chartData[2].count;
    const last = chartData[4].count + chartData[5].count + chartData[6].count;
    if (last > first) return { text: 'Report volume increasing. Hotspots may need intervention.', direction: 'up' };
    if (last < first) return { text: 'Report volume decreasing. Current efforts working.', direction: 'down' };
    return { text: 'Steady report rate. Consistent civic engagement.', direction: 'flat' };
  }, [chartData]);

  return (
    <div id="weekly-trends-box" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="section-label">Analytics</div>
          <h1 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', margin: '4px 0 0' }}>Civic Trends</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {mapReports.length < 2 && (
            <button
              onClick={seedMockReports}
              className="btn-primary"
              style={{ fontSize: 12, padding: '8px 14px', borderRadius: 9, boxShadow: 'none' }}
              title="Add 7 days of test reports"
            >
              Seed Test Data
            </button>
          )}
          <button
            onClick={fetchTrendsData}
            disabled={loading}
            style={{ background: '#fff', border: '1px solid #E3E7EF', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#3A4456', cursor: 'pointer' }}
          >
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #EAF0FF', borderTopColor: '#244BD6', animation: 'cvSpin 1s linear infinite', margin: '0 auto 20px' }} />
          <p style={{ fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 16, margin: '0 0 6px' }}>Synthesizing District Narrative…</p>
          <p style={{ fontSize: 13, color: '#8A93A5', lineHeight: 1.5 }}>Gemini AI is scanning active reports and preparing your weekly digest.</p>
        </div>
      ) : (
        <>
          {/* Stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="grid-cols-1 sm:grid-cols-3">
            {/* Stat 1 */}
            <div className="civic-card" style={{ padding: '18px 20px' }}>
              <div className="section-label">Logged (7 days)</div>
              <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 34, margin: '6px 0 2px' }}>{reportsCount}</div>
              <div style={{ fontSize: 12, color: reportsCount > 0 ? '#15A05A' : '#9AA4B5', fontWeight: 600 }}>Community grievances filed</div>
            </div>
            {/* Stat 2 */}
            <div className="civic-card" style={{ padding: '18px 20px' }}>
              <div className="section-label">Resolved (7 days)</div>
              <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 34, margin: '6px 0 2px' }}>{resolvedCount}</div>
              <div style={{ fontSize: 12, color: '#15A05A', fontWeight: 600 }}>{reportsCount > 0 ? `${Math.round((resolvedCount/reportsCount)*100)}% closure rate` : '—'}</div>
            </div>
            {/* Stat 3 */}
            <div style={{ background: 'linear-gradient(135deg,#0F1A3D,#23306A)', color: '#fff', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9FB0E6', fontWeight: 600 }}>Active hotspot</div>
              <div style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 22, margin: '8px 0 2px' }}>{topCategory}</div>
              <div style={{ fontSize: 12, color: '#C7D2F2' }}>Highest frequency category</div>
            </div>
          </div>

          {/* Heat map */}
          <div className="civic-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #EEF1F6' }}>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, margin: 0 }}>Geographic Heat Map</h3>
                <div style={{ fontSize: 12.5, color: '#8A93A5', marginTop: 2 }}>Issue density across the district</div>
              </div>
            </div>
            <TrendMap reports={mapReports} onSeedData={seedMockReports} />
          </div>

          {/* 7-day line chart */}
          <div className="civic-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, margin: 0 }}>7-Day Incident Frequency</h3>
                <div style={{ fontSize: 12.5, color: '#8A93A5', marginTop: 2 }}>Historical report filing trajectory</div>
              </div>
              <select
                value={chartCategory}
                onChange={e => setChartCategory(e.target.value)}
                style={{ background: '#F2F4F8', border: '1px solid #E3E7EF', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, color: '#3A4456', cursor: 'pointer', outline: 'none' }}
              >
                <option value="All">All Categories</option>
                <option value="Pothole">Potholes</option>
                <option value="Streetlight">Streetlights</option>
                <option value="Garbage/Waste">Garbage &amp; Waste</option>
                <option value="Water Leakage">Water Leakages</option>
                <option value="Damaged Public Property">Public Property</option>
                <option value="Traffic Signal Issue">Traffic Signals</option>
                <option value="Public Toilet Issue">Public Toilets</option>
                <option value="Tree Fallen">Fallen Trees</option>
                <option value="Illegal Dumping">Illegal Dumping</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ height: 240, width: '100%', marginTop: 14 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" />
                  <XAxis dataKey="date" stroke="#9AA4B5" fontSize={12} fontFamily="'IBM Plex Mono'" tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#9AA4B5" fontSize={12} fontFamily="'IBM Plex Mono'" tickLine={false} axisLine={false} dx={-5} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #E3E7EF', borderRadius: 10, fontSize: 12, color: '#131A2A', boxShadow: '0 8px 24px -8px rgba(0,0,0,.15)' }}
                    itemStyle={{ color: '#244BD6' }}
                    labelStyle={{ color: '#8A93A5', fontSize: 11, marginBottom: 4 }}
                  />
                  <Line
                    name="Reports"
                    type="monotone"
                    dataKey="count"
                    stroke="#244BD6"
                    strokeWidth={3}
                    dot={{ r: 4.5, stroke: '#244BD6', strokeWidth: 3, fill: '#fff' }}
                    activeDot={{ r: 5.5, stroke: '#fff', strokeWidth: 3, fill: '#244BD6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Insight */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '11px 14px', borderRadius: 11 }} className="ai-accent-card">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#22B8CF)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#4A5468' }}>
                <strong style={{ color: '#6A4FD0' }}>AI insight:</strong> {trendInsight.text}
              </span>
            </div>
          </div>

          {/* Two AI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }} className="grid-cols-1 md:grid-cols-2">
            {/* Weekly Summary */}
            <div className="civic-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#22B8CF)' }} />
                <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: '#6A4FD0' }}>Weekly Civic Impact</span>
              </div>
              <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Gemini Intelligence Summary</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#4A5468', margin: 0 }}>{trendsText}</p>
            </div>
            {/* Forecast */}
            <div className="civic-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'linear-gradient(135deg,#7C5CFC,#22B8CF)' }} />
                  <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: '#6A4FD0' }}>Gemini Forecast</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#0F7A45', background: '#E4F5EC', padding: '4px 9px', borderRadius: 999 }}>
                  {reportsCount >= 5 ? 'High confidence' : 'Moderate confidence'}
                </span>
              </div>
              <h3 style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Next Week's Civic Forecast</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#4A5468', margin: 0 }}>{forecastText}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
