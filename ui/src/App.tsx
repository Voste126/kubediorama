import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Float } from '@react-three/drei';
import * as THREE from 'three';
import { usePodStore, type Pod } from './store';
import './App.css';

/**
 * PodMesh Component
 * Renders a glowing 3D cube representing a Kubernetes Pod.
 * Spaced dynamically based on array index in a grid layout.
 */
interface PodMeshProps {
  pod: Pod;
  index: number;
}

const PodMesh: React.FC<PodMeshProps> = ({ pod, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Dynamic grid placement: 4 pods per row, spaced 3.5 units apart
  const itemsPerRow = 4;
  const col = index % itemsPerRow;
  const row = Math.floor(index / itemsPerRow);
  const xPos = (col - (itemsPerRow - 1) / 2) * 3.5;
  const zPos = row * 3.5 - 2;

  // Determine glow color based on Kubernetes Pod Status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return { color: '#00f3ff', emissive: '#00a8ff' }; // Neon Cyan
      case 'pending':
      case 'containercreating':
        return { color: '#ffb700', emissive: '#ff8800' }; // Amber
      case 'failed':
      case 'error':
      case 'terminating':
        return { color: '#ff0055', emissive: '#aa0033' }; // Neon Red
      default:
        return { color: '#00ff88', emissive: '#00aa55' }; // Digital Green
    }
  };

  const { color, emissive } = getStatusColor(pod.status);

  // Continuous subtle rotation and hovering animation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.6;
      meshRef.current.rotation.x = Math.sin(Date.now() * 0.002 + index) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5} position={[xPos, 0.75, zPos]}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.25 : 1.0}
      >
        {/* Pod 3D Geometry */}
        <boxGeometry args={[1.6, 1.6, 1.6]} />

        {/* Futuristic Glowing Cyber Material */}
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={hovered ? 2.5 : 1.2}
          roughness={0.2}
          metalness={0.8}
          wireframe={false}
        />

        {/* Outer Wireframe Cage */}
        <mesh scale={1.05}>
          <boxGeometry args={[1.6, 1.6, 1.6]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
        </mesh>

        {/* 3D Floating HTML Label for Pod Info */}
        <Html position={[0, 1.5, 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
          <div className={`pod-badge ${hovered ? 'badge-hover' : ''}`}>
            <div className="pod-header">
              <span className="pod-icon">📦</span>
              <span className="pod-name">{pod.name}</span>
            </div>
            <div className="pod-footer">
              <span className="pod-ns">{pod.namespace}</span>
              <span className={`status-pill ${pod.status.toLowerCase()}`}>{pod.status}</span>
            </div>
          </div>
        </Html>
      </mesh>
    </Float>
  );
};

/**
 * Scene Environment Component
 * Adds floor grid, lighting, and camera positioning
 */
const Scene: React.FC = () => {
  const pods = usePodStore((state) => state.pods);

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 15, 10]} intensity={1.5} color="#00ffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#ff00ff" />
      <directionalLight position={[0, 10, 5]} intensity={1.0} />

      {/* Cyber Grid Floor */}
      <gridHelper args={[50, 50, '#00ffff', '#1a2636']} position={[0, 0, 0]} />

      {/* Render Pod Meshes */}
      {pods.map((pod, idx) => (
        <PodMesh key={`${pod.namespace}-${pod.name}`} pod={pod} index={idx} />
      ))}

      {/* Empty State visual if no pods in default namespace */}
      {pods.length === 0 && (
        <Html position={[0, 1, 0]} center>
          <div className="empty-state">
            <h3>📡 Waiting for Pods...</h3>
            <p>No active Pods detected in the <code>default</code> namespace.</p>
            <p className="hint">Try running: <code>kubectl run demo-pod --image=nginx</code></p>
          </div>
        </Html>
      )}

      {/* Camera Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1} // Prevent camera going below floor grid
        minDistance={3}
        maxDistance={35}
      />
    </>
  );
};

export default function App() {
  const { pods, isConnected, connect } = usePodStore();

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="app-container">
      {/* Top Header / HUD */}
      <header className="hud-header">
        <div className="brand">
          <h1>KubeDiorama</h1>
          <span className="subtitle">3D Kubernetes Cluster Visualizer</span>
        </div>

        <div className="hud-stats">
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

      {/* 3D Canvas */}
      <main className="canvas-wrapper">
        <Canvas camera={{ position: [0, 8, 14], fov: 50 }}>
          <color attach="background" args={['#050811']} />
          <fog attach="fog" args={['#050811', 15, 45]} />
          <Scene />
        </Canvas>
      </main>
    </div>
  );
}
