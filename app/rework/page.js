'use client';

import { useState, useEffect } from 'react';
import { db, getRole } from '@/lib/db';
import {
    STATIONS, DEFECT_TYPES, SEVERITY_LEVELS,
    SHIFTS, OPERATOR_GROUPS,
} from '@/lib/constants';
import CustomSelect from '@/components/CustomSelect';
import { useConfirm } from '@/components/ConfirmDialog';

const defaultForm = {
    date: new Date().toISOString().split('T')[0],
    station: '',
    defectType: '',
    quantity: '1',
    shift: '',
    operatorGroup: '',
    materialBatch: '',
    severity: '',
    suspectedRootCause: '',
    remarks: '',
};

export default function ReworkEntryPage() {
    const [form, setForm] = useState(defaultForm);
    const [allEntries, setAllEntries] = useState([]);
    const [toast, setToast] = useState(null);
    const [role, setRoleState] = useState('Admin');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [customDefect, setCustomDefect] = useState('');
    const [editCustomDefect, setEditCustomDefect] = useState('');
    const [customStation, setCustomStation] = useState('');
    const [editCustomStation, setEditCustomStation] = useState('');

    const { confirm, ConfirmDialog } = useConfirm();

    // Search & Filter
    const [search, setSearch] = useState('');
    const [filterStation, setFilterStation] = useState('');
    const [filterDefect, setFilterDefect] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [filterShift, setFilterShift] = useState('');

    // Edit modal
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState(null);

    useEffect(() => {
        loadEntries();
        setRoleState(getRole());
    }, []);

    const loadEntries = async () => {
        setLoading(true);
        const all = await db.getAll('reworks');
        setAllEntries(all.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setLoading(false);
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const setField = (name, value) => {
        if (name === 'defectType' && value !== '__other__') setCustomDefect('');
        if (name === 'station' && value !== '__other__') setCustomStation('');
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleChange = (e) => {
        setField(e.target.name, e.target.value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalDefect = form.defectType === '__other__' ? customDefect.trim() : form.defectType;
        const finalStation = form.station === '__other__' ? customStation.trim() : form.station;
        if (!form.date || !finalStation || !finalDefect || !form.shift || !form.severity) {
            showToast('Please fill all required fields', 'error');
            return;
        }
        setSubmitting(true);
        await db.add('reworks', { ...form, station: finalStation, defectType: finalDefect, quantity: parseInt(form.quantity) || 1 });
        setForm(defaultForm);
        setCustomDefect('');
        setCustomStation('');
        await loadEntries();
        setSubmitting(false);
        showToast('Rework entry saved');
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Delete Rework Entry',
            message: 'This entry will be permanently removed. This action cannot be undone.',
            type: 'danger',
            confirmText: 'Delete',
        });
        if (!ok) return;
        setAllEntries((prev) => prev.filter((e) => e.id !== id));
        showToast('Entry deleted');
        await db.remove('reworks', id);
    };

    // Edit handlers
    const openEdit = (entry) => {
        const isKnownDefect = DEFECT_TYPES.includes(entry.defectType);
        const isKnownStation = STATIONS.includes(entry.station);
        setEditForm({
            date: entry.date || '',
            station: isKnownStation ? (entry.station || '') : '__other__',
            defectType: isKnownDefect ? (entry.defectType || '') : '__other__',
            quantity: String(entry.quantity || 1),
            shift: entry.shift || '',
            operatorGroup: entry.operatorGroup || '',
            materialBatch: entry.materialBatch || '',
            severity: entry.severity || '',
            suspectedRootCause: entry.suspectedRootCause || '',
            remarks: entry.remarks || '',
        });
        setEditCustomDefect(isKnownDefect ? '' : (entry.defectType || ''));
        setEditCustomStation(isKnownStation ? '' : (entry.station || ''));
        setEditId(entry.id);
    };

    const setEditField = (name, value) => {
        if (name === 'defectType' && value !== '__other__') setEditCustomDefect('');
        if (name === 'station' && value !== '__other__') setEditCustomStation('');
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleEditChange = (e) => {
        setEditField(e.target.name, e.target.value);
    };

    const handleEditSave = async () => {
        const finalDefect = editForm.defectType === '__other__' ? editCustomDefect.trim() : editForm.defectType;
        const finalStation = editForm.station === '__other__' ? editCustomStation.trim() : editForm.station;
        if (!editForm.date || !finalStation || !finalDefect || !editForm.shift || !editForm.severity) {
            showToast('Please fill all required fields', 'error');
            return;
        }
        const updated = { ...editForm, station: finalStation, defectType: finalDefect, quantity: parseInt(editForm.quantity) || 1 };
        setAllEntries((prev) =>
            prev.map((e) => (e.id === editId ? { ...e, ...updated } : e))
        );
        setEditId(null);
        setEditForm(null);
        showToast('Entry updated');
        await db.update('reworks', editId, updated);
    };

    // Filtering logic
    const filtered = allEntries.filter((e) => {
        const q = search.toLowerCase();
        const matchSearch = q === '' ||
            e.defectType?.toLowerCase().includes(q) ||
            e.station?.toLowerCase().includes(q) ||
            e.suspectedRootCause?.toLowerCase().includes(q) ||
            e.materialBatch?.toLowerCase().includes(q) ||
            e.remarks?.toLowerCase().includes(q) ||
            e.date?.includes(q);
        const matchStation = filterStation === '' || e.station === filterStation;
        const matchDefect = filterDefect === '' || e.defectType === filterDefect;
        const matchSeverity = filterSeverity === '' || e.severity === filterSeverity;
        const matchShift = filterShift === '' || e.shift === filterShift;
        return matchSearch && matchStation && matchDefect && matchSeverity && matchShift;
    });

    const stationOptions = [...STATIONS.map((s) => ({ value: s, label: s })), { value: '__other__', label: '＋ Other (Custom)' }];
    const defectOptions = [...DEFECT_TYPES.map((d) => ({ value: d, label: d })), { value: '__other__', label: '＋ Other (Custom)' }];
    const hasFilters = search || filterStation || filterDefect || filterSeverity || filterShift;
    const isViewer = role === 'Viewer';

    return (
        <div>
            {/* Entry form */}
            <div className="section-card">
                <h3>📝 New Rework Entry</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Date *</label>
                            <input type="date" name="date" value={form.date} onChange={handleChange} disabled={isViewer} />
                        </div>
                        <div className="form-group">
                            <label>Station *</label>
                            <CustomSelect options={stationOptions} value={form.station} onChange={(v) => setField('station', v)} placeholder="Select Station" disabled={isViewer} />
                            {form.station === '__other__' && (
                                <input type="text" placeholder="Type custom station name..." value={customStation} onChange={(e) => setCustomStation(e.target.value)} style={{ marginTop: '8px' }} autoFocus disabled={isViewer} />
                            )}
                        </div>
                        <div className="form-group">
                            <label>Defect Type *</label>
                            <CustomSelect options={defectOptions} value={form.defectType} onChange={(v) => setField('defectType', v)} placeholder="Select Defect" disabled={isViewer} />
                            {form.defectType === '__other__' && (
                                <input type="text" placeholder="Type custom defect type..." value={customDefect} onChange={(e) => setCustomDefect(e.target.value)} style={{ marginTop: '8px' }} autoFocus disabled={isViewer} />
                            )}
                        </div>
                        <div className="form-group">
                            <label>Quantity</label>
                            <input type="number" name="quantity" value={form.quantity} onChange={handleChange} min="1" max="100" disabled={isViewer} />
                        </div>
                        <div className="form-group">
                            <label>Shift *</label>
                            <CustomSelect options={SHIFTS} value={form.shift} onChange={(v) => setField('shift', v)} placeholder="Select Shift" disabled={isViewer} />
                        </div>
                        <div className="form-group">
                            <label>Severity *</label>
                            <CustomSelect options={SEVERITY_LEVELS} value={form.severity} onChange={(v) => setField('severity', v)} placeholder="Select Severity" disabled={isViewer} />
                        </div>
                        <div className="form-group">
                            <label>Operator Group</label>
                            <CustomSelect options={OPERATOR_GROUPS} value={form.operatorGroup} onChange={(v) => setField('operatorGroup', v)} placeholder="Select Group" disabled={isViewer} />
                        </div>
                        <div className="form-group">
                            <label>Material Batch</label>
                            <input type="text" name="materialBatch" value={form.materialBatch} onChange={handleChange} placeholder="e.g., BATCH-2026-001" disabled={isViewer} />
                        </div>
                        <div className="form-group full-width">
                            <label>Suspected Root Cause</label>
                            <input type="text" name="suspectedRootCause" value={form.suspectedRootCause} onChange={handleChange} placeholder="What caused this defect?" disabled={isViewer} />
                        </div>
                        <div className="form-group full-width">
                            <label>Remarks</label>
                            <textarea name="remarks" value={form.remarks} onChange={handleChange} placeholder="Additional notes..." disabled={isViewer} />
                        </div>
                    </div>
                    {!isViewer && (
                        <div className="btn-group" style={{ marginTop: '20px' }}>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? '⏳ Saving...' : '💾 Save Entry'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setForm(defaultForm)}>
                                ↻ Reset
                            </button>
                        </div>
                    )}
                </form>
            </div>

            {/* Search & Filter bar */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="🔍 Search by defect, station, batch, root cause..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <CustomSelect options={STATIONS} value={filterStation} onChange={setFilterStation} placeholder="All Stations" />
                <CustomSelect options={DEFECT_TYPES} value={filterDefect} onChange={setFilterDefect} placeholder="All Defects" />
                <CustomSelect options={SEVERITY_LEVELS} value={filterSeverity} onChange={setFilterSeverity} placeholder="All Severity" />
                <CustomSelect options={SHIFTS} value={filterShift} onChange={setFilterShift} placeholder="All Shifts" />
                {hasFilters && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterStation(''); setFilterDefect(''); setFilterSeverity(''); setFilterShift(''); }}>
                        ✕ Clear
                    </button>
                )}
            </div>

            {/* Results count */}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 500 }}>
                {filtered.length} of {allEntries.length} entries
                {hasFilters ? ' (filtered)' : ''}
            </div>

            {/* Entries table */}
            <div className="table-container">
                {loading ? (
                    <div className="loading">Loading entries...</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📝</div>
                        <h3>{hasFilters ? 'No entries match your filters' : 'No rework entries yet'}</h3>
                        <p>{hasFilters ? 'Try adjusting your search or filters' : 'Submit a rework entry above to get started'}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Station</th>
                                    <th>Defect</th>
                                    <th>Qty</th>
                                    <th>Shift</th>
                                    <th>Severity</th>
                                    <th>Batch</th>
                                    <th>Root Cause</th>
                                    {!isViewer && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((entry) => (
                                    <tr key={entry.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{entry.date}</td>
                                        <td><span className="badge badge-blue">{entry.station}</span></td>
                                        <td style={{ fontWeight: 500 }}>{entry.defectType}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{entry.quantity}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{entry.shift}</td>
                                        <td>
                                            <span className={`badge ${entry.severity === 'High' ? 'badge-red' : entry.severity === 'Medium' ? 'badge-orange' : 'badge-green'}`}>
                                                {entry.severity}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{entry.materialBatch || '—'}</td>
                                        <td style={{ maxWidth: '200px', fontSize: '12px', color: 'var(--text-muted)' }}>{entry.suspectedRootCause || '—'}</td>
                                        {!isViewer && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(entry)}>✏️</button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id)}>✕</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editId && editForm && (
                <div className="modal-overlay" onClick={() => { setEditId(null); setEditForm(null); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
                        <h3>✏️ Edit Rework Entry</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Date *</label>
                                <input type="date" name="date" value={editForm.date} onChange={handleEditChange} />
                            </div>
                            <div className="form-group">
                                <label>Station *</label>
                                <CustomSelect options={stationOptions} value={editForm.station} onChange={(v) => setEditField('station', v)} placeholder="Select Station" />
                                {editForm.station === '__other__' && (
                                    <input type="text" placeholder="Type custom station name..." value={editCustomStation} onChange={(e) => setEditCustomStation(e.target.value)} style={{ marginTop: '8px' }} autoFocus />
                                )}
                            </div>
                            <div className="form-group">
                                <label>Defect Type *</label>
                                <CustomSelect options={defectOptions} value={editForm.defectType} onChange={(v) => setEditField('defectType', v)} placeholder="Select Defect" />
                                {editForm.defectType === '__other__' && (
                                    <input type="text" placeholder="Type custom defect type..." value={editCustomDefect} onChange={(e) => setEditCustomDefect(e.target.value)} style={{ marginTop: '8px' }} autoFocus />
                                )}
                            </div>
                            <div className="form-group">
                                <label>Quantity</label>
                                <input type="number" name="quantity" value={editForm.quantity} onChange={handleEditChange} min="1" max="100" />
                            </div>
                            <div className="form-group">
                                <label>Shift *</label>
                                <CustomSelect options={SHIFTS} value={editForm.shift} onChange={(v) => setEditField('shift', v)} placeholder="Select Shift" />
                            </div>
                            <div className="form-group">
                                <label>Severity *</label>
                                <CustomSelect options={SEVERITY_LEVELS} value={editForm.severity} onChange={(v) => setEditField('severity', v)} placeholder="Select Severity" />
                            </div>
                            <div className="form-group">
                                <label>Operator Group</label>
                                <CustomSelect options={OPERATOR_GROUPS} value={editForm.operatorGroup} onChange={(v) => setEditField('operatorGroup', v)} placeholder="Select Group" />
                            </div>
                            <div className="form-group">
                                <label>Material Batch</label>
                                <input type="text" name="materialBatch" value={editForm.materialBatch} onChange={handleEditChange} placeholder="e.g., BATCH-2026-001" />
                            </div>
                            <div className="form-group full-width">
                                <label>Suspected Root Cause</label>
                                <input type="text" name="suspectedRootCause" value={editForm.suspectedRootCause} onChange={handleEditChange} placeholder="What caused this defect?" />
                            </div>
                            <div className="form-group full-width">
                                <label>Remarks</label>
                                <textarea name="remarks" value={editForm.remarks} onChange={handleEditChange} placeholder="Additional notes..." />
                            </div>
                        </div>
                        <div className="btn-group" style={{ marginTop: '24px' }}>
                            <button className="btn btn-primary" onClick={handleEditSave}>💾 Save Changes</button>
                            <button className="btn btn-secondary" onClick={() => { setEditId(null); setEditForm(null); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {ConfirmDialog}
            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}
