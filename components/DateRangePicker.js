'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Custom Date Range Picker
 * Features:
 * - Presets (Last 7 Days, Last 30 Days, This Month, etc.)
 * - Custom Calendar UI (no native date picker)
 * - Range selection logic
 *
 * Props:
 *   startDate: Date | null
 *   endDate: Date | null
 *   onChange: ({ start, end }) => void
 */
export default function DateRangePicker({ startDate, endDate, onChange }) {
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date()); // Current month view
    const [hoverDate, setHoverDate] = useState(null);
    const ref = useRef(null);

    // Initial view set to start date or today
    useEffect(() => {
        if (open && startDate) setViewDate(new Date(startDate));
    }, [open, startDate]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handlePreset = (days) => {
        const end = new Date();
        const start = new Date();
        if (days === 'thisMonth') {
            start.setDate(1);
        } else if (days === 'lastMonth') {
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            end.setDate(0); // Last day of last month
        } else {
            start.setDate(end.getDate() - days);
        }
        onChange({ start, end });
        setOpen(false);
    };

    const handleDateClick = (date) => {
        if (!startDate || (startDate && endDate)) {
            // Start new range
            onChange({ start: date, end: null });
        } else {
            // Complete range
            if (date < startDate) {
                onChange({ start: date, end: startDate });
            } else {
                onChange({ start: startDate, end: date });
            }
            // Auto close after brief delay? No, user might want to adjust.
        }
    };

    const formatDate = (d) => d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            // Check status
            const isStart = startDate && date.toDateString() === startDate.toDateString();
            const isEnd = endDate && date.toDateString() === endDate.toDateString();
            const inRange = startDate && endDate && date > startDate && date < endDate;
            const isHover = !endDate && startDate && hoverDate && date > startDate && date <= hoverDate;

            let className = 'calendar-day';
            if (isStart || isEnd) className += ' selected';
            if (inRange || isHover) className += ' in-range';

            days.push(
                <div
                    key={d}
                    className={className}
                    onClick={() => handleDateClick(date)}
                    onMouseEnter={() => setHoverDate(date)}
                >
                    {d}
                </div>
            );
        }

        return days;
    };

    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

    const label = startDate && endDate
        ? `${formatDate(startDate)} - ${formatDate(endDate)}`
        : 'Select Date Range';

    return (
        <div className="date-range-picker" ref={ref}>
            <button className="picker-trigger" onClick={() => setOpen(!open)}>
                <span className="icon">📅</span>
                <span className="text">{label}</span>
                <span className="arrow">{open ? '▴' : '▾'}</span>
            </button>

            {open && (
                <div className="picker-dropdown">
                    <div className="presets">
                        <div className="preset-item" onClick={() => handlePreset(7)}>Last 7 Days</div>
                        <div className="preset-item" onClick={() => handlePreset(30)}>Last 30 Days</div>
                        <div className="preset-item" onClick={() => handlePreset(90)}>Last 3 months</div>
                        <div className="preset-item" onClick={() => handlePreset('thisMonth')}>This Month</div>
                        <div className="preset-item" onClick={() => handlePreset('lastMonth')}>Last Month</div>
                    </div>
                    <div className="calendar-container">
                        <div className="calendar-header">
                            <button onClick={prevMonth}>&lt;</button>
                            <span>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={nextMonth}>&gt;</button>
                        </div>
                        <div className="calendar-grid-header">
                            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
                        </div>
                        <div className="calendar-grid">
                            {renderCalendar()}
                        </div>
                        <div className="calendar-footer">
                            <button className="btn-text" onClick={() => { onChange({ start: null, end: null }); setOpen(false); }}>Clear</button>
                            <button className="btn-link" onClick={() => handlePreset(0)}>Today</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
