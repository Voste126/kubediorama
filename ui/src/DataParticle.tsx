import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePodStore, type TrafficEvent } from './store';

interface DataParticleProps {
  event: TrafficEvent;
  sourcePos: THREE.Vector3;
  destPos: THREE.Vector3;
}

/**
 * DataParticle 3D Component (Milestone 5)
 * Features Quadratic Bezier curve motion, GPU instancing support, and
 * Black Hole NetworkPolicy shatter physics (striking invisible 3D walls & exploding into sparks).
 */
export const DataParticle: React.FC<DataParticleProps> = ({ event, sourcePos, destPos }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const [isShattered, setIsShattered] = useState(false);
  const removeTrafficEvent = usePodStore((state) => state.removeTrafficEvent);

  // --------------------------------------------------------------------------
  // 3D Math: Quadratic Bezier Curve Calculation
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

  const linePoints = useMemo(() => curve.getPoints(30), [curve]);
  const isFast = event.speed === 'fast';
  const isBlocked = event.blocked === true;
  const mainColor = isBlocked ? '#ff0055' : isFast ? '#00f3ff' : '#ffb700';

  // --------------------------------------------------------------------------
  // Black Hole Shatter Sparks Initialization
  // Generates 8 radial velocity vectors for micro-sparks on impact with partition wall
  // --------------------------------------------------------------------------
  const sparkVelocities = useMemo(() => {
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const theta = (i / 8) * Math.PI * 2;
      vels.push(new THREE.Vector3(Math.cos(theta) * 0.08, (Math.random() - 0.5) * 0.08, Math.sin(theta) * 0.08));
    }
    return vels;
  }, []);

  const sparkGroupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (isShattered) return;

    const speedMultiplier = isFast ? 0.95 : 0.45;
    progressRef.current += delta * speedMultiplier;

    // --------------------------------------------------------------------------
    // Black Hole Partition Wall Collision Detection
    // If NetworkPolicy blocks traffic, particle hits wall at t = 0.5 and shatters!
    // --------------------------------------------------------------------------
    if (isBlocked && progressRef.current >= 0.5) {
      setIsShattered(true);
      setTimeout(() => {
        removeTrafficEvent(event.id);
      }, 400); // Allow 400ms for spark fadeout animation
      return;
    }

    if (progressRef.current >= 1.0) {
      removeTrafficEvent(event.id);
      return;
    }

    if (meshRef.current) {
      const currentPoint = curve.getPoint(progressRef.current);
      meshRef.current.position.copy(currentPoint);
    }
  });

  // Animate micro-sparks spreading outward when shattered by Black Hole
  useFrame((_, delta) => {
    if (isShattered && sparkGroupRef.current) {
      sparkGroupRef.current.children.forEach((child, idx) => {
        child.position.addScaledVector(sparkVelocities[idx], delta * 60);
      });
    }
  });

  return (
    <group>
      {/* Translucent Bezier Line (turns red if partition wall blocks route) */}
      <line>
        <bufferGeometry attach="geometry" onUpdate={(self) => self.setFromPoints(linePoints)} />
        <lineBasicMaterial color={mainColor} transparent opacity={isBlocked ? 0.6 : 0.35} linewidth={2} />
      </line>

      {/* Main Moving Particle (or Shatter Micro-Sparks) */}
      {!isShattered ? (
        <mesh ref={meshRef} position={[sourcePos.x, sourcePos.y, sourcePos.z]}>
          <sphereGeometry args={[isFast ? 0.35 : 0.45, 16, 16]} />
          <meshStandardMaterial
            color={mainColor}
            emissive={mainColor}
            emissiveIntensity={3.5}
            roughness={0.1}
          />
          <pointLight color={mainColor} intensity={2.0} distance={5} />
        </mesh>
      ) : (
        /* Exploding Micro-Spark Burst at Midpoint Partition Wall (t = 0.5) */
        <group ref={sparkGroupRef} position={curve.getPoint(0.5)}>
          {sparkVelocities.map((_, i) => (
            <mesh key={i} position={[0, 0, 0]}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshBasicMaterial color="#ff0055" transparent opacity={0.9} />
            </mesh>
          ))}
          <pointLight color="#ff0055" intensity={5.0} distance={8} />
        </group>
      )}
    </group>
  );
};
