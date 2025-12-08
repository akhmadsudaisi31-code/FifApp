import React from 'react';

export default function Home({ onNavigate }) {
    return (
        <div className="home-view">
            <div className="hero-section">
                <h2>Welcome to Dashboard</h2>
                <p>Select a module to proceed</p>
            </div>
            <div className="menu-grid">
                <div className="menu-card" onClick={() => onNavigate('regional')}>
                    <div className="icon-large">🏢</div>
                    <div className="menu-card-content">
                        <h3>QWALITY</h3>
                        <p>View Room Dashboards</p>
                    </div>
                    <div className="chevron">›</div>
                </div>
                <div className="menu-card" onClick={() => onNavigate('laporan')}>
                    <div className="icon-large">📊</div>
                    <div className="menu-card-content">
                        <h3>Laporan</h3>
                        <p>View Detailed Reports</p>
                    </div>
                    <div className="chevron">›</div>
                </div>
            </div>
        </div>
    );
}
