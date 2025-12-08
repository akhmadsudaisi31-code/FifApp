import React from 'react';

export default function Regional({ rooms, onEnter }) {
    // 1. Loading State (rooms is null or undefined)
    if (!rooms) {
        return (
            <div className="regional-view">
                <div className="section-header">
                    <h2>QWALITY Dashboard</h2>
                    <p>Loading rooms...</p>
                </div>
            </div>
        );
    }

    // 2. Empty State (rooms is empty array)
    if (rooms.length === 0) {
        return (
            <div className="regional-view">
                <div className="section-header">
                    <h2>QWALITY Dashboard</h2>
                    <p>No rooms available.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="regional-view">
            <div className="section-header">
                <h2>QWALITY Dashboard</h2>
                <p>Select a room to manage records</p>
            </div>
            <div className="grid-container">
                {rooms.map(room => (
                    <div key={room.room_id} className="room-card" onClick={() => onEnter(room)}>
                        <div className="room-icon">
                            {room.room_id === 'nbot' ? '📊' : '📱'}
                        </div>
                        <h3>{room.label}</h3>
                    </div>
                ))}
            </div>
        </div>
    );
}
