import React, { useState, useEffect, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { API_BASE } from '../config';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function Report() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('daily'); // daily, weekly, monthly, yearly
    const [selectedRoom, setSelectedRoom] = useState('nbot'); // nbot, ba
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const fetchData = () => {
        setLoading(true);
        fetch(`${API_BASE}?action=get_records&room_id=${selectedRoom}`)
            .then(res => res.json())
            .then(data => {
                setRecords(data.records);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load reports", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [selectedRoom]); // Refetch when room changes

    // --- CHART DATA PROCESSING ---
    const chartData = useMemo(() => {
        if (!records.length) return null;

        const counts = {};

        records.forEach(rec => {
            // Use 'due_date' (DD/MM/YYYY) or 'date_filter' (YYYY-MM-DD)
            // Let's assume we use 'due_date' which is DD/MM/YYYY
            let dateStr = rec.due_date;
            if (!dateStr) return;

            // Parse date
            const [d, m, y] = dateStr.split('/');
            if (!d || !m || !y) return;

            let key = '';

            if (period === 'daily') {
                key = `${d}/${m}`; // 01/12
            } else if (period === 'monthly') {
                key = `${m}/${y}`; // 12/2025
            } else if (period === 'yearly') {
                key = y; // 2025
            } else if (period === 'weekly') {
                // Simple week number approx
                const date = new Date(y, m - 1, d);
                const start = new Date(date.getFullYear(), 0, 1);
                const diff = date - start;
                const oneDay = 1000 * 60 * 60 * 24;
                const day = Math.floor(diff / oneDay);
                const week = Math.ceil(day / 7);
                key = `W${week}`;
            }

            counts[key] = (counts[key] || 0) + 1;
        });

        // Sort keys
        const labels = Object.keys(counts).sort();
        const data = labels.map(l => counts[l]);

        return {
            labels,
            datasets: [
                {
                    label: 'Total Records',
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                },
            ],
        };
    }, [records, period]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 1000,
            easing: 'easeOutQuart'
        },
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `Records by Period (${period.toUpperCase()})` },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    // Pagination Logic
    const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
    const paginatedRecords = records.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="report-view">
            <div className="section-header">
                <h2>Laporan Rekapitulasi</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={selectedRoom}
                        onChange={e => { setSelectedRoom(e.target.value); setCurrentPage(1); }}
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontWeight: 'bold' }}
                    >
                        <option value="nbot">Room NBOT</option>
                        <option value="ba">Room BA</option>
                    </select>
                    <select
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ddd' }}
                    >
                        <option value="daily">Harian</option>
                        <option value="weekly">Mingguan</option>
                        <option value="monthly">Bulanan</option>
                        <option value="yearly">Tahunan</option>
                    </select>
                    <span className="badge">Total: {records.length}</span>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">Loading data...</div>
            ) : (
                <>
                    {/* CHART SECTION */}
                    {/* CHART SECTION */}
                    <div className="chart-container" style={{
                        background: 'white',
                        padding: '1.5rem',
                        borderRadius: '0.75rem',
                        marginBottom: '2rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid #e2e8f0',
                        height: '400px', // Taller for better desktop view
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        position: 'relative'
                    }}>
                        <div style={{ width: '100%', height: '100%' }}>
                            {chartData && <Bar options={chartOptions} data={chartData} />}
                        </div>
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Contract</th>
                                    <th>Customer</th>
                                    <th>LOB</th>
                                    <th>Due Date</th>
                                    <th>Install Amt</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRecords && paginatedRecords.length > 0 ? (
                                    paginatedRecords.map(rec => (
                                        <tr key={rec.row_ref}>
                                            <td data-label="Contract">{rec.contract}</td>
                                            <td data-label="Customer">{rec.customer}</td>
                                            <td data-label="LOB">{rec.lob}</td>
                                            <td data-label="Due Date">{rec.due_date}</td>
                                            <td data-label="Install Amt">{rec.install_amt}</td>
                                            <td data-label="Reason">{rec.reason || '-'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                            No records available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', paddingBottom: '2rem' }}>
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className="btn-sm"
                            >
                                Previous
                            </button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="btn-sm"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
