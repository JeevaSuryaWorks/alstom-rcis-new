'use client';

import { useState, useEffect } from 'react';
import { db, getRole, setRole as setRoleDb, seedDemoData } from '@/lib/db';
import { useConfirm } from '@/components/ConfirmDialog';

export default function SettingsPage() {
    const [role, setRoleState] = useState('Admin');
    const [stats, setStats] = useState({ reworks: 0, actions: 0, knowledge: 0 });
    const [toast, setToast] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [exporting, setExporting] = useState(false);

    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        setRoleState(getRole());
        loadStats();
    }, []);

    const loadStats = async () => {
        const [reworks, actions, knowledge] = await Promise.all([
            db.count('reworks'),
            db.count('actions'),
            db.count('knowledge'),
        ]);
        setStats({ reworks, actions, knowledge });
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleRoleChange = (newRole) => {
        setRoleDb(newRole);
        setRoleState(newRole);
        showToast(`Role changed to ${newRole}`);
    };

    const handleSeedData = async () => {
        const ok = await confirm({
            title: 'Seed Demo Data',
            message: 'This will insert comprehensive demo data into Supabase (150 reworks, 10 actions, 6 knowledge entries). Continue?',
            type: 'info',
            confirmText: 'Seed Data',
        });
        if (!ok) return;
        setSeeding(true);
        await seedDemoData();
        await loadStats();
        setSeeding(false);
        showToast('Demo data seeded to Supabase');
    };

    const handleClearData = async () => {
        const ok = await confirm({
            title: 'Remove All Data',
            message: `This will permanently delete ALL ${stats.reworks + stats.actions + stats.knowledge} records from Supabase. This action cannot be undone.`,
            type: 'danger',
            confirmText: 'Delete All Data',
        });
        if (!ok) return;
        setClearing(true);
        await db.clearAll();
        await loadStats();
        setClearing(false);
        showToast('All data cleared from Supabase');
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const XLSX = (await import('xlsx')).default;
            const [reworks, actions, knowledge] = await Promise.all([
                db.getAll('reworks'),
                db.getAll('actions'),
                db.getAll('knowledge'),
            ]);

            const wb = XLSX.utils.book_new();
            if (reworks.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reworks), 'Reworks');
            if (actions.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actions), 'Actions');
            if (knowledge.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(knowledge), 'Knowledge');

            XLSX.writeFile(wb, `RCIS_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('Excel file exported');
        } catch (err) {
            showToast('Export failed: ' + err.message, 'error');
        }
        setExporting(false);
    };

    const handleExportPDF = async () => {
        setExporting(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF();

            doc.setFontSize(18);
            doc.text('Alstom RCIS – Summary Report', 14, 20);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

            doc.setFontSize(12);
            doc.text('Data Statistics:', 14, 42);
            doc.setFontSize(10);
            doc.text(`• Rework Entries: ${stats.reworks}`, 20, 50);
            doc.text(`• Corrective Actions: ${stats.actions}`, 20, 57);
            doc.text(`• Knowledge Entries: ${stats.knowledge}`, 20, 64);

            const reworks = await db.getAll('reworks');
            if (reworks.length > 0) {
                doc.setFontSize(12);
                doc.text('Recent Rework Entries (Top 15):', 14, 78);
                doc.setFontSize(8);
                let y = 86;
                doc.text('Date | Station | Defect | Qty | Shift | Severity', 14, y);
                y += 6;
                reworks.slice(0, 15).forEach((r) => {
                    doc.text(`${r.date} | ${r.station} | ${r.defectType} | ${r.quantity} | ${r.shift} | ${r.severity}`, 14, y);
                    y += 5;
                    if (y > 280) { doc.addPage(); y = 20; }
                });
            }

            doc.save(`RCIS_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('PDF report generated');
        } catch (err) {
            showToast('PDF export failed: ' + err.message, 'error');
        }
        setExporting(false);
    };

    const totalRecords = stats.reworks + stats.actions + stats.knowledge;

    return (
        <div>
            {/* Role Management */}
            <div className="section-card">
                <h3>🔑 Role Management</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
                    Current role: <strong style={{ color: 'var(--text-accent)' }}>{role}</strong> — {role === 'Admin' ? 'Full access to all features' : 'View-only access, no editing'}
                </p>
                <div className="btn-group">
                    <button
                        className={`btn ${role === 'Admin' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleRoleChange('Admin')}
                    >
                        🔑 Admin
                    </button>
                    <button
                        className={`btn ${role === 'Viewer' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleRoleChange('Viewer')}
                    >
                        👁️ Viewer
                    </button>
                </div>
            </div>

            {/* Data Statistics */}
            <div className="section-card">
                <h3>📊 Database Statistics</h3>
                <div className="kpi-grid" style={{ marginTop: '16px' }}>
                    <div className="kpi-card">
                        <div className="kpi-icon">📝</div>
                        <div className="kpi-label">Rework Entries</div>
                        <div className="kpi-value">{stats.reworks}</div>
                    </div>
                    <div className="kpi-card green">
                        <div className="kpi-icon">✅</div>
                        <div className="kpi-label">Actions</div>
                        <div className="kpi-value">{stats.actions}</div>
                    </div>
                    <div className="kpi-card purple">
                        <div className="kpi-icon">📚</div>
                        <div className="kpi-label">Knowledge Entries</div>
                        <div className="kpi-value">{stats.knowledge}</div>
                    </div>
                    <div className="kpi-card">
                        <div className="kpi-icon">💾</div>
                        <div className="kpi-label">Total Records</div>
                        <div className="kpi-value">{totalRecords}</div>
                    </div>
                </div>
            </div>

            {/* Export */}
            <div className="section-card">
                <h3>📤 Export Data</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                    Download data from Supabase in Excel or PDF format
                </p>
                <div className="btn-group">
                    <button className="btn btn-primary" onClick={handleExportExcel} disabled={exporting || totalRecords === 0}>
                        📊 Export Excel
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportPDF} disabled={exporting || totalRecords === 0}>
                        📄 Export PDF Report
                    </button>
                </div>
                {totalRecords === 0 && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
                        No data available to export. Seed demo data first.
                    </p>
                )}
            </div>

            {/* Data Management */}
            {role === 'Admin' && (
                <div className="section-card">
                    <h3>🛠️ Data Management</h3>

                    {/* Seed */}
                    <div style={{
                        padding: '18px 20px',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '14px',
                        background: 'rgba(59, 130, 246, 0.03)',
                    }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>🌱 Seed Demo Data</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
                            Inserts comprehensive demo data into Supabase:
                            <strong> 150 reworks</strong> (90 days, realistic root causes) ·
                            <strong> 10 corrective actions</strong> (all statuses) ·
                            <strong> 6 knowledge entries</strong> (detailed analyses)
                        </p>
                        <button className="btn btn-primary" onClick={handleSeedData} disabled={seeding} style={{ minWidth: '200px' }}>
                            {seeding ? '⏳ Seeding... please wait' : '🌱 Seed Complete Demo Data'}
                        </button>
                    </div>

                    {/* Clear */}
                    <div style={{
                        padding: '18px 20px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(239, 68, 68, 0.03)',
                    }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', marginBottom: '8px' }}>🗑️ Remove All Data</div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.6 }}>
                            Permanently deletes <strong>all {totalRecords} records</strong> from Supabase. This cannot be undone.
                        </p>
                        <button className="btn btn-danger" onClick={handleClearData} disabled={clearing || totalRecords === 0} style={{ minWidth: '200px' }}>
                            {clearing ? '⏳ Clearing all data...' : '🗑️ Remove All Data'}
                        </button>
                    </div>
                </div>
            )}

            {/* System Information */}
            <div className="section-card">
                <h3>ℹ️ System Information</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '13px',
                }}>
                    {[
                        { label: 'Platform', value: 'Alstom RCIS v3.0' },
                        { label: 'Backend', value: 'Supabase (PostgreSQL)' },
                        { label: 'Framework', value: 'Next.js (App Router)' },
                        { label: 'Module', value: 'PM Line ESD Intelligence' },
                    ].map((item) => (
                        <div key={item.label} style={{
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                        }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '4px' }}>
                                {item.label}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {ConfirmDialog}
            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}
