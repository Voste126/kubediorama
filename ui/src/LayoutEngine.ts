import * as THREE from 'three';
import type { Pod } from './store';

// ---------------------------------------------------------------------------
// Workload Classification
// ---------------------------------------------------------------------------

export type WorkloadType = 'database' | 'daemonset' | 'deployment';

const DATABASE_PATTERNS = [
  'postgres', 'postgresql', 'mysql', 'mariadb', 'mongo', 'mongodb',
  'redis', 'memcached', 'etcd', 'cockroach', 'cassandra', 'elastic',
  'elasticsearch', 'kafka', 'zookeeper', 'rabbitmq', 'nats', 'minio',
  'influxdb', 'clickhouse', 'dgraph', 'neo4j', 'couchdb', 'rethinkdb',
  'statefulset', 'sts-',
];

const DAEMONSET_PATTERNS = [
  'daemon', 'daemonset', 'ds-', 'proxy', 'flannel', 'calico', 'cilium',
  'weave', 'kube-proxy', 'node-exporter', 'filebeat', 'fluentd',
  'fluent-bit', 'promtail', 'collector', 'csi-node', 'ebs-csi',
  'gpu-device', 'nvidia',
];

/**
 * Classifies a pod's workload type based on name-pattern heuristics.
 * Since the backend doesn't currently stream workload metadata,
 * we use pod name substrings as a best-effort classifier.
 */
export function classifyWorkload(podName: string): WorkloadType {
  const lower = podName.toLowerCase();

  for (const pattern of DATABASE_PATTERNS) {
    if (lower.includes(pattern)) return 'database';
  }

  for (const pattern of DAEMONSET_PATTERNS) {
    if (lower.includes(pattern)) return 'daemonset';
  }

  return 'deployment';
}

// ---------------------------------------------------------------------------
// District Layout (Grid Bin-Packing)
// ---------------------------------------------------------------------------

export interface DistrictBounds {
  x: number;
  z: number;
  width: number;
  depth: number;
}

const DISTRICT_COLUMNS = 3;
const DISTRICT_SPACING = 20; // Minimum safety margin between district edges
const POD_CELL_SIZE = 3.5;   // Spacing between pod centers in the matrix
const PODS_PER_ROW = 4;      // Max pods per row inside a district
const DISTRICT_PADDING = 3;  // Internal padding inside district bounds

/**
 * Computes spatial bounds for each namespace district using a grid-offset layout.
 * Districts are arranged in `DISTRICT_COLUMNS` columns with dynamic width/depth
 * based on pod count, ensuring no two districts ever overlap.
 */
