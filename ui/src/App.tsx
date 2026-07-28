import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Float } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { usePodStore, type Pod } from './store';
import { DataParticle } from './DataParticle';
import './App.css';

/**
 * PodMesh Component
 * Renders Pod 3D geometry with dynamic scaling (CPU/Memory) and physical 3D glitch/jitter shaking on Error/OOMKilled.
 */
interface PodMeshProps {
  pod: Pod;
  index: number;
  districtX: number;
  districtZ: number;
}

const PodMesh: React.FC<PodMeshProps> = ({ pod, index, districtX, districtZ }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [isStriking, setIsStriking] = useState(false);

  const activeSpell = usePodStore((state) => state.activeSpell);
  const castMeteor = usePodStore((state) => state.castMeteor);

  // 3D Local Position Math inside District Platform
  const podsPerRow = 3;
  const col = index % podsPerRow;
  const row = Math.floor(index / podsPerRow);
  const localX = (col - 1) * 3.2;
  const localZ = (row - 1) * 3.2;
  
  const targetX = districtX + localX;
  const targetZ = districtZ + localZ;

  // Detect Glitch / Error States (Error, OOMKilled, Failed)
  const isError = ['error', 'oomkilled', 'oom', 'failed'].includes(pod.status.toLowerCase());

  // Metrics Math
  const cpuPercent = pod.cpu ?? 35;
  const memPercent = pod.memory ?? 45;

  const heightScale = 1.0 + (cpuPercent / 100) * 2.2;
  const glowIntensity = isError ? 4.5 : 0.8 + (memPercent / 100) * 2.8;

  // Smooth @react-spring/three animation transitions
  const springProps = useSpring({
    scaleY: isStriking ? 0.0 : heightScale,
    scaleXZ: isStriking ? 0.0 : hovered ? 1.25 : 1.0,
    emissiveIntensity: isStriking ? 6.0 : hovered ? glowIntensity + 1.5 : glowIntensity,
    color: isStriking
      ? '#ff0000'
      : isError
      ? '#ff0055' // Glitch Red/Magenta
      : pod.status.toLowerCase() === 'running'
      ? '#00f3ff'
      : '#ffb700',
    config: isStriking ? { mass: 1, tension: 300, friction: 15 } : { mass: 1, tension: 120, friction: 14 },
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (activeSpell === 'meteor' && !isStriking) {
      console.log(`☄️ [METEOR IMPACT] Target acquired: ${pod.namespace}/${pod.name}`);
      setIsStriking(true);
      setTimeout(() => {
        castMeteor(pod.name, pod.namespace);
      }, 350);
    }
  };

  // --------------------------------------------------------------------------
  // 3D Physical Glitch & Wireframe Shaking Animation
  // If pod.status is Error or OOMKilled, physically jitter mesh on X/Z axes!
  // --------------------------------------------------------------------------
  useFrame((_, delta) => {
    if (meshRef.current && !isStriking) {
      if (isError) {
        // Rapid physical glitch shaking on X and Z axes
        const jitterX = (Math.random() - 0.5) * 0.22;
        const jitterZ = (Math.random() - 0.5) * 0.22;
        meshRef.current.position.x = targetX + jitterX;
        meshRef.current.position.z = targetZ + jitterZ;
        meshRef.current.rotation.y += delta * 3.5; // Rapid glitch rotation
      } else {
        meshRef.current.position.x = targetX;
        meshRef.current.position.z = targetZ;
        meshRef.current.rotation.y += delta * 0.6;
      }
    }
  });

  return (
    <Float speed={isStriking ? 0 : isError ? 4 : 1.5} rotationIntensity={isError ? 0.6 : 0.15} floatIntensity={0.3} position={[targetX, 0.9, targetZ]}>
      <animated.mesh
        ref={meshRef}
        scale-x={springProps.scaleXZ}
        scale-y={springProps.scaleY}
        scale-z={springProps.scaleXZ}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.6, 1.6, 1.6]} />

        {/* Dynamic Material: Wireframe for Error / OOMKilled states */}
        {isError ? (
          <meshBasicMaterial color="#ff0055" wireframe />
        ) : (
          <animated.meshStandardMaterial
            color={springProps.color}
            emissive={springProps.color}
            emissiveIntensity={springProps.emissiveIntensity}
            roughness={0.15}
            metalness={0.85}
          />
        )}

        {/* Outer Wireframe Cage */}
        <mesh scale={1.06}>
          <boxGeometry args={[1.6, 1.6, 1.6]} />
          <animated.meshBasicMaterial color={springProps.color} wireframe transparent opacity={isError ? 0.8 : 0.3} />
        </mesh>

        {/* Telemetry HTML Overlay Badge */}
        {!isStriking && (
          <Html position={[0, heightScale * 0.8 + 0.8, 0]} center distanceFactor={14} zIndexRange={[100, 0]}>
            <div className={`pod-badge ${hovered ? 'badge-hover' : ''} ${activeSpell === 'meteor' ? 'meteor-target' : ''} ${isError ? 'glitch-badge' : ''}`}>
              <div className="pod-header">
                <span className="pod-icon">{isError ? '⚠️' : activeSpell === 'meteor' ? '🎯' : '📦'}</span>
                <span className="pod-name">{pod.name}</span>
              </div>

              {/* Real-time Telemetry Metrics Bars */}
              <div className="metrics-container">
                <div className="metric-row">
                  <span className="metric-label">CPU</span>
                  <div className="metric-bar-bg">
                    <div className="metric-bar-fill cpu-bar" style={{ width: `${Math.min(cpuPercent, 100)}%` }}></div>
                  </div>
                  <span className="metric-val">{Math.round(cpuPercent)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">MEM</span>
                  <div className="metric-bar-bg">
                    <div className="metric-bar-fill mem-bar" style={{ width: `${Math.min(memPercent, 100)}%` }}></div>
                  </div>
                  <span className="metric-val">{Math.round(memPercent)}%</span>
                </div>
              </div>

              <div className="pod-footer">
                <span className="pod-ns">{pod.namespace}</span>
                <span className={`status-pill ${pod.status.toLowerCase()}`}>{pod.status}</span>
              </div>
            </div>
          </Html>
        )}
      </animated.mesh>
    </Float>
  );
};

