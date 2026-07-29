import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Float } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { usePodStore, type Pod } from './store';
import type { WorkloadType } from './LayoutEngine';

// ---------------------------------------------------------------------------
// PodMesh Component
// Renders workload-variant 3D geometry with dynamic scaling, state-driven
// coloring, hover-based LOD metric cards, and physical glitch animations.
// ---------------------------------------------------------------------------

interface PodMeshProps {
  pod: Pod;
  worldX: number;
  worldZ: number;
  workloadType: WorkloadType;
}

const PodMesh: React.FC<PodMeshProps> = ({ pod, worldX, worldZ, workloadType }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [isStriking, setIsStriking] = useState(false);

  const activeSpell = usePodStore((state) => state.activeSpell);
  const castMeteor = usePodStore((state) => state.castMeteor);

  // ---- State Detection ----
  const statusLower = pod.status.toLowerCase();
  const isError = ['error', 'oomkilled', 'oom', 'failed', 'crashloopbackoff'].includes(statusLower);
  const isPending = ['pending', 'containercreating'].includes(statusLower);
  const isRunning = statusLower === 'running';

  // ---- Metrics ----
  const cpuPercent = pod.cpu ?? 35;
  const memPercent = pod.memory ?? 45;

  // ---- Height Scaling (workload-aware) ----
  const baseHeight = (() => {
    switch (workloadType) {
      case 'database': return 1.2 + (cpuPercent / 100) * 1.8;
      case 'daemonset': return 0.4 + (cpuPercent / 100) * 0.2; // Low-profile
      case 'deployment': return 1.0 + (cpuPercent / 100) * 2.2; // Skyscrapers
    }
  })();

  const glowIntensity = isError ? 4.5 : 0.8 + (memPercent / 100) * 2.8;

  // ---- State-Driven Colors ----
  const stateColor = isStriking
    ? '#ff0000'
    : isError
    ? '#ff0033'
    : isPending
    ? '#ffb700'
    : '#00f3ff';

  // ---- Spring Animations ----
  const springProps = useSpring({
    scaleY: isStriking ? 0.0 : baseHeight,
    scaleXZ: isStriking ? 0.0 : hovered ? 1.2 : 1.0,
    emissiveIntensity: isStriking ? 6.0 : hovered ? glowIntensity + 1.5 : glowIntensity,
    color: stateColor,
    config: isStriking
      ? { mass: 1, tension: 300, friction: 15 }
      : { mass: 1, tension: 120, friction: 14 },
  });

  // ---- Meteor Click Handler ----
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

  // ---- Per-Frame Animations ----
  useFrame((state, delta) => {
    if (!meshRef.current || isStriking) return;

    if (isError) {
      // Rapid physical glitch shaking
      const jitterX = (Math.random() - 0.5) * 0.22;
      const jitterZ = (Math.random() - 0.5) * 0.22;
      meshRef.current.position.x = worldX + jitterX;
      meshRef.current.position.z = worldZ + jitterZ;
      meshRef.current.rotation.y += delta * 3.5;
    } else {
      meshRef.current.position.x = worldX;
      meshRef.current.position.z = worldZ;
      meshRef.current.rotation.y += delta * 0.6;
    }

    // Database pulsating energy ring
    if (ringRef.current && workloadType === 'database') {
      const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 3.0) * 0.15;
      ringRef.current.scale.set(pulse, 1, pulse);
    }
  });

  // ---- Geometry Selection ----
  const renderGeometry = () => {
    switch (workloadType) {
      case 'database':
        return <cylinderGeometry args={[0.7, 0.8, 1.6, 24]} />;
      case 'daemonset':
        return <boxGeometry args={[2.2, 0.5, 2.2]} />;
      case 'deployment':
      default:
        return <boxGeometry args={[1.6, 1.6, 1.6]} />;
    }
  };

  // ---- Wireframe Cage Geometry (matches primary) ----
  const renderWireframeGeometry = () => {
    switch (workloadType) {
      case 'database':
        return <cylinderGeometry args={[0.75, 0.85, 1.7, 24]} />;
      case 'daemonset':
        return <boxGeometry args={[2.3, 0.55, 2.3]} />;
      case 'deployment':
      default:
        return <boxGeometry args={[1.7, 1.7, 1.7]} />;
    }
  };

  return (
    <Float
      speed={isStriking ? 0 : isError ? 4 : 1.5}
      rotationIntensity={isError ? 0.6 : 0.15}
      floatIntensity={0.3}
      position={[worldX, 0.9, worldZ]}
    >
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
        {renderGeometry()}

        {/* Material: Wireframe-only for Pending, Error wireframe, standard for Running */}
        {isPending ? (
          <animated.meshBasicMaterial
            color={springProps.color}
            wireframe
            transparent
            opacity={0.6}
          />
        ) : isError ? (
          <meshBasicMaterial color="#ff0033" wireframe />
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
          {renderWireframeGeometry()}
          <animated.meshBasicMaterial
            color={springProps.color}
            wireframe
            transparent
            opacity={isError ? 0.8 : 0.3}
          />
        </mesh>

        {/* Database Energy Ring */}
        {workloadType === 'database' && isRunning && (
          <mesh ref={ringRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.0, 0.04, 8, 32]} />
            <meshBasicMaterial color="#00f3ff" transparent opacity={0.6} />
          </mesh>
        )}

        {/* Minimal Always-Visible Name Tag */}
        {!isStriking && (
          <Html
            position={[0, baseHeight * 0.5 + 0.6, 0]}
            center
            distanceFactor={20}
            zIndexRange={[100, 0]}
          >
            <div className={`pod-name-tag ${activeSpell === 'meteor' ? 'meteor-target' : ''}`}>
              <span>{isError ? '⚠️' : activeSpell === 'meteor' ? '🎯' : '📦'}</span>
              <span>{pod.name}</span>
            </div>
          </Html>
        )}

        {/* Detailed Metric Card — Hover-Only LOD */}
        {!isStriking && hovered && (
          <Html
            position={[0, baseHeight * 0.8 + 1.4, 0]}
            center
            distanceFactor={14}
            zIndexRange={[200, 0]}
          >
            <div className={`pod-badge badge-hover ${isError ? 'glitch-badge' : ''}`}>
              <div className="pod-header">
                <span className="pod-icon">{isError ? '⚠️' : '📦'}</span>
                <span className="pod-name">{pod.name}</span>
              </div>

              {/* Real-time Telemetry Metrics Bars */}
              <div className="metrics-container">
                <div className="metric-row">
                  <span className="metric-label">CPU</span>
                  <div className="metric-bar-bg">
                    <div
                      className="metric-bar-fill cpu-bar"
                      style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                    ></div>
                  </div>
                  <span className="metric-val">{Math.round(cpuPercent)}%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">MEM</span>
                  <div className="metric-bar-bg">
                    <div
                      className="metric-bar-fill mem-bar"
                      style={{ width: `${Math.min(memPercent, 100)}%` }}
                    ></div>
                  </div>
                  <span className="metric-val">{Math.round(memPercent)}%</span>
                </div>
              </div>

              <div className="pod-footer">
                <span className="pod-ns">{pod.namespace}</span>
                <span className={`status-pill ${statusLower}`}>{pod.status}</span>
              </div>

              {/* Workload type indicator */}
              <div className="pod-workload-tag">
                {workloadType === 'database' && '🗄️ StatefulSet'}
                {workloadType === 'daemonset' && '⚙️ DaemonSet'}
                {workloadType === 'deployment' && '🏗️ Deployment'}
              </div>
            </div>
          </Html>
        )}
      </animated.mesh>
    </Float>
  );
};

export default PodMesh;
