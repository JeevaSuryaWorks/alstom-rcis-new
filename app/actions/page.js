'use client';

import { useState, useEffect } from 'react';
import { db, getRole } from '@/lib/db';
import { DEFECT_TYPES, ACTION_STATUSES, STATUS_COLORS } from '@/lib/constants';
import CustomSelect from '@/components/CustomSelect';
import { useConfirm } from '@/components/ConfirmDialog';

const defaultAction = {
    defectType: '',
    description: '',
    responsiblePerson: '',
    targetDate: '',
    status: 'Open',
    effectivenessReview: '',
};

export default function ActionTrackerPage() {
    const [actions, setActions] = useState([]);
    const [filter, setFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(defaultAction);
    const [editId, setEditId] = useState(null);
    const [toast, setToast] = useState(null);
    const [role, setRoleState] = useState('Admin');
    const [loading, setLoading] = useState(true);

    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        loadActions();
        setRoleState(getRole());
    }, []);

    const loadActions = async () => {
        setLoading(true);
        const all = await db.getAll('actions');
        setActions(all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setLoading(false);
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.defectType || !form.description || !form.responsiblePerson || !form.targetDate) {
            showToast('Fill all required fields', 'error');
            return;
        }
        if (editId) {
            await db.update('actions', editId, form);
            showToast('Action updated');
        } else {
            await db.add('actions', form);
            showToast('Action created');
        }
        setForm(defaultAction);
        setEditId(null);
        setShowModal(false);
        await loadActions();
    };

    const handleEdit = (action) => {
        setForm({
            defectType: action.defectType,
            description: action.description,
            responsiblePerson: action.responsiblePerson,
            targetDate: action.targetDate,
            status: action.status,
            effectivenessReview: action.effectivenessReview || '',
        });
        setEditId(action.id);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: 'Delete Action',
            message: 'This corrective action will be permanently removed. This cannot be undone.',
            type: 'danger',
            confirmText: 'Delete',
        });
        if (!ok) return;
        setActions((prev) => prev.filter((a) => a.id !== id));
        showToast('Action deleted');
        await db.remove('actions', id);
    };

    const handleQuickStatus = async (id, newStatus) => {
        setActions((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
        );
        showToast(`Status → ${newStatus}`);
        await db.update('actions', id, { status: newStatus });
    };

    const isOverdue = (action) => action.status !== 'Closed' && new Date(action.targetDate) < new Date();

    const filtered = filter === 'All' ? actions
        : filter === 'Overdue' ? actions.filter(isOverdue)
            : actions.filter((a) => a.status === filter);

    const overdueCount = actions.filter(isOverdue).length;
    const isViewer = role === 'Viewer';

    const statusCounts = {
        Open: actions.filter((a) => a.status === 'Open').length,
        'In Progress': actions.filter((a) => a.status === 'In Progress').length,
        Closed: actions.filter((a) => a.status === 'Closed').length,
    };

    if (loading) return <div className="loading">Loading actions...</div>;

    return (
        <div>
            {/* Overdue alert */}
            {overdueCount > 0 && (
                <div className="alert-banner danger">
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>🚨</span>
                    <div>
                        <strong>{overdueCount} overdue action{overdueCount > 1 ? 's' : ''}</strong> require immediate attention.
                        Filter by &quot;Overdue&quot; to review.
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card red">
                    <div className="kpi-icon">⏰</div>
                    <div className="kpi-label">Overdue</div>
                    <div className="kpi-value">{overdueCount}</div>
                </div>
                <div className="kpi-card orange">
                    <div className="kpi-icon">📋</div>
                    <div className="kpi-label">Open</div>
                    <div className="kpi-value">{statusCounts.Open}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon">🔄</div>
                    <div className="kpi-label">In Progress</div>
                    <div className="kpi-value">{statusCounts['In Progress']}</div>
                </div>
                <div className="kpi-card green">
                    <div className="kpi-icon">✅</div>
                    <div className="kpi-label">Closed</div>
                    <div className="kpi-value">{statusCounts.Closed}</div>
                </div>
            </div>

            {/* Filter Pills + New Action */}
            <div className="filter-pills">
                {['All', ...ACTION_STATUSES, 'Overdue'].map((s) => (
                    <button key={s} className={`pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                        {s} {s !== 'All' && s !== 'Overdue' ? `(${statusCounts[s] || 0})` : ''}
                    </button>
                ))}
                <div style={{ flex: 1 }} />
                {!isViewer && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setForm(defaultAction); setEditId(null); setShowModal(true); }}>
                        ✚ New Action
                    </button>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{editId ? '✏️ Edit Action' : '✚ New Corrective Action'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Defect Type *</label>
                                    <CustomSelect options={DEFECT_TYPES} value={form.defectType} onChange={(v) => setForm({ ...form, defectType: v })} placeholder="Select Defect" />
                                </div>
                                <div className="form-group">
                                    <label>Responsible Person *</label>
                                    <input type="text" value={form.responsiblePerson} onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })} placeholder="e.g., R. Kumar" />
                                </div>
                                <div className="form-group">
                                    <label>Target Date *</label>
                                    <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <CustomSelect options={ACTION_STATUSES} value={form.status} onChange={(v) => setForm({ ...form, status: v })} placeholder="Select Status" />
                                </div>
                                <div className="form-group full-width">
                                    <label>Description *</label>
                                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Corrective action details..." />
                                </div>
                                <div className="form-group full-width">
                                    <label>Effectiveness Review</label>
                                    <textarea value={form.effectivenessReview} onChange={(e) => setForm({ ...form, effectivenessReview: e.target.value })} placeholder="Results after implementation..." />
                                </div>
                            </div>
                            <div className="btn-group" style={{ marginTop: '24px' }}>
                                <button type="submit" className="btn btn-primary">{editId ? '💾 Update' : '✚ Create'}</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Actions Table */}
            <div className="table-container">
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Defect</th>
                                <th>Description</th>
                                <th>Responsible</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>Review</th>
                                {!isViewer && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={isViewer ? 6 : 7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        No actions match the current filter
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((action) => (
                                    <tr key={action.id} className={isOverdue(action) ? 'overdue-row' : ''}>
                                        <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{action.defectType}</td>
                                        <td style={{ maxWidth: '220px', lineHeight: 1.4 }}>{action.description}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{action.responsiblePerson}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {action.targetDate}
                                            {isOverdue(action) && (
                                                <span className="badge badge-red" style={{ marginLeft: 6, fontSize: '9px' }}>OVERDUE</span>
                                            )}
                                        </td>
                                        <td>
                                            {!isViewer ? (
                                                <div style={{ minWidth: '120px' }}>
                                                    <CustomSelect
                                                        options={ACTION_STATUSES}
                                                        value={action.status}
                                                        onChange={(v) => v && handleQuickStatus(action.id, v)}
                                                        placeholder={action.status}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="badge" style={{
                                                    background: `${STATUS_COLORS[action.status] || '#64748b'}22`,
                                                    color: STATUS_COLORS[action.status] || '#64748b',
                                                    border: `1px solid ${STATUS_COLORS[action.status] || '#64748b'}44`,
                                                }}>
                                                    {action.status}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ maxWidth: '160px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {action.effectivenessReview || '—'}
                                        </td>
                                        {!isViewer && (
                                            <td>
                                                <div className="btn-group" style={{ marginTop: 0, gap: '6px' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(action)}>✏️</button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(action.id)}>✕</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {ConfirmDialog}
            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
        </div>
    );
}
