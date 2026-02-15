// Pattern Detection & Analytics Engine – Async (Supabase)

import { db } from './db';
import { STATIONS, DEFECT_TYPES, SHIFTS, SEVERITY_LEVELS } from './constants';

// Helper: group by a key and count
function groupByCount(items, key) {
    const counts = {};
    items.forEach((item) => {
        const val = item[key] || 'Unknown';
        counts[val] = (counts[val] || 0) + (item.quantity || 1);
    });
    return counts;
}

// Helper: cross-tab analysis
function crossTab(items, key1, key2) {
    const result = {};
    items.forEach((item) => {
        const k1 = item[key1] || 'Unknown';
        const k2 = item[key2] || 'Unknown';
        if (!result[k1]) result[k1] = {};
        result[k1][k2] = (result[k1][k2] || 0) + (item.quantity || 1);
    });
    return result;
}

// Get rework data within a date range (days lookback or specific start/end dates)
export async function getReworksInRange(range = 30) {
    const reworks = await db.getAll('reworks');
    let start, end;

    if (typeof range === 'object' && range.start && range.end) {
        start = new Date(range.start);
        end = new Date(range.end);
        // Include the entire end day
        end.setHours(23, 59, 59, 999);
    } else {
        // Numeric days lookback
        const days = typeof range === 'number' ? range : 30;
        start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        end = new Date();
    }

    return reworks.filter((r) => {
        const d = new Date(r.date);
        return d >= start && d <= end;
    });
}

// Weekly total
export async function getWeeklyTotal(range = 7) {
    const data = await getReworksInRange(range);
    return data.reduce((sum, r) => sum + (r.quantity || 1), 0);
}

// Monthly total
export async function getMonthlyTotal(range = 30) {
    const data = await getReworksInRange(range);
    return data.reduce((sum, r) => sum + (r.quantity || 1), 0);
}

// Monthly trend (last 6 months) - This one is tricky with custom range, usually stays fixed or adapts?
// For now, let's keep it fixed as "Monthly Trend" usually implies a specific visual. 
// Or better: if range is provided, show trend within that range? 
// Current impl uses strict 6 months loop. Let's leave it fixed for now as it's a specific "Trend" chart.
export async function getMonthlyTrend() {
    const reworks = await db.getAll('reworks');
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);

        const count = reworks
            .filter((r) => {
                const rd = new Date(r.date);
                return rd >= d && rd < nextMonth;
            })
            .reduce((sum, r) => sum + (r.quantity || 1), 0);

        months.push({ month: monthKey, count });
    }
    return months;
}

// Station-wise defect percentage
export async function getStationDefectPercent(range = 30) {
    const data = await getReworksInRange(range);
    const counts = groupByCount(data, 'station');
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return STATIONS.map((s) => ({
        station: s,
        count: counts[s] || 0,
        percent: Math.round(((counts[s] || 0) / total) * 100),
    }));
}

// Top N defects (Pareto)
export async function getTopDefects(n = 5, range = 30) {
    const data = await getReworksInRange(range);
    const counts = groupByCount(data, 'defectType');
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);

    const total = sorted.reduce((s, [, c]) => s + c, 0) || 1;
    let cumulative = 0;
    return sorted.map(([defect, count]) => {
        cumulative += count;
        return {
            defect,
            count,
            percent: Math.round((count / total) * 100),
            cumulative: Math.round((cumulative / total) * 100),
        };
    });
}

// Shift comparison
export async function getShiftComparison(range = 30) {
    const data = await getReworksInRange(range);
    const counts = groupByCount(data, 'shift');
    return SHIFTS.map((s) => ({ shift: s, count: counts[s] || 0 }));
}

// Severity distribution
export async function getSeverityDistribution(range = 30) {
    const data = await getReworksInRange(range);
    const counts = groupByCount(data, 'severity');
    return SEVERITY_LEVELS.map((s) => ({ severity: s, count: counts[s] || 0 }));
}

// --- RCIS Pattern Detection ---

export async function analyzeDefectByShift(range = 30) {
    const data = await getReworksInRange(range);
    return crossTab(data, 'defectType', 'shift');
}

export async function analyzeDefectByStation(range = 30) {
    const data = await getReworksInRange(range);
    return crossTab(data, 'defectType', 'station');
}

export async function analyzeDefectByBatch(range = 30) {
    const data = await getReworksInRange(range);
    return crossTab(data, 'defectType', 'materialBatch');
}

// Detect recurrence: same defect > threshold times in windowDays
// If range is provided, use it as the analysis window
export async function detectRecurrence(threshold = 3, windowDays = 7, range = null) {
    const effectiveRange = range || windowDays;
    const data = await getReworksInRange(effectiveRange);
    const counts = groupByCount(data, 'defectType');
    const recurring = [];
    Object.entries(counts).forEach(([defect, count]) => {
        if (count >= threshold) {
            recurring.push({ defect, count, windowDays: range ? 'Range' : windowDays });
        }
    });
    return recurring.sort((a, b) => b.count - a.count);
}

// Generate natural-language insights
export async function generateInsights(range = 30) {
    const insights = [];

    const shiftData = await analyzeDefectByShift(range);
    Object.entries(shiftData).forEach(([defect, shifts]) => {
        const total = Object.values(shifts).reduce((a, b) => a + b, 0);
        Object.entries(shifts).forEach(([shift, count]) => {
            const pct = Math.round((count / total) * 100);
            if (pct >= 60) {
                insights.push({
                    type: 'shift',
                    severity: 'high',
                    message: `${defect} ${pct}% linked to ${shift} Shift`,
                    defect,
                    detail: `${count} of ${total} occurrences`,
                });
            }
        });
    });

    const batchData = await analyzeDefectByBatch(range);
    Object.entries(batchData).forEach(([defect, batches]) => {
        const total = Object.values(batches).reduce((a, b) => a + b, 0);
        const sorted = Object.entries(batches).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            const [topBatch, topCount] = sorted[0];
            const pct = Math.round((topCount / total) * 100);
            if (pct >= 40 && topCount >= 3) {
                insights.push({
                    type: 'batch',
                    severity: 'medium',
                    message: `${defect} spike after ${topBatch} (${pct}%)`,
                    defect,
                    detail: `${topCount} of ${total} occurrences`,
                });
            }
        }
    });

    const recurrences = await detectRecurrence(3, 7, range);
    recurrences.forEach((r) => {
        insights.push({
            type: 'recurrence',
            severity: 'high',
            message: `⚠ Recurring defect: ${r.defect} – ${r.count} times in ${r.windowDays === 'Range' ? 'selected range' : r.windowDays + ' days'}`,
            defect: r.defect,
            detail: 'Review countermeasure',
        });
    });

    return insights;
}

// Risk Heat Map: station × severity matrix
export async function getRiskHeatMap(range = 30) {
    const data = await getReworksInRange(range);
    const matrix = {};
    STATIONS.forEach((station) => {
        matrix[station] = {};
        SEVERITY_LEVELS.forEach((sev) => {
            matrix[station][sev] = 0;
        });
    });

    data.forEach((r) => {
        if (matrix[r.station] && matrix[r.station][r.severity] !== undefined) {
            matrix[r.station][r.severity] += r.quantity || 1;
        }
    });

    return matrix;
}

// Get top station
export async function getTopStation(range = 30) {
    const data = await getReworksInRange(range);
    const counts = groupByCount(data, 'station');
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : 'N/A';
}

// Get top defect
export async function getTopDefect(range = 30) {
    const data = await getReworksInRange(range);
    const counts = groupByCount(data, 'defectType');
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : 'N/A';
}
