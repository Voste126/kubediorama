import React, { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { usePodStore } from './store';
import Scene from './Scene';
import './App.css';

// Timestamp formatting helper (HH:MM:SS)
const formatTime = (timestamp: number) => {
  if (!timestamp) return '00:00:00';
  const d = new Date(timestamp * 1000);
  return d.toTimeString().split(' ')[0];
};

export default function App() {
  const { pods, trafficEvents, isConnected, isLive, timeline, activeSpell, setActiveSpell, connect, scrubTo, resumeLive } = usePodStore();

  useEffect(() => {
    connect();
  }, [connect]);

  const toggleMeteorSpell = () => {
    if (activeSpell === 'meteor') {
      setActiveSpell('none');
    } else {
      setActiveSpell('meteor');
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    scrubTo(val);
  };

  return (
    <div className={`app-container ${activeSpell === 'meteor' ? 'meteor-mode-active' : ''}`}>
      {/* Top Header / HUD */}
      <header className="hud-header">
        <div className="brand">
          <h1>KubeDiorama</h1>
          <span className="subtitle">Milestone 6: Spatial Districts</span>
        </div>

        <div className="hud-stats">
          <div className="stat-box">
            <span className="stat-label">Active Beams</span>
            <span className="stat-value beam-val">{trafficEvents.length}</span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Active Pods</span>
            <span className="stat-value">{pods.length}</span>
          </div>

          <div className={`connection-status ${isConnected ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{isConnected ? 'LIVE (ws://localhost:8080)' : 'DISCONNECTED'}</span>
          </div>
        </div>
      </header>

      {activeSpell === 'meteor' && (
        <div className="architect-banner">
          <span className="banner-icon">☄️</span>
          <span><strong>ARCHITECT METEOR MODE ACTIVE:</strong> Click any 3D Pod Mesh to execute Chaos deletion!</span>
          <button className="cancel-btn" onClick={() => setActiveSpell('none')}>ESC / Cancel</button>
        </div>
      )}

      {/* 3D Canvas Viewport */}
      <main className="canvas-wrapper">
        <Canvas camera={{ position: [0, 22, 35], fov: 45 }}>
          <color attach="background" args={['#050811']} />
          <fog attach="fog" args={['#050811', 25, 120]} />
          <Scene />
        </Canvas>
      </main>

      {/* Bottom Floating Control Panel (Timeline DVR Scrubber + Spells Toolbar) */}
      <footer className="hud-bottom-panel">
        {/* Temporal DVR Timeline Scrubber Overlay */}
        <div className="dvr-timeline-bar">
          <button
            className={`live-toggle-btn ${isLive ? 'is-live' : 'is-dvr'}`}
            onClick={isLive ? undefined : resumeLive}
          >
            <span className="live-dot"></span>
            <span>{isLive ? 'LIVE' : 'DVR PAUSED'}</span>
          </button>

          <span className="timeline-time">{formatTime(timeline.min)}</span>

          <input
            type="range"
            className="timeline-slider"
            min={timeline.min || 0}
            max={timeline.max || 100}
            value={timeline.current || 0}
            onChange={handleSliderChange}
          />

          <span className="timeline-time active-ts">{formatTime(timeline.current)}</span>
          <span className="timeline-time">{formatTime(timeline.max)}</span>
        </div>

        {/* Chaos Spells Toolbar */}
        <div className="spells-toolbar-container">
          <div className="spells-toolbar">
            <span className="toolbar-title">⚡ Chaos Spells</span>
            <button
              className={`spell-btn ${activeSpell === 'meteor' ? 'active-spell' : ''}`}
              onClick={toggleMeteorSpell}
              title="Launch a Meteor strike to delete a Pod from the Kubernetes cluster"
            >
              <span className="spell-icon">☄️</span>
              <span className="spell-name">The Meteor</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
