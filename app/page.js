'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart,
} from 'recharts';
import {
  getWeeklyTotal, getMonthlyTotal, getMonthlyTrend,
  getStationDefectPercent, getTopDefects, getShiftComparison,
  getSeverityDistribution, getTopStation, getTopDefect, detectRecurrence,
} from '@/lib/analytics';
import ExportPanel from '@/components/ExportPanel';

import DateRangePicker from '@/components/DateRangePicker';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#f59e0b'];
const SEVERITY_CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const chartTooltipStyle = {
  background: 'rgba(12, 23, 38, 0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '12px',
  color: '#edf2f7',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const axisStyle = { fill: '#5a6e85', fontSize: 11 };
const gridStroke = 'rgba(255,255,255,0.04)';
const axisLineStyle = { stroke: 'rgba(255,255,255,0.06)' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={chartTooltipStyle}>
      <p style={{ fontWeight: 600, marginBottom: 4, color: '#edf2f7' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color, lineHeight: 1.6 }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  useEffect(() => {
    (async () => {
      // Use selected range or default to 30 days
      const range = dateRange.start && dateRange.end ? dateRange : 30;

      const [weeklyTotal, monthlyTotal, monthlyTrend, stationPercent, topDefects, shiftComparison, severityDist, topStation, topDefect, recurrences] = await Promise.all([
        getWeeklyTotal(range),
        getMonthlyTotal(range),
        getMonthlyTrend(), // Keeping trend fixed for 6 months history
        getStationDefectPercent(range),
        getTopDefects(5, range),
        getShiftComparison(range),
        getSeverityDistribution(range),
        getTopStation(range),
        getTopDefect(range),
        detectRecurrence(3, 7, range),
      ]);
      setData({ weeklyTotal, monthlyTotal, monthlyTrend, stationPercent, topDefects, shiftComparison, severityDist, topStation, topDefect, recurrences });
    })();
  }, [dateRange]); // Refetch when dateRange changes

  // ——— Export callbacks ———
  const rangeLabel = (from, to) => from && to ? `${from} to ${to}` : from ? `From ${from}` : to ? `Up to ${to}` : 'Last 30 Days';

  const getExcelData = (dateFrom, dateTo) => {
    if (!data) return [];
    return [
      {
        sheetName: 'KPI Summary',
        rows: [
          { Metric: 'Report Range', Value: rangeLabel(dateFrom, dateTo) },
          { Metric: 'Weekly Rework Count', Value: data.weeklyTotal },
          { Metric: 'Monthly Rework Count', Value: data.monthlyTotal },
          { Metric: 'Top Defect', Value: data.topDefect },
          { Metric: 'Top Station', Value: data.topStation },
        ],
      },
      {
        sheetName: 'Monthly Trend',
        rows: data.monthlyTrend.map((m) => ({ Month: m.month, Count: m.count })),
      },
      {
        sheetName: 'Station Defect %',
        rows: data.stationPercent.map((s) => ({ Station: s.station, Count: s.count, 'Percent (%)': s.percent })),
      },
      {
        sheetName: 'Top Defects',
        rows: data.topDefects.map((d) => ({ Defect: d.defect, Count: d.count, 'Percent (%)': d.percent, 'Cumulative (%)': d.cumulative })),
      },
      {
        sheetName: 'Shift Comparison',
        rows: data.shiftComparison.map((s) => ({ Shift: s.shift, Count: s.count })),
      },
      {
        sheetName: 'Severity Distribution',
        rows: data.severityDist.map((s) => ({ Severity: s.severity, Count: s.count })),
      },
      ...(data.recurrences.length > 0
        ? [{
          sheetName: 'Recurrence Alerts',
          rows: data.recurrences.map((r) => ({ Defect: r.defect, Occurrences: r.count, 'Window (days)': r.windowDays })),
        }]
        : []),
    ];
  };

  const getPdfContent = (dateFrom, dateTo) => {
    if (!data) return { headers: { title: 'Dashboard' }, summary: [], tables: [] };
    return {
      headers: { title: 'Dashboard Report', subtitle: `Alstom RCIS — ${rangeLabel(dateFrom, dateTo)}` },
      summary: [
        `Report Period: ${rangeLabel(dateFrom, dateTo)}`,
        `Weekly Rework Count: ${data.weeklyTotal}`,
        `Monthly Rework Count: ${data.monthlyTotal}`,
        `Top Defect: ${data.topDefect}`,
        `Top Station: ${data.topStation}`,
        ...(data.recurrences.length > 0
          ? [`Recurring defect alerts: ${data.recurrences.map((r) => `${r.defect} (${r.count}x)`).join(', ')}`]
          : []),
      ],
      tables: [
        {
          title: 'Monthly Rework Trend (Last 6 Months)',
          headers: ['Month', 'Rework Count'],
          rows: data.monthlyTrend.map((m) => [m.month, m.count]),
        },
        {
          title: 'Station-wise Defect Distribution',
          headers: ['Station', 'Count', 'Percent (%)'],
          rows: data.stationPercent.filter((s) => s.count > 0).map((s) => [s.station, s.count, s.percent + '%']),
        },
        {
          title: 'Top 5 Defects (Pareto)',
          headers: ['Defect', 'Count', 'Percent (%)', 'Cumulative (%)'],
          rows: data.topDefects.map((d) => [d.defect, d.count, d.percent + '%', d.cumulative + '%']),
        },
        {
          title: 'Shift Comparison',
          headers: ['Shift', 'Rework Count'],
          rows: data.shiftComparison.map((s) => [s.shift, s.count]),
        },
        {
          title: 'Severity Distribution',
          headers: ['Severity', 'Count'],
          rows: data.severityDist.map((s) => [s.severity, s.count]),
        },
      ],
    };
  };

  const getCsvData = (dateFrom, dateTo) => {
    if (!data) return { headers: [], rows: [] };
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Report Range', rangeLabel(dateFrom, dateTo)],
      ['Weekly Rework Count', data.weeklyTotal],
      ['Monthly Rework Count', data.monthlyTotal],
      ['Top Defect', data.topDefect],
      ['Top Station', data.topStation],
      ['---', '---'],
      ['Month', 'Count'],
      ...data.monthlyTrend.map((m) => [m.month, m.count]),
      ['---', '---'],
      ['Station', 'Defect Count'],
      ...data.stationPercent.filter((s) => s.count > 0).map((s) => [s.station, s.count]),
      ['---', '---'],
      ['Top Defect', 'Count'],
      ...data.topDefects.map((d) => [d.defect, d.count]),
    ];
    return { headers, rows };
  };

  const getEmailDraft = (dateFrom, dateTo) => {
    if (!data) return { subject: '', body: '' };
    const dateStr = new Date().toLocaleDateString('en-IN');
    const range = rangeLabel(dateFrom, dateTo);
    return {
      subject: `[Alstom RCIS] Dashboard Report — ${range} — ${dateStr}`,
      body: [
        'Alstom PM Line — Dashboard Summary',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `Report Date: ${dateStr}`,
        `Period: ${range}`,
        '',
        'KEY METRICS:',
        `  Weekly Rework Count:  ${data.weeklyTotal}`,
        `  Monthly Rework Count: ${data.monthlyTotal}`,
        `  Top Defect:           ${data.topDefect}`,
        `  Top Station:          ${data.topStation}`,
        '',
        ...(data.recurrences.length > 0
          ? [
            '⚠ RECURRING DEFECT ALERTS:',
            ...data.recurrences.map((r) => `  • ${r.defect}: ${r.count} occurrences in ${r.windowDays} days`),
            '',
          ]
          : []),
        'TOP DEFECTS (Pareto):',
        ...data.topDefects.map((d, i) => `  ${i + 1}. ${d.defect}: ${d.count} (${d.percent}%)`),
        '',
        'SHIFT COMPARISON:',
        ...data.shiftComparison.map((s) => `  ${s.shift}: ${s.count} reworks`),
        '',
        'SEVERITY BREAKDOWN:',
        ...data.severityDist.map((s) => `  ${s.severity}: ${s.count}`),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'Action Required: Please review the recurring defect alerts and take corrective action.',
        '',
        'This email was drafted by Alstom RCIS. Please attach the full PDF/Excel report for reference.',
      ].join('\n'),
    };
  };

  if (!data) return <div className="loading">Loading dashboard...</div>;

  if (!data) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={setDateRange}
        />
        <ExportPanel
          title="Dashboard_Report"
          getExcelData={() => getExcelData(dateRange.start, dateRange.end)}
          getPdfContent={() => getPdfContent(dateRange.start, dateRange.end)}
          getCsvData={() => getCsvData(dateRange.start, dateRange.end)}
          getEmailDraft={() => getEmailDraft(dateRange.start, dateRange.end)}
        />
      </div>

      {/* Recurrence Alerts */}
      {data.recurrences.length > 0 && (
        <div className="alert-banner warning">
          <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
          <div>
            <strong>Recurring Defect Alerts:</strong>&nbsp;
            {data.recurrences.map((r, i) => (
              <span key={i}>
                <strong>{r.defect}</strong> ({r.count}x in {r.windowDays}d)
                {i < data.recurrences.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">🔧</div>
          <div className="kpi-label">This Week</div>
          <div className="kpi-value">{data.weeklyTotal}</div>
          <div className="kpi-sub">Rework quantity</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">📅</div>
          <div className="kpi-label">This Month</div>
          <div className="kpi-value">{data.monthlyTotal}</div>
          <div className="kpi-sub">Rework quantity</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon">🎯</div>
          <div className="kpi-label">Top Defect</div>
          <div className="kpi-value" style={{ fontSize: '18px' }}>{data.topDefect}</div>
          <div className="kpi-sub">Most frequent this month</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon">🏭</div>
          <div className="kpi-label">Top Station</div>
          <div className="kpi-value" style={{ fontSize: '18px' }}>{data.topStation}</div>
          <div className="kpi-sub">Highest rework count</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Monthly Trend */}
        <div className="chart-card full-width">
          <h3><span className="chart-icon">📈</span> Monthly Rework Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={axisLineStyle} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#trendGrad)" strokeWidth={2.5} name="Rework Count" dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Station-wise Defect % */}
        <div className="chart-card">
          <h3><span className="chart-icon">🏭</span> Station-wise Defect %</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.stationPercent}
                dataKey="count"
                nameKey="station"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={55}
                paddingAngle={3}
                label={({ station, percent }) => `${station} ${percent}%`}
                stroke="none"
              >
                {data.stationPercent.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Defects Pareto */}
        <div className="chart-card">
          <h3><span className="chart-icon">📊</span> Top Defects (Pareto)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data.topDefects} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="defect"
                tick={{ ...axisStyle, fontSize: 11 }}
                axisLine={axisLineStyle}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                height={70}
                interval={0}
              />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={axisLineStyle} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={axisLineStyle} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Count" />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 3 }} name="Cumulative %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Shift Comparison */}
        <div className="chart-card">
          <h3><span className="chart-icon">🌗</span> Shift Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.shiftComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="shift" tick={axisStyle} axisLine={axisLineStyle} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Rework Count" barSize={50}>
                {data.shiftComparison.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution */}
        <div className="chart-card">
          <h3><span className="chart-icon">⚡</span> Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.severityDist}
                dataKey="count"
                nameKey="severity"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={55}
                paddingAngle={3}
                label={({ severity, count }) => `${severity}: ${count}`}
                stroke="none"
              >
                {data.severityDist.map((_, i) => (
                  <Cell key={i} fill={SEVERITY_CHART_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
