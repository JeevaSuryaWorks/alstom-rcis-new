'use client';

import { useState } from 'react';
import CustomSelect from '@/components/CustomSelect';

/**
 * ExportPanel — Reusable export toolbar with Excel, PDF, CSV, Email.
 * Supports date-range filtering.
 *
 * Props:
 *   title:        string — report title
 *   getExcelData: (dateFrom, dateTo) => { sheetName, rows }[]
 *   getPdfContent:(dateFrom, dateTo) => { headers, tables, summary }
 *   getCsvData:   (dateFrom, dateTo) => { headers, rows }
 *   getEmailDraft:(dateFrom, dateTo) => { subject, body }
 */
export default function ExportPanel({ title, getExcelData, getPdfContent, getCsvData, getEmailDraft }) {
    const [showPanel, setShowPanel] = useState(false);
    const [pdfPageSize, setPdfPageSize] = useState('a4');
    const [pdfFontSize, setPdfFontSize] = useState('10');
    const [exporting, setExporting] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const dateRangeLabel = dateFrom && dateTo
        ? `${dateFrom} to ${dateTo}`
        : dateFrom ? `From ${dateFrom}` : dateTo ? `Up to ${dateTo}` : 'All Time';

    // ——————— Excel ———————
    const handleExcel = async () => {
        setExporting('excel');
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();
            const sheets = getExcelData(dateFrom, dateTo);
            sheets.forEach(({ sheetName, rows }) => {
                if (rows.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
            });
            XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
        } catch (err) {
            alert('Excel export failed: ' + err.message);
        }
        setExporting('');
    };

    // ——————— CSV ———————
    const handleCsv = () => {
        setExporting('csv');
        try {
            const { headers, rows } = getCsvData(dateFrom, dateTo);
            const csvContent = [
                headers.join(','),
                ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
            ].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${title.replace(/\s+/g, '_')}_${dateStr}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err) {
            alert('CSV export failed: ' + err.message);
        }
        setExporting('');
    };

    // ——————— PDF (bordered tables) ———————
    const handlePdf = async () => {
        setExporting('pdf');
        try {
            const { default: jsPDF } = await import('jspdf');
            const pageConfig = pdfPageSize === 'legal' ? 'legal' : 'a4';
            const doc = new jsPDF({ format: pageConfig, orientation: 'portrait' });
            const fontSize = parseInt(pdfFontSize) || 10;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 14;
            const rowH = fontSize * 0.5 + 5;
            let y = 20;

            const { headers, tables, summary } = getPdfContent(dateFrom, dateTo);

            // ── Header ──
            doc.setFontSize(18);
            doc.setTextColor(30);
            doc.text(headers.title || title, margin, y);
            y += 8;
            doc.setFontSize(9);
            doc.setTextColor(120);
            doc.text(`Generated: ${dateStr} ${timeStr}  |  Page: ${pdfPageSize.toUpperCase()}  |  Range: ${dateRangeLabel}  |  ${headers.subtitle || 'Alstom RCIS'}`, margin, y);
            doc.setTextColor(0);
            y += 6;
            doc.setDrawColor(180);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 10;

            // ── Summary ──
            if (summary && summary.length > 0) {
                doc.setFontSize(13);
                doc.setFont(undefined, 'bold');
                doc.text('Summary', margin, y);
                doc.setFont(undefined, 'normal');
                y += 8;
                doc.setFontSize(fontSize);
                summary.forEach((line) => {
                    if (y > pageHeight - 30) { doc.addPage(); y = 20; }
                    doc.text(`•  ${line}`, margin + 4, y);
                    y += rowH - 1;
                });
                y += 6;
            }

            // ── Tables with borders ──
            tables.forEach((table) => {
                if (y > pageHeight - 60) { doc.addPage(); y = 20; }

                // Table title
                doc.setFontSize(13);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30);
                doc.text(table.title, margin, y);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(0);
                y += 8;

                const cols = table.headers.length;
                const tableWidth = pageWidth - margin * 2;
                const colWidth = tableWidth / cols;

                // Header row background + border
                doc.setFillColor(230, 235, 240);
                doc.rect(margin, y - rowH + 3, tableWidth, rowH, 'F');
                doc.setDrawColor(160);
                doc.setLineWidth(0.3);
                doc.rect(margin, y - rowH + 3, tableWidth, rowH, 'S');

                // Header text
                doc.setFontSize(Math.max(fontSize - 0.5, 7));
                doc.setFont(undefined, 'bold');
                doc.setTextColor(40);
                table.headers.forEach((h, i) => {
                    doc.text(String(h), margin + i * colWidth + 3, y);
                });
                // Header column lines
                for (let i = 1; i < cols; i++) {
                    doc.line(margin + i * colWidth, y - rowH + 3, margin + i * colWidth, y + 3);
                }
                y += 4;

                // Data rows
                doc.setFont(undefined, 'normal');
                doc.setFontSize(fontSize);
                doc.setTextColor(50);

                table.rows.forEach((row, rowIdx) => {
                    if (y + rowH > pageHeight - 20) { doc.addPage(); y = 20; }

                    const cellTop = y - 1;

                    // Alternate row shading
                    if (rowIdx % 2 === 0) {
                        doc.setFillColor(245, 247, 250);
                        doc.rect(margin, cellTop, tableWidth, rowH, 'F');
                    }

                    // Row border
                    doc.setDrawColor(190);
                    doc.setLineWidth(0.2);
                    doc.rect(margin, cellTop, tableWidth, rowH, 'S');

                    // Column borders
                    for (let i = 1; i < cols; i++) {
                        doc.line(margin + i * colWidth, cellTop, margin + i * colWidth, cellTop + rowH);
                    }

                    // Cell text
                    row.forEach((cell, i) => {
                        const cellText = String(cell).substring(0, 28);
                        doc.text(cellText, margin + i * colWidth + 3, y + 3);
                    });

                    y += rowH;
                });

                // Bottom border line (thicker)
                doc.setDrawColor(160);
                doc.setLineWidth(0.4);
                doc.line(margin, y - 1, margin + tableWidth, y - 1);

                y += 12;
            });

            // ── Footer on each page ──
            const pageCount = doc.internal.getNumberOfPages();
            for (let p = 1; p <= pageCount; p++) {
                doc.setPage(p);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Alstom RCIS — ${title.replace(/_/g, ' ')}`, margin, pageHeight - 10);
                doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin - 30, pageHeight - 10);
            }

            doc.save(`${title.replace(/\s+/g, '_')}_${dateStr}.pdf`);
        } catch (err) {
            alert('PDF export failed: ' + err.message);
        }
        setExporting('');
    };

    // ——————— Email Draft ———————
    const handleEmail = () => {
        setExporting('email');
        try {
            const { subject, body } = getEmailDraft();
            const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailtoLink, '_blank');
        } catch (err) {
            alert('Email draft failed: ' + err.message);
        }
        setExporting('');
    };

    const labelStyle = { fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 };

    return (
        <div style={{ marginBottom: '20px' }}>
            <button className="btn btn-secondary" onClick={() => setShowPanel(!showPanel)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                📤 Export Options {showPanel ? '▴' : '▾'}
            </button>

            {showPanel && (
                <div className="section-card" style={{ marginTop: '10px', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>

                        {/* PDF settings */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ minWidth: '100px' }}>
                                <label style={labelStyle}>Page Size</label>
                                <CustomSelect
                                    options={[{ value: 'a4', label: 'A4' }, { value: 'legal', label: 'Legal' }]}
                                    value={pdfPageSize}
                                    onChange={setPdfPageSize}
                                    placeholder="A4"
                                />
                            </div>
                            <div style={{ minWidth: '110px' }}>
                                <label style={labelStyle}>Font Size</label>
                                <CustomSelect
                                    options={[
                                        { value: '8', label: '8pt (Compact)' },
                                        { value: '10', label: '10pt (Standard)' },
                                        { value: '12', label: '12pt (Large)' },
                                    ]}
                                    value={pdfFontSize}
                                    onChange={setPdfFontSize}
                                    placeholder="10pt"
                                />
                            </div>
                        </div>

                        {/* Export buttons */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleExcel} disabled={!!exporting}>
                                {exporting === 'excel' ? '⏳...' : '📊 Excel'}
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={handlePdf} disabled={!!exporting}>
                                {exporting === 'pdf' ? '⏳...' : '📄 PDF'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={handleCsv} disabled={!!exporting}>
                                {exporting === 'csv' ? '⏳...' : '📋 CSV'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={handleEmail} disabled={!!exporting}>
                                {exporting === 'email' ? '⏳...' : '✉️ Email Draft'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