export function computeDistrictLayout(
  namespaceMap: Record<string, Pod[]>,
): Record<string, DistrictBounds> {
  const namespaces = Object.keys(namespaceMap).sort();
  const result: Record<string, DistrictBounds> = {};

  // Pre-compute dimensions for each district
  const districtSizes: { ns: string; width: number; depth: number }[] = [];

  for (const ns of namespaces) {
    const podCount = namespaceMap[ns].length;
    const cols = Math.min(podCount, PODS_PER_ROW);
    const rows = Math.ceil(podCount / PODS_PER_ROW);

    const width = Math.max(cols * POD_CELL_SIZE + DISTRICT_PADDING * 2, 12);
    const depth = Math.max(rows * POD_CELL_SIZE + DISTRICT_PADDING * 2, 12);

    districtSizes.push({ ns, width, depth });
  }

  // Arrange districts in a grid, tracking cumulative offsets per row
  const rowHeights: number[] = []; // max depth per grid-row
  const colWidths: number[] = [];  // max width per grid-column

  // First pass: compute max dimensions per grid row/column
  for (let i = 0; i < districtSizes.length; i++) {
    const col = i % DISTRICT_COLUMNS;
    const row = Math.floor(i / DISTRICT_COLUMNS);
    const { width, depth } = districtSizes[i];

    if (!colWidths[col] || width > colWidths[col]) {
      colWidths[col] = width;
    }
    if (!rowHeights[row] || depth > rowHeights[row]) {
      rowHeights[row] = depth;
    }
  }

  // Second pass: compute cumulative X/Z offsets and center the grid
  const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (colWidths.length - 1) * DISTRICT_SPACING;
  const colOffsets: number[] = [];
  let cumX = -totalWidth / 2;
  for (let c = 0; c < colWidths.length; c++) {
    colOffsets[c] = cumX + colWidths[c] / 2;
    cumX += colWidths[c] + DISTRICT_SPACING;
  }

  const rowOffsets: number[] = [];
  let cumZ = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    rowOffsets[r] = cumZ + rowHeights[r] / 2;
    cumZ += rowHeights[r] + DISTRICT_SPACING;
  }

  // Center vertically
  const totalDepth = cumZ - DISTRICT_SPACING;
  const zShift = -totalDepth / 2;

  // Assign final positions
  for (let i = 0; i < districtSizes.length; i++) {
    const col = i % DISTRICT_COLUMNS;
    const row = Math.floor(i / DISTRICT_COLUMNS);
    const { ns, width, depth } = districtSizes[i];

    result[ns] = {
      x: colOffsets[col],
      z: rowOffsets[row] + zShift,
      width,
      depth,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pod Matrix Layout (within a district)
// ---------------------------------------------------------------------------

export interface PodLayoutInfo {
  pod: Pod;
  worldX: number;
  worldZ: number;
  workloadType: WorkloadType;
  localCol: number;
  localRow: number;
}

/**
 * Arranges pods in a clean matrix grid within their district bounds.
 * Groups by workload classification so databases, daemonsets, and deployments
 * cluster together within the district.
 */
export function computePodMatrix(
  pods: Pod[],
  district: DistrictBounds,
): PodLayoutInfo[] {
  // Sort pods by workload type for visual clustering
  const classified = pods.map((pod) => ({
    pod,
    workloadType: classifyWorkload(pod.name),
  }));

  // Workload ordering: databases first, then deployments, then daemonsets
  const typeOrder: Record<WorkloadType, number> = {
    database: 0,
    deployment: 1,
    daemonset: 2,
  };
  classified.sort((a, b) => typeOrder[a.workloadType] - typeOrder[b.workloadType]);

  const result: PodLayoutInfo[] = [];

  for (let i = 0; i < classified.length; i++) {
    const col = i % PODS_PER_ROW;
    const row = Math.floor(i / PODS_PER_ROW);

    // Center the matrix within the district
    const totalCols = Math.min(classified.length, PODS_PER_ROW);
    const totalRows = Math.ceil(classified.length / PODS_PER_ROW);

    const matrixWidth = (totalCols - 1) * POD_CELL_SIZE;
    const matrixDepth = (totalRows - 1) * POD_CELL_SIZE;

    const localX = col * POD_CELL_SIZE - matrixWidth / 2;
    const localZ = row * POD_CELL_SIZE - matrixDepth / 2;

    result.push({
      pod: classified[i].pod,
      worldX: district.x + localX,
      worldZ: district.z + localZ,
      workloadType: classified[i].workloadType,
      localCol: col,
      localRow: row,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// World Position Lookup (for traffic beam resolution)
// ---------------------------------------------------------------------------

/**
 * Returns a flat lookup table mapping pod names to world-space Vector3 positions.
 * Used by DataParticle to resolve source/destination coordinates for traffic beams.
 */
export function computeWorldPositions(
  namespaceMap: Record<string, Pod[]>,
  districtLayout: Record<string, DistrictBounds>,
): Record<string, THREE.Vector3> {
  const positions: Record<string, THREE.Vector3> = {};

  for (const ns of Object.keys(namespaceMap)) {
    const district = districtLayout[ns];
    if (!district) continue;

    const podLayout = computePodMatrix(namespaceMap[ns], district);

    for (const info of podLayout) {
      positions[info.pod.name] = new THREE.Vector3(info.worldX, 1.5, info.worldZ);
    }
  }

  return positions;
}
