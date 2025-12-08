import React, { useState, useEffect } from 'react';
import './App.css';

// Components
import Layout from './components/Layout';
import Home from './components/Home';
import Regional from './components/Regional';
import Room from './components/Room';
import Report from './components/Report';

const API_BASE = 'http://localhost:3002/api';

function App() {
  const [view, setView] = useState('home'); // home | regional | room | laporan
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState(null);

  // Fetch rooms on load
  useEffect(() => {
    fetch(`${API_BASE}/dashboard/init`)
      .then(res => res.json())
      .then(data => setRooms(data.rooms))
      .catch(err => console.error("Failed to init dashboard", err));
  }, []);

  const enterRoom = (room) => {
    setSelectedRoom(room);
    setView('room');
  };

  return (
    <Layout view={view} setView={setView}>
      {view === 'home' && <Home onNavigate={setView} />}
      {view === 'regional' && <Regional rooms={rooms} onEnter={enterRoom} />}
      {view === 'room' && <Room room={selectedRoom} />}
      {view === 'laporan' && <Report />}
    </Layout>
  );
}

export default App;
