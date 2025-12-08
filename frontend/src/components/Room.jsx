import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3002/api';

export default function Room({ room }) {
    const [query, setQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            // Search if query > 1 char OR if date filter is set
            if (query.length > 1 || dateFilter) {
                searchRecords(query, dateFilter);
            } else if (query.length === 0 && !dateFilter) {
                setRecords([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query, dateFilter]);

    // Reset selection when query changes or new search performed
    useEffect(() => {
        setSelectedRecord(null);
    }, [query, dateFilter]);

    // Auto-refresh search results every 15s
    useEffect(() => {
        if ((query.length > 1 || dateFilter) && !selectedRecord) {
            const interval = setInterval(() => {
                // Silent refresh (don't set loading to true)
                const refresh = async () => {
                    try {
                        const res = await fetch(`${API_BASE}/rooms/${room.room_id}/enter`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                query_by: 'name',
                                value: query,
                                date_filter: dateFilter
                            })
                        });
                        const data = await res.json();
                        setRecords(data.matched_records || []);
                    } catch (err) {
                        console.error("Auto-refresh failed", err);
                    }
                };
                refresh();
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [query, dateFilter, selectedRecord, room.room_id]);

    const searchRecords = async (val, dateVal) => {
        setLoading(true);
        setError(null);
        try {
            // We now use 'name' as a general search (covers Name, ID1, ID2)
            // unless user specifically wants ID mode, but general is better for UX
            const res = await fetch(`${API_BASE}/rooms/${room.room_id}/enter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query_by: 'name', // Backend now searches Name + IDs with this
                    value: val,
                    date_filter: dateVal
                })
            });
            const data = await res.json();
            setRecords(data.matched_records || []);
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
                    <div className="search-bar-container" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="search-bar" style={{ flex: 1 }}>
                            <input
                                type="text"
                                placeholder="Cari Nama atau ID..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        <div className="date-filter">
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                                style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
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
                                {records.length === 0 && query.length > 1 && !loading && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                            No records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
            const res = await fetch(`${API_BASE}/records/${record.row_ref}/user-input`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
