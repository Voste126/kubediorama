import React, { useMemo } from 'react';
import { OrbitControls, Html } from '@react-three/drei';
import { usePodStore, type Pod } from './store';
import { DataParticle } from './DataParticle';
import NamespaceDistrict from './NamespaceDistrict';
import {
  computeDistrictLayout,
  computePodMatrix,
  computeWorldPositions,
} from './LayoutEngine';

// ---------------------------------------------------------------------------
// Scene Component
// Orchestrates layout computation, district rendering, traffic beam particles,
// lighting rig, and camera controls. All spatial math is delegated to
// LayoutEngine for clean separation of concerns.
// ---------------------------------------------------------------------------

const Scene: React.FC = () => {
  const pods = usePodStore((state) => state.pods);
  const trafficEvents = usePodStore((state) => state.trafficEvents);

  const { namespaceMap, districtLayout, podLayoutMap, podWorldPositions } = useMemo(() => {
    // 1. Group pods by namespace
    const nsMap = pods.reduce((acc, pod) => {
      if (!acc[pod.namespace]) {
        acc[pod.namespace] = [];
      }
      acc[pod.namespace].push(pod);
      return acc;
    }, {} as Record<string, Pod[]>);

    // 2. Compute district spatial bounds
    const dLayout = computeDistrictLayout(nsMap);

    // 3. Compute pod matrix layouts per district
    const pLayoutMap: Record<string, ReturnType<typeof computePodMatrix>> = {};
    for (const ns of Object.keys(nsMap)) {
      if (dLayout[ns]) {
        pLayoutMap[ns] = computePodMatrix(nsMap[ns], dLayout[ns]);
      }
    }

    // 4. Compute flat world-position lookup for traffic beams
    const worldPos = computeWorldPositions(nsMap, dLayout);

    return {
      namespaceMap: nsMap,
      districtLayout: dLayout,
      podLayoutMap: pLayoutMap,
      podWorldPositions: worldPos,
    };
  }, [pods]);

  // Compute grid helper size based on district spread
  const gridSize = useMemo(() => {
    const positions = Object.values(districtLayout);
    if (positions.length === 0) return 80;
    let maxExtent = 40;
    for (const d of positions) {
      maxExtent = Math.max(
        maxExtent,
        Math.abs(d.x) + d.width,
        Math.abs(d.z) + d.depth,
      );
    }
    return Math.ceil(maxExtent / 10) * 10 * 2;
  }, [districtLayout]);

  return (
    <>
      {/* ---- Lighting Rig ---- */}
      <ambientLight intensity={0.6} />
      <pointLight position={[15, 20, 15]} intensity={1.8} color="#00ffff" />
      <pointLight position={[-15, -10, -15]} intensity={1.0} color="#ff00ff" />
      <directionalLight position={[0, 15, 10]} intensity={1.2} />

      {/* ---- Ground Grid ---- */}
      <gridHelper
        args={[gridSize, gridSize, '#00ffff', '#101726']}
        position={[0, -0.4, 0]}
      />

      {/* ---- Namespace Districts ---- */}
      {Object.keys(namespaceMap).map((ns) => {
        const bounds = districtLayout[ns];
        const layouts = podLayoutMap[ns];
        if (!bounds || !layouts) return null;

        return (
          <NamespaceDistrict
            key={ns}
            namespace={ns}
            bounds={bounds}
            podLayouts={layouts}
          />
        );
      })}

      {/* ---- Traffic Beam Particles ---- */}
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

      {/* ---- Empty State ---- */}
      {pods.length === 0 && (
        <Html position={[0, 2, 0]} center>
          <div className="empty-state">
            <h3>📡 Waiting for Cluster Events...</h3>
            <p>No active Pods detected in watched namespaces.</p>
            <p className="hint">Try: <code>kubectl run test-pod --image=nginx</code></p>
          </div>
        </Html>
      )}

      {/* ---- Camera Controls ---- */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5}
        maxDistance={80}
      />
    </>
  );
};

export default Scene;
