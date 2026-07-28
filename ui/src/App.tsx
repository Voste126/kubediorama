import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Float } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { usePodStore, type Pod, type TrafficEvent } from './store';
import './App.css';

/**
 * PodMesh Component
 * Dynamic 3D Pod representation scaling height with CPU and glow brightness with Memory.
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

  // --------------------------------------------------------------------------
  // Dynamic Core Scaling Metrics Math
  // - Height (scale.y) scales linearly with CPU usage percentage (0 - 100%)
  // - Glow (emissiveIntensity) scales linearly with Memory usage percentage (0 - 100%)
  // --------------------------------------------------------------------------
  const cpuPercent = pod.cpu ?? 35;
  const memPercent = pod.memory ?? 45;

  const heightScale = 1.0 + (cpuPercent / 100) * 2.2; // Height ranges from 1.0 to 3.2 units
  const glowIntensity = 0.8 + (memPercent / 100) * 2.8; // Glow intensity ranges from 0.8 to 3.6

  // Smooth @react-spring/three animation transitions
  const springProps = useSpring({
    scaleY: isStriking ? 0.0 : heightScale,
    scaleXZ: isStriking ? 0.0 : hovered ? 1.25 : 1.0,
    emissiveIntensity: isStriking ? 6.0 : hovered ? glowIntensity + 1.5 : glowIntensity,
    color: isStriking ? '#ff0000' : pod.status.toLowerCase() === 'running' ? '#00f3ff' : '#ffb700',
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

  useFrame((_, delta) => {
    if (meshRef.current && !isStriking) {
      meshRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <Float speed={isStriking ? 0 : 1.5} rotationIntensity={0.15} floatIntensity={0.3} position={[targetX, 0.9, targetZ]}>
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

        <animated.meshStandardMaterial
          color={springProps.color}
          emissive={springProps.color}
          emissiveIntensity={springProps.emissiveIntensity}
          roughness={0.15}
          metalness={0.85}
        />

        {/* Outer Wireframe Cage */}
        <mesh scale={1.04}>
          <boxGeometry args={[1.6, 1.6, 1.6]} />
          <animated.meshBasicMaterial color={springProps.color} wireframe transparent opacity={0.3} />
        </mesh>

        {/* Telemetry HTML Overlay Badge */}
        {!isStriking && (
          <Html position={[0, heightScale * 0.8 + 0.8, 0]} center distanceFactor={14} zIndexRange={[100, 0]}>
            <div className={`pod-badge ${hovered ? 'badge-hover' : ''} ${activeSpell === 'meteor' ? 'meteor-target' : ''}`}>
              <div className="pod-header">
                <span className="pod-icon">{activeSpell === 'meteor' ? '🎯' : '📦'}</span>
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
 * DataParticle Component
 * Animates a glowing 3D network particle along a 3D Quadratic Bezier Curve between two Pods.
 */
interface DataParticleProps {
  event: TrafficEvent;
  sourcePos: THREE.Vector3;
  destPos: THREE.Vector3;
}

const DataParticle: React.FC<DataParticleProps> = ({ event, sourcePos, destPos }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const removeTrafficEvent = usePodStore((state) => state.removeTrafficEvent);

  // --------------------------------------------------------------------------
  // 3D Math: Quadratic Bezier Curve Calculation
  // P0 = Start Position (Source Pod)
  // P2 = End Position (Destination Pod)
  // P1 = Control Arc Point floating vertically in space between P0 and P2
  // --------------------------------------------------------------------------
  const curve = useMemo(() => {
    const midX = (sourcePos.x + destPos.x) / 2;
    const midZ = (sourcePos.z + destPos.z) / 2;
    const distance = sourcePos.distanceTo(destPos);
    const arcHeight = Math.max(sourcePos.y, destPos.y) + 4.5 + Math.min(distance * 0.25, 8.0);

    const P0 = sourcePos.clone();
    const P1 = new THREE.Vector3(midX, arcHeight, midZ); // Arc control point
    const P2 = destPos.clone();

    return new THREE.QuadraticBezierCurve3(P0, P1, P2);
  }, [sourcePos, destPos]);

  // Curve points for visual particle line trail
  const linePoints = useMemo(() => curve.getPoints(30), [curve]);

  const isFast = event.speed === 'fast';
  const color = isFast ? '#00f3ff' : '#ff0055'; // Cyan Blue for fast, Red for slow

  // Animate particle position along Bezier curve
  useFrame((_, delta) => {
    // Fast particle completes in ~1.1s, Slow particle completes in ~2.5s
    const speedMultiplier = isFast ? 0.9 : 0.4;
    progressRef.current += delta * speedMultiplier;

    if (progressRef.current >= 1.0) {
      removeTrafficEvent(event.id);
      return;
    }

    if (meshRef.current) {
      const currentPoint = curve.getPoint(progressRef.current);
      meshRef.current.position.copy(currentPoint);
    }
  });

  return (
    <group>
      {/* Visual Arc Trail Line */}
      <line>
        <bufferGeometry attach="geometry" onUpdate={(self) => self.setFromPoints(linePoints)} />
        <lineBasicMaterial color={color} transparent opacity={0.35} linewidth={2} />
      </line>

      {/* Moving Luminescent Particle Sphere */}
      <mesh ref={meshRef} position={[sourcePos.x, sourcePos.y, sourcePos.z]}>
        <sphereGeometry args={[isFast ? 0.35 : 0.45, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.5}
          roughness={0.1}
        />
        <pointLight color={color} intensity={2.0} distance={5} />
      </mesh>
    </group>
  );
};

/**
 * NamespaceDistrict Platform Component
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
      {/* Base Platform */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[12, 0.4, 12]} />
        <meshStandardMaterial color="#0c1425" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Grid Overlay */}
      <mesh position={[0, 0.01, 0]}>
        <planeGeometry args={[11.8, 11.8]} />
        <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.15} />
      </mesh>

      {/* Rim Edge */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[12.2, 0.42, 12.2]} />
        <meshBasicMaterial color="#00f3ff" wireframe transparent opacity={0.25} />
      </mesh>

      {/* District Label */}
      <Html position={[0, 0.5, -6]} center distanceFactor={18}>
        <div className="district-label">
          <span className="district-icon">🏛️</span>
          <span className="district-title">District: {namespace}</span>
          <span className="district-count">({pods.length} Pods)</span>
        </div>
      </Html>

      {/* Pods */}
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

  // --------------------------------------------------------------------------
  // 3D Math: Build Namespace District Layout and Pod Position Map
  // --------------------------------------------------------------------------
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

      {/* Render Namespace District Islands */}
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

      {/* Render Traffic Light Trail Particles along 3D Bezier Curves */}
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

      {/* Empty State */}
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

export default function App() {
  const { pods, trafficEvents, isConnected, activeSpell, setActiveSpell, connect } = usePodStore();

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

  return (
    <div className={`app-container ${activeSpell === 'meteor' ? 'meteor-mode-active' : ''}`}>
      <header className="hud-header">
        <div className="brand">
          <h1>KubeDiorama</h1>
          <span className="subtitle">Milestone 3: Data Flow & Live Metrics</span>
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

      <main className="canvas-wrapper">
        <Canvas camera={{ position: [0, 16, 24], fov: 45 }}>
          <color attach="background" args={['#050811']} />
          <fog attach="fog" args={['#050811', 20, 65]} />
          <Scene />
        </Canvas>
      </main>

      <footer className="spells-toolbar-container">
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
      </footer>
    </div>
  );
}
