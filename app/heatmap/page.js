'use client';

import { useState, useEffect } from 'react';
import { getRiskHeatMap } from '@/lib/analytics';
import { STATIONS, SEVERITY_LEVELS, SEVERITY_COLORS } from '@/lib/constants';
import ExportPanel from '@/components/ExportPanel';

import DateRangePicker from '@/components/DateRangePicker';

function getHeatColor(value, max) {
    if (value === 0) return 'transparent';
    const ratio = max > 0 ? value / max : 0;
    if (ratio <= 0.15) return 'rgba(16, 185, 129, 0.15)';
    if (ratio <= 0.35) return 'rgba(16, 185, 129, 0.35)';
    if (ratio <= 0.55) return 'rgba(245, 158, 11, 0.3)';
    if (ratio <= 0.75) return 'rgba(249, 115, 22, 0.4)';
    return 'rgba(239, 68, 68, 0.45)';
}

function getRiskLabel(value, max) {
    if (value === 0) return 'None';
    const ratio = max > 0 ? value / max : 0;
    if (ratio <= 0.15) return 'Low';
    if (ratio <= 0.35) return 'Moderate';
    if (ratio <= 0.55) return 'Elevated';
    if (ratio <= 0.75) return 'High';
    return 'Critical';
}

export default function HeatMapPage() {
    const [matrix, setMatrix] = useState(null);
    const [totals, setTotals] = useState({ total: 0, topStation: 'N/A', topSeverity: 'N/A', maxCell: 0, stationTotals: {}, sevTotals: {} });
    const [dateRange, setDateRange] = useState({ start: null, end: null });

    useEffect(() => {
        (async () => {
            const range = dateRange.start && dateRange.end ? dateRange : 30;
            const heatMap = await getRiskHeatMap(range);
            setMatrix(heatMap);

            let total = 0;
            let maxCell = 0;
            const stationTotals = {};
            const sevTotals = {};

            STATIONS.forEach((station) => {
                stationTotals[station] = 0;
                SEVERITY_LEVELS.forEach((sev) => {
                    const val = heatMap[station]?.[sev] || 0;
                    total += val;
                    stationTotals[station] += val;
                    sevTotals[sev] = (sevTotals[sev] || 0) + val;
                    if (val > maxCell) maxCell = val;
                });
            });

            const topStation = Object.entries(stationTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
            const topSeverity = Object.entries(sevTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
            setTotals({ total, topStation, topSeverity, maxCell, stationTotals, sevTotals });
        })();
    }, [dateRange]);

    // ——— Export callbacks ———
    const rangeLabel = (from, to) => from && to ? `${from} to ${to}` : from ? `From ${from}` : to ? `Up to ${to}` : 'Last 30 Days';

    const getExcelData = () => {
        const rows = STATIONS.map((station) => {
            const row = { Station: station };
            SEVERITY_LEVELS.forEach((sev) => { row[sev] = matrix[station]?.[sev] || 0; });
            row.Total = SEVERITY_LEVELS.reduce((s, sev) => s + (matrix[station]?.[sev] || 0), 0);
            row['Risk Level'] = getRiskLabel(row.Total, totals.maxCell * SEVERITY_LEVELS.length);
            return row;
        });
        return [{ sheetName: 'Risk Heat Map', rows }];
    };

    const getPdfContent = () => ({
        headers: { title: 'Risk Heat Map Report', subtitle: `Alstom RCIS — ${rangeLabel(dateRange.start, dateRange.end)}` },
        summary: [
            `Report Period: ${rangeLabel(dateRange.start, dateRange.end)}`,
            `Total Defects: ${totals.total}`,
            `Highest Risk Station: ${totals.topStation}`,
            `Dominant Severity: ${totals.topSeverity}`,
            `Date: ${new Date().toLocaleDateString('en-IN')}`,
        ],
        tables: [{
            title: 'Station × Severity Risk Matrix',
            headers: ['Station', ...SEVERITY_LEVELS, 'Total', 'Risk Level'],
            rows: STATIONS.map((station) => {
                const rowTotal = SEVERITY_LEVELS.reduce((s, sev) => s + (matrix[station]?.[sev] || 0), 0);
                return [
                    station,
                    ...SEVERITY_LEVELS.map((sev) => matrix[station]?.[sev] || 0),
                    rowTotal,
                    getRiskLabel(rowTotal, totals.maxCell * SEVERITY_LEVELS.length),
                ];
            }),
        }],
    });

    const getCsvData = () => ({
        headers: ['Station', ...SEVERITY_LEVELS, 'Total'],
        rows: STATIONS.map((station) => {
            const cells = SEVERITY_LEVELS.map((sev) => matrix[station]?.[sev] || 0);
            return [station, ...cells, cells.reduce((a, b) => a + b, 0)];
        }),
    });

    const getEmailDraft = () => {
        const top3 = Object.entries(totals.stationTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const range = rangeLabel(dateRange.start, dateRange.end);
        return {
            subject: `[Alstom RCIS] Risk Heat Map — ${range} — ${new Date().toLocaleDateString('en-IN')}`,
            body: [
                'Risk Heat Map Summary — Alstom PM Line',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                '',
                `Report Date: ${new Date().toLocaleDateString('en-IN')}`,
                `Period: ${range}`,
                `Total Defects: ${totals.total}`,
                `Highest Risk Station: ${totals.topStation}`,
                `Dominant Severity Level: ${totals.topSeverity}`,
                '',
                'Top 3 Stations by Defects:',
                ...top3.map(([station, count], i) => `  ${i + 1}. ${station}: ${count} defects`),
                '',
                'Severity Breakdown:',
                ...SEVERITY_LEVELS.map((sev) => `  ${sev}: ${totals.sevTotals[sev] || 0}`),
                '',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                'Action Required: Review high-risk stations and implement countermeasures.',
                '',
                'This email was drafted by Alstom RCIS. Please attach the full report for reference.',
            ].join('\n'),
        };
    };

    if (!matrix) return <div className="loading">Building heat map...</div>;

    return (
        <div>
            {/* Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
                <DateRangePicker
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    onChange={setDateRange}
                />
                <ExportPanel
                    title="Risk_Heat_Map"
                    getExcelData={getExcelData}
                    getPdfContent={getPdfContent}
                    getCsvData={getCsvData}
                    getEmailDraft={getEmailDraft}
                />
            </div>

            {/* KPI Summary */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon">🔢</div>
                    <div className="kpi-label">Total Defects (30d)</div>
                    <div className="kpi-value">{totals.total}</div>
                </div>
                <div className="kpi-card red">
                    <div className="kpi-icon">🏭</div>
                    <div className="kpi-label">Highest Risk Station</div>
                    <div className="kpi-value" style={{ fontSize: '22px' }}>{totals.topStation}</div>
                </div>
                <div className="kpi-card orange">
                    <div className="kpi-icon">⚡</div>
                    <div className="kpi-label">Dominant Severity</div>
                    <div className="kpi-value" style={{ fontSize: '22px' }}>{totals.topSeverity}</div>
                </div>
                <div className="kpi-card green">
                    <div className="kpi-icon">📊</div>
                    <div className="kpi-label">Stations Tracked</div>
                    <div className="kpi-value">{STATIONS.length}</div>
                </div>
            </div>

            {/* Heat Map Table */}
            <div className="section-card">
                <h3>🗺️ Station × Severity Risk Matrix</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="heatmap-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Station</th>
                                {SEVERITY_LEVELS.map((sev) => (
                                    <th key={sev} style={{ color: SEVERITY_COLORS[sev] }}>{sev}</th>
                                ))}
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {STATIONS.map((station) => {
                                const rowTotal = SEVERITY_LEVELS.reduce((sum, sev) => sum + (matrix[station]?.[sev] || 0), 0);
                                return (
                                    <tr key={station}>
                                        <td style={{ fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{station}</td>
                                        {SEVERITY_LEVELS.map((sev) => {
                                            const val = matrix[station]?.[sev] || 0;
                                            return (
                                                <td key={sev} style={{
                                                    background: getHeatColor(val, totals.maxCell),
                                                    textAlign: 'center',
                                                    fontWeight: val > 0 ? 700 : 400,
                                                    fontSize: '15px',
                                                    color: val === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                                                    transition: 'all 0.2s',
                                                }}>
                                                    {val}
                                                </td>
                                            );
                                        })}
                                        <td style={{ fontWeight: 800, fontSize: '15px', textAlign: 'center' }}>{rowTotal}</td>
                                    </tr>
                                );
                            })}
                            {/* Totals row */}
                            <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                                <td style={{ fontWeight: 700, textAlign: 'left', color: 'var(--text-accent)' }}>Total</td>
                                {SEVERITY_LEVELS.map((sev) => (
                                    <td key={sev} style={{ fontWeight: 700, textAlign: 'center', color: SEVERITY_COLORS[sev] }}>
                                        {totals.sevTotals[sev] || 0}
                                    </td>
                                ))}
                                <td style={{ fontWeight: 900, textAlign: 'center', fontSize: '16px', color: 'var(--text-accent)' }}>{totals.total}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '14px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Risk Level:</span>
                    {[
                        { label: 'None', color: 'transparent', border: true },
                        { label: 'Low', color: 'rgba(16, 185, 129, 0.15)' },
                        { label: 'Moderate', color: 'rgba(16, 185, 129, 0.35)' },
                        { label: 'Elevated', color: 'rgba(245, 158, 11, 0.3)' },
                        { label: 'High', color: 'rgba(249, 115, 22, 0.4)' },
                        { label: 'Critical', color: 'rgba(239, 68, 68, 0.45)' },
                    ].map((item) => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <div style={{
                                width: 14, height: 14, borderRadius: 3,
                                background: item.color,
                                border: item.border ? '1px solid var(--border-color)' : 'none',
                            }} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
