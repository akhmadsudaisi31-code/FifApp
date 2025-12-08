import React from 'react';

export default function Layout({ children, view, setView }) {
    return (
        <div className="app-container">
            <header>
                <div className="header-left">
                    {view !== 'home' && (
                        <button className="nav-btn" onClick={() => setView('home')}>
                            <span className="icon">🏠</span>
                            <span className="label">Home</span>
                        </button>
                    )}
                    {view === 'room' && (
                        <button className="nav-btn" onClick={() => setView('regional')}>
                            <span className="icon">⬅️</span>
                            <span className="label">Back</span>
                        </button>
                    )}
                </div>
                <div className="header-center">
                    <h1>FIF GROUP DASHBOARD</h1>
                </div>
                <div className="header-right">
                    <div className="user-avatar">AD</div>
                </div>
            </header>
            <main>
                {children}
            </main>
        </div>
    );
}
