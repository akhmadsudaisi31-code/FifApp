import React, { useState, useEffect } from 'react';

import { API_BASE } from '../config';

export default function Room({ room }) {
    const [query, setQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);

    // Pagination & Filter State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [reasonFilter, setReasonFilter] = useState('all'); // all, filled, empty

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            // Only search if query is present (User requirement)
            if (query.trim().length > 0) {
                setPage(1);
                searchRecords(query, dateFilter, reasonFilter, 1);
            } else {
                setRecords([]); // Clear data if no query
                setTotalPages(1);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query, dateFilter, reasonFilter]);

    // Fetch on page change (skip if triggered by above effect)
    useEffect(() => {
        searchRecords(query, dateFilter, reasonFilter, page);
    }, [page]);

    // Reset selection when query changes or new search performed
    useEffect(() => {
        setSelectedRecord(null);
    }, [query, dateFilter]);

    // Auto-refresh search results every 15s
    useEffect(() => {
        if (!selectedRecord) {
            const interval = setInterval(() => {
                // Silent refresh
                const refresh = async () => {
                    try {
                        const res = await fetch(`${API_BASE}?action=enter_room&roomId=${room.room_id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({
                                query_by: 'name',
                                value: query,
                                date_filter: dateFilter,
                                page: page,
                                pageSize: 10,
                                reason_filter: reasonFilter
                            })
                        });
                        const data = await res.json();
                        setRecords(data.matched_records || []);
                        if (data.pagination) {
                            setTotalPages(data.pagination.total_pages);
                        }
                    } catch (err) {
                        console.error("Auto-refresh failed", err);
                    }
                };
                refresh();
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [query, dateFilter, selectedRecord, room.room_id, page, reasonFilter]);

    const searchRecords = async (val, dateVal, reasonVal, pageNum) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}?action=enter_room&roomId=${room.room_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    query_by: 'name',
                    value: val,
                    date_filter: dateVal,
                    page: pageNum,
                    pageSize: 10,
                    reason_filter: reasonVal
                })
            });
            const data = await res.json();
            setRecords(data.matched_records || []);
            if (data.pagination) {
                setTotalPages(data.pagination.total_pages);
            }
        } catch (err) {
            setError("Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="room-view">
            <div className="section-header">
                <h2>{room.label}</h2>
                <p>{selectedRecord ? 'Update Record Details' : 'Search and select a record'}</p>
            </div>

            {!selectedRecord ? (
                <>
                    {/* Search Bar - Full Width Top */}
                    <div className="search-container" style={{ marginBottom: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Cari Nama atau ID..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                        />
                    </div>

                    {/* Filters - Below Search */}
                    <div className="filters-container" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="date-filter" style={{ flex: 1 }}>
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div className="reason-filter" style={{ flex: 1 }}>
                            <select
                                value={reasonFilter}
                                onChange={e => setReasonFilter(e.target.value)}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                            >
                                <option value="all">Semua Status</option>
                                <option value="filled">Sudah Diisi</option>
                                <option value="empty">Belum Diisi</option>
                            </select>
                        </div>
                    </div>
                    {loading && <div className="spinner">Searching...</div>}

                    {error && <div className="error">{error}</div>}

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Contract</th>
                                    <th>Customer</th>
                                    <th>LOB</th>
                                    <th>Due Date</th>
                                    <th>Install Amt</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(rec => (
                                    <tr
                                        key={rec.row_ref}
                                        onClick={() => setSelectedRecord(rec)}
                                        style={{ cursor: 'pointer' }}
                                        className="hover-row"
                                    >
                                        <td data-label="Contract">{rec.contract}</td>
                                        <td data-label="Customer">{rec.customer}</td>
                                        <td data-label="LOB"><span className="badge">{rec.lob}</span></td>
                                        <td data-label="Due Date">{rec.due_date}</td>
                                        <td data-label="Install Amt">{rec.install_amt}</td>
                                        <td data-label="Action">
                                            <button className="btn-sm">Select</button>
                                            {rec.reason && <span style={{ marginLeft: '8px', color: 'green' }}>✅</span>}
                                        </td>
                                    </tr>
                                ))}
                                {records.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                            {query.trim().length === 0
                                                ? "Silakan cari Nama atau ID untuk menampilkan data."
                                                : "No records found."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="btn-sm"
                        >
                            Previous
                        </button>
                        <span>Page {page} of {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="btn-sm"
                        >
                            Next
                        </button>
                    </div>
                </>
            ) : (
                <div className="detail-view">
                    <button
                        className="nav-btn"
                        onClick={() => setSelectedRecord(null)}
                        style={{ marginBottom: '1rem', background: 'var(--primary)', color: 'white' }}
                    >
                        ← Back to List
                    </button>
                    <RecordCard record={selectedRecord} roomId={room.room_id} />
                </div>
            )}
        </div>
    );
}

function RecordCard({ record, roomId }) {
    const [inputVal, setInputVal] = useState(record.reason || '');
    const [status, setStatus] = useState('idle');

    const handleSave = async () => {
        setStatus('saving');
        try {
            const res = await fetch(`${API_BASE}?action=update_record&rowRef=${record.row_ref}`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    row_ref: record.row_ref,
                    id: record.row_ref,
                    field: 'K', // This might be ignored by backend for BA room, but kept for compatibility
                    new_value: inputVal,
                    room_id: roomId, // Send room_id to identify sheet
                    client_timestamp: new Date().toISOString()
                })
            });

            if (!res.ok) throw new Error("Save failed");
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        } catch (err) {
            setStatus('error');
            alert("Failed to save changes.");
        }
    };

    return (
        <div className="record-card">
            <div className="record-header">
                <span className="badge">{record.lob}</span>
                <h4>{record.customer || record.G}</h4>
                <span className="contract-no">#{record.contract}</span>
            </div>

            <div className="record-details">
                {/* Common Fields */}
                <div>
                    <strong>Jatuh Tempo</strong>
                    <p>{record.due_date}</p>
                </div>
                <div>
                    <strong>Install Amt</strong>
                    <p>{record.install_amt}</p>
                </div>
                <div>
                    <strong>KE</strong>
                    <p>{record.ke}</p>
                </div>
                <div>
                    <strong>LOB</strong>
                    <p>{record.lob}</p>
                </div>

                {/* BA Specific Fields */}
                {record.beban && (
                    <div>
                        <strong>Beban</strong>
                        <p>{record.beban}</p>
                    </div>
                )}
                {record.cabang && (
                    <div>
                        <strong>Cabang</strong>
                        <p>{record.cabang}</p>
                    </div>
                )}
                {record.alamat && (
                    <div style={{ gridColumn: 'span 2' }}>
                        <strong>Alamat</strong>
                        <p>{record.alamat}</p>
                    </div>
                )}
            </div>

            <div className="input-area">
                <label>Reason {roomId === 'ba' ? '(Kolom M)' : '(Kolom K)'}</label>
                <textarea
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    placeholder="Masukkan alasan di sini..."
                />
                <div className="actions">
                    <button onClick={handleSave} disabled={status === 'saving'}>
                        {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved ✓' : 'Save Update'}
                    </button>
                    {status === 'error' && <span className="error-icon">⚠️ Error</span>}
                </div>
            </div>
        </div>
    );
}