/**
 * NamespaceDistrict Component
 */
interface NamespaceDistrictProps {
  namespace: string;
  districtX: number;
  districtZ: number;
  pods: Pod[];
}

const NamespaceDistrict: React.FC<NamespaceDistrictProps> = ({ namespace, districtX, districtZ, pods }) => {
  return (
    <group position={[districtX, 0, districtZ]}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[12, 0.4, 12]} />
        <meshStandardMaterial color="#0c1425" roughness={0.1} metalness={0.9} />
      </mesh>

      <mesh position={[0, 0.01, 0]}>
        <planeGeometry args={[11.8, 11.8]} />
        <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.15} />
      </mesh>

      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[12.2, 0.42, 12.2]} />
        <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.25} />
      </mesh>

      <Html position={[0, 0.5, -6]} center distanceFactor={18}>
        <div className="district-label">
          <span className="district-icon">🏛️</span>
          <span className="district-title">District: {namespace}</span>
          <span className="district-count">({pods.length} Pods)</span>
        </div>
      </Html>

      {pods.map((pod, pIdx) => (
        <PodMesh
          key={`${pod.namespace}-${pod.name}`}
          pod={pod}
          index={pIdx}
          districtX={0}
          districtZ={0}
        />
      ))}
    </group>
  );
};

/**
 * Main 3D Scene Component
 */
const Scene: React.FC = () => {
  const pods = usePodStore((state) => state.pods);
  const trafficEvents = usePodStore((state) => state.trafficEvents);

  const { namespaceMap, uniqueNamespaces, podWorldPositions } = useMemo(() => {
    const nsMap = pods.reduce((acc, pod) => {
      if (!acc[pod.namespace]) {
        acc[pod.namespace] = [];
      }
      acc[pod.namespace].push(pod);
      return acc;
    }, {} as Record<string, Pod[]>);

    const uNamespaces = Object.keys(nsMap);
    const positions: Record<string, THREE.Vector3> = {};

    uNamespaces.forEach((ns, dIdx) => {
      const cols = 2;
      const col = dIdx % cols;
      const row = Math.floor(dIdx / cols);
      const districtX = (col - (cols - 1) / 2) * 18;
      const districtZ = row * 18 - 4;

      const nsPods = nsMap[ns];
      nsPods.forEach((pod, pIdx) => {
        const podsPerRow = 3;
        const pCol = pIdx % podsPerRow;
        const pRow = Math.floor(pIdx / podsPerRow);
        const localX = (pCol - 1) * 3.2;
        const localZ = (pRow - 1) * 3.2;

        positions[pod.name] = new THREE.Vector3(districtX + localX, 1.5, districtZ + localZ);
      });
    });

    return { namespaceMap: nsMap, uniqueNamespaces: uNamespaces, podWorldPositions: positions };
  }, [pods]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[15, 20, 15]} intensity={1.8} color="#00ffff" />
      <pointLight position={[-15, -10, -15]} intensity={1.0} color="#ff00ff" />
      <directionalLight position={[0, 15, 10]} intensity={1.2} />

      <gridHelper args={[80, 80, '#00ffff', '#101726']} position={[0, -0.4, 0]} />

      {uniqueNamespaces.map((ns, dIdx) => {
        const cols = 2;
        const col = dIdx % cols;
        const row = Math.floor(dIdx / cols);
        const districtX = (col - (cols - 1) / 2) * 18;
        const districtZ = row * 18 - 4;

        return (
          <NamespaceDistrict
            key={ns}
            namespace={ns}
            districtX={districtX}
            districtZ={districtZ}
            pods={namespaceMap[ns]}
          />
        );
      })}

      {trafficEvents.map((ev) => {
        const srcPos = podWorldPositions[ev.sourcePod];
        const dstPos = podWorldPositions[ev.destPod];

        if (!srcPos || !dstPos) return null;

        return (
          <DataParticle
            key={ev.id}
            event={ev}
            sourcePos={srcPos}
            destPos={dstPos}
          />
        );
      })}

      {pods.length === 0 && (
        <Html position={[0, 2, 0]} center>
          <div className="empty-state">
            <h3>📡 Waiting for Cluster Events...</h3>
            <p>No active Pods detected in watched namespaces.</p>
            <p className="hint">Try: <code>kubectl run test-pod --image=nginx</code></p>
          </div>
        </Html>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
};

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
          <span className="subtitle">Milestone 4: Temporal DVR & Glitch States</span>
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
        <Canvas camera={{ position: [0, 16, 24], fov: 45 }}>
          <color attach="background" args={['#050811']} />
          <fog attach="fog" args={['#050811', 20, 65]} />
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
