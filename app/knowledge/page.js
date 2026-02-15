'use client';

import { useState, useEffect } from 'react';
import { db, getRole } from '@/lib/db';
import { STATIONS, DEFECT_TYPES } from '@/lib/constants';
import CustomSelect from '@/components/CustomSelect';
import { useConfirm } from '@/components/ConfirmDialog';

const defaultEntry = {
    problem: '',
    rootCause: '',
    correctiveAction: '',
    beforeResults: '',
    afterResults: '',
    station: '',
    defectType: '',
    dateClosed: '',
    image: null,
};

export default function KnowledgeBankPage() {
    const [entries, setEntries] = useState([]);
    const [form, setForm] = useState(defaultEntry);
    const [showForm, setShowForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStation, setFilterStation] = useState('');
    const [filterDefect, setFilterDefect] = useState('');
    const [toast, setToast] = useState(null);
    const [role, setRoleState] = useState('Admin');
    const [loading, setLoading] = useState(true);

    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        loadEntries();
        setRoleState(getRole());
    }, []);

    const loadEntries = async () => {
        setLoading(true);
        const all = await db.getAll('knowledge');
        setEntries(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setLoading(false);
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setForm((prev) => ({ ...prev, image: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.problem || !form.rootCause || !form.correctiveAction) {
            showToast('Please fill problem, root cause, and corrective action', 'error');
            return;
        }
        await db.add('knowledge', form);
        setForm(defaultEntry);
        setShowForm(false);
        await loadEntries();
        showToast('Knowledge entry added');
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Delete Knowledge Entry',
            message: 'This knowledge entry will be permanently removed. This cannot be undone.',
            type: 'danger',
            confirmText: 'Delete',
        });
        if (!ok) return;
        setEntries((prev) => prev.filter((e) => e.id !== id));
        showToast('Entry deleted');
        await db.remove('knowledge', id);
    };

    const filtered = entries.filter((e) => {
        const q = searchQuery.toLowerCase();
        const matchSearch = q === '' ||
            e.problem?.toLowerCase().includes(q) ||
            e.rootCause?.toLowerCase().includes(q) ||
            e.correctiveAction?.toLowerCase().includes(q);
        const matchStation = filterStation === '' || e.station === filterStation;
        const matchDefect = filterDefect === '' || e.defectType === filterDefect;
        return matchSearch && matchStation && matchDefect;
    });

    const isViewer = role === 'Viewer';

    if (loading) return <div className="loading">Loading knowledge bank...</div>;

    return (
        <div>
            {/* Search and Filters */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="🔍 Search problems, root causes, corrective actions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <CustomSelect options={STATIONS} value={filterStation} onChange={setFilterStation} placeholder="All Stations" />
                <CustomSelect options={DEFECT_TYPES} value={filterDefect} onChange={setFilterDefect} placeholder="All Defects" />
                {!isViewer && (
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        ✚ Add Entry
                    </button>
                )}
            </div>

            {/* Add Entry Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
                        <h3>📚 New Knowledge Entry</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Station</label>
                                    <CustomSelect options={STATIONS} value={form.station} onChange={(v) => setForm({ ...form, station: v })} placeholder="Select Station" />
                                </div>
                                <div className="form-group">
                                    <label>Defect Type</label>
                                    <CustomSelect options={DEFECT_TYPES} value={form.defectType} onChange={(v) => setForm({ ...form, defectType: v })} placeholder="Select Defect" />
                                </div>
                                <div className="form-group">
                                    <label>Date Closed</label>
                                    <input type="date" value={form.dateClosed} onChange={(e) => setForm({ ...form, dateClosed: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Evidence Image</label>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: '12px' }} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Problem *</label>
                                    <textarea placeholder="Describe the problem that occurred..." value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Root Cause *</label>
                                    <textarea placeholder="What was identified as the root cause?" value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} />
                                </div>
                                <div className="form-group full-width">
                                    <label>Corrective Action *</label>
                                    <textarea placeholder="What corrective action was taken?" value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Before Results</label>
                                    <input type="text" placeholder="e.g., 12 defects/week" value={form.beforeResults} onChange={(e) => setForm({ ...form, beforeResults: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>After Results</label>
                                    <input type="text" placeholder="e.g., 2 defects/week" value={form.afterResults} onChange={(e) => setForm({ ...form, afterResults: e.target.value })} />
                                </div>
                            </div>
                            <div className="btn-group" style={{ marginTop: '24px' }}>
                                <button type="submit" className="btn btn-primary">✚ Save Entry</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Results count */}
            {!loading && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 500 }}>
                    {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} found
                    {(searchQuery || filterStation || filterDefect) && ' (filtered)'}
                </div>
            )}

            {/* Knowledge cards */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📚</div>
                    <h3>No knowledge entries found</h3>
                    <p>Add solved issues to build your PM Line Digital Learning Library</p>
                </div>
            ) : (
                <div className="cards-grid">
                    {filtered.map((entry) => (
                        <div key={entry.id} className="knowledge-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                <h4>🔧 {entry.problem}</h4>
                                {!isViewer && (
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id)} style={{ flexShrink: 0, padding: '4px 10px' }}>✕</button>
                                )}
                            </div>

                            <div className="kb-field">
                                <div className="kb-field-label">Root Cause</div>
                                <div className="kb-field-value">{entry.rootCause}</div>
                            </div>

                            <div className="kb-field">
                                <div className="kb-field-label">Corrective Action</div>
                                <div className="kb-field-value">{entry.correctiveAction}</div>
                            </div>

                            {(entry.beforeResults || entry.afterResults) && (
                                <div className="kb-results">
                                    <div className="kb-result-box before">
                                        <div className="kb-field-label">Before</div>
                                        {entry.beforeResults || '—'}
                                    </div>
                                    <div className="kb-result-box after">
                                        <div className="kb-field-label">After</div>
                                        {entry.afterResults || '—'}
                                    </div>
                                </div>
                            )}

                            {entry.image && (
                                <div style={{ marginTop: '14px' }}>
                                    <img
                                        src={entry.image}
                                        alt="Evidence"
                                        style={{ width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', maxHeight: '200px', objectFit: 'cover' }}
                                    />
                                </div>
                            )}

                            <div className="kb-meta">
                                {entry.station && <span className="badge badge-blue">{entry.station}</span>}
                                {entry.defectType && <span className="badge badge-yellow">{entry.defectType}</span>}
                                {entry.dateClosed && <span style={{ fontSize: '11px' }}>Closed: {entry.dateClosed}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {ConfirmDialog}
            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}
