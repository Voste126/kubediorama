import React from 'react';
import { Html } from '@react-three/drei';
import type { DistrictBounds, PodLayoutInfo } from './LayoutEngine';
import PodMesh from './PodMesh';

// ---------------------------------------------------------------------------
// NamespaceDistrict Component
// Renders a spatially-isolated district platform with dynamic sizing,
// glowing wireframe perimeter walls, floor grid overlay, and floating title.
// ---------------------------------------------------------------------------

interface NamespaceDistrictProps {
  namespace: string;
  bounds: DistrictBounds;
  podLayouts: PodLayoutInfo[];
}

const NamespaceDistrict: React.FC<NamespaceDistrictProps> = ({
  namespace,
  bounds,
  podLayouts,
}) => {
  const { x, z, width, depth } = bounds;
  const wallHeight = 1.5;
  const wallThickness = 0.06;
  const wallOpacity = 0.12;
  const wallColor = '#00f3ff';

  return (
    <group position={[x, 0, z]}>
      {/* ---- Base Floor Plate ---- */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[width, 0.4, depth]} />
        <meshStandardMaterial
          color="#0c1425"
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* ---- Floor Wireframe Grid Overlay ---- */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.4, depth - 0.4]} />
        <meshBasicMaterial
          color="#00f3ff"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* ---- Glowing Perimeter Walls (4 edges) ---- */}
      {/* Front wall (+Z edge) */}
      <mesh position={[0, wallHeight / 2, depth / 2]}>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshBasicMaterial
          color={wallColor}
          wireframe
          transparent
          opacity={wallOpacity}
        />
      </mesh>
      {/* Back wall (-Z edge) */}
      <mesh position={[0, wallHeight / 2, -depth / 2]}>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshBasicMaterial
          color={wallColor}
          wireframe
          transparent
          opacity={wallOpacity}
        />
      </mesh>
      {/* Left wall (-X edge) */}
      <mesh position={[-width / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshBasicMaterial
          color={wallColor}
          wireframe
          transparent
          opacity={wallOpacity}
        />
      </mesh>
      {/* Right wall (+X edge) */}
      <mesh position={[width / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshBasicMaterial
          color={wallColor}
          wireframe
          transparent
          opacity={wallOpacity}
        />
      </mesh>

      {/* ---- Outer Wireframe Perimeter Glow ---- */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[width + 0.3, 0.42, depth + 0.3]} />
        <meshBasicMaterial
          color="#00f3ff"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* ---- Floating District Title Tag ---- */}
      <Html position={[0, 3, -depth / 2 + 0.5]} center distanceFactor={22}>
        <div className="district-label">
          <span className="district-icon">🏛️</span>
          <span className="district-title">District: {namespace}</span>
          <span className="district-count">({podLayouts.length} Pods)</span>
        </div>
      </Html>

      {/* ---- Pod Meshes ---- */}
      {podLayouts.map((info) => (
        <PodMesh
          key={`${info.pod.namespace}-${info.pod.name}`}
          pod={info.pod}
          worldX={info.worldX - x}
          worldZ={info.worldZ - z}
          workloadType={info.workloadType}
        />
      ))}
    </group>
  );
};

export default NamespaceDistrict;
