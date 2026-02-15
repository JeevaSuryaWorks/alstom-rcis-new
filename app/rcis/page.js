'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    generateInsights, detectRecurrence,
    analyzeDefectByShift, analyzeDefectByStation, analyzeDefectByBatch,
} from '@/lib/analytics';
import { STATIONS, SHIFTS, MATERIAL_BATCHES } from '@/lib/constants';

import DateRangePicker from '@/components/DateRangePicker';

export default function RCISPage() {
    const [insights, setInsights] = useState([]);
    const [recurrences, setRecurrences] = useState([]);
    const [shiftData, setShiftData] = useState({});
    const [stationData, setStationData] = useState({});
    const [batchData, setBatchData] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('shift');
    const [dateRange, setDateRange] = useState({ start: null, end: null });

    useEffect(() => {
        (async () => {
            setLoading(true);
            const range = dateRange.start && dateRange.end ? dateRange : 30;
            const [ins, rec, sd, std, bd] = await Promise.all([
                generateInsights(range),
                detectRecurrence(3, 7, range),
                analyzeDefectByShift(range),
                analyzeDefectByStation(range),
                analyzeDefectByBatch(range),
            ]);
            setInsights(ins);
            setRecurrences(rec);
            setShiftData(sd);
            setStationData(std);
            setBatchData(bd);
            setLoading(false);
        })();
    }, [dateRange]);

    const renderCrossTab = (data, columns) => {
        const defects = Object.keys(data);
        if (defects.length === 0) return <p className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>No data available</p>;
        return (
            <div style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Defect Type</th>
                            {columns.map((c) => <th key={c}>{c}</th>)}
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {defects.map((defect) => {
                            const row = data[defect];
                            const total = Object.values(row).reduce((a, b) => a + b, 0);
                            return (
                                <tr key={defect}>
                                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{defect}</td>
                                    {columns.map((c) => {
                                        const val = row[c] || 0;
                                        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                                        const isHot = pct >= 50;
                                        return (
                                            <td key={c} style={{
                                                textAlign: 'center',
                                                color: isHot ? '#ef4444' : pct >= 30 ? '#f59e0b' : 'inherit',
                                                fontWeight: isHot ? 700 : 400,
                                                background: isHot ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                                            }}>
                                                {val > 0 ? val : '·'}
                                                {val > 0 && <span className="text-muted" style={{ fontSize: '10px', marginLeft: '3px' }}>({pct}%)</span>}
                                            </td>
                                        );
                                    })}
                                    <td style={{ fontWeight: 700, textAlign: 'center' }}>{total}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    if (loading) return <div className="loading">Analyzing patterns...</div>;

    const tabs = [
        { key: 'shift', label: '🌗 Shift', data: shiftData, cols: SHIFTS },
        { key: 'station', label: '🏭 Station', data: stationData, cols: STATIONS },
        { key: 'batch', label: '📦 Batch', data: batchData, cols: MATERIAL_BATCHES },
    ];

    return (
        <div>
            {/* Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <DateRangePicker
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    onChange={setDateRange}
                />
            </div>

            {/* Recurrence alerts */}
            {recurrences.length > 0 && (
                <div className="alert-banner danger">
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                    <div>
                        <strong>Recurrence Alert — </strong>
                        {recurrences.map((r, i) => (
                            <span key={i}>
                                <strong>{r.defect}</strong> ({r.count}x in 7d)
                                {i < recurrences.length - 1 ? ' · ' : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* KPI Summary */}
            <div className="kpi-grid">
                <div className="kpi-card purple">
                    <div className="kpi-icon">🧠</div>
                    <div className="kpi-label">Insights Found</div>
                    <div className="kpi-value">{insights.length}</div>
                </div>
                <div className="kpi-card red">
                    <div className="kpi-icon">🔁</div>
                    <div className="kpi-label">Recurring Defects</div>
                    <div className="kpi-value">{recurrences.length}</div>
                </div>
                <div className="kpi-card orange">
                    <div className="kpi-icon">🔍</div>
                    <div className="kpi-label">Defect Types Tracked</div>
                    <div className="kpi-value">{Object.keys(shiftData).length}</div>
                </div>
            </div>

            {/* Insights */}
            <div className="section-card">
                <h3>
                    🧠 Auto-Generated Insights
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '12px' }}>
                        (Generated from Rework Entry Data)
                    </span>
                </h3>
                {insights.length === 0 ? (
                    <div className="empty-state" style={{ padding: '30px' }}>
                        <div className="empty-icon">🔍</div>
                        <h3>No significant patterns detected</h3>
                        <p>More data is needed for pattern recognition</p>
                    </div>
                ) : (
                    <div className="insight-grid">
                        {insights.map((insight, i) => (
                            <div key={i} className={`insight-card ${insight.severity}`}>
                                <div className="insight-type">{insight.type}</div>
                                <p className="insight-msg">{insight.message}</p>
                                <p className="insight-detail">{insight.detail}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cross-tab analysis with tabs */}
            <div className="section-card">
                <h3>📊 Defect Distribution Analysis</h3>

                {/* Tab pills */}
                <div className="filter-pills" style={{ marginBottom: '16px' }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            className={`pill ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Active table */}
                {tabs
                    .filter((t) => t.key === activeTab)
                    .map((t) => (
                        <div key={t.key}>{renderCrossTab(t.data, t.cols)}</div>
                    ))}
            </div>

            {/* Recurrence Chart */}
            {recurrences.length > 0 && (
                <div className="chart-card">
                    <h3><span className="chart-icon">🔁</span> Recurrence Frequency (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={recurrences} barCategoryGap="20%" margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis
                                dataKey="defect"
                                tick={{ fill: '#5a6e85', fontSize: 11 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                                tickLine={false}
                                angle={-30}
                                textAnchor="end"
                                height={70}
                                interval={0}
                            />
                            <YAxis
                                tick={{ fill: '#5a6e85', fontSize: 12 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(12, 23, 38, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 10,
                                    fontSize: 12,
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                }}
                            />
                            <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} name="Occurrences" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
