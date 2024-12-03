// ProjectZer0Frontend/src/lib/components/graphElements/layouts/concentricLayouts/base/concentricPositioning.ts
import type { 
  ConcentricLayoutConfig, 
  NodeLayoutMetadata, 
  SortMode,
  ConcentricNodePosition 
} from '$lib/types/layout';

// Layout Constants
export const LAYOUT_CONSTANTS = {
  // Node Sizes
  WORD_NODE_SIZE: 300,          // Doubled from 180
  DEFINITION_NODE_SIZE: 360,    // Doubled from 150
  
  // Spacing
  BASE_RING_SPACING: 250,       // Halved from 250 and adjusted for better distribution
  SPACING_MULTIPLIERS: {
      LIVE_DEFINITION: 1.0,     // Adjusted to keep live definition closer
      ALTERNATIVE_SPACING: 1.2,  // Reduced for tighter grouping
      RING_INCREMENT: 0.2       // Reduced for closer rings
  },
  
  // Zoom and View Settings
  INITIAL_ZOOM: 100,
  MIN_ZOOM: 40,
  MAX_ZOOM: 200,
  PAN_SPEED: 20
} as const;

// Default layout configuration
export const DEFAULT_CONFIG: ConcentricLayoutConfig = {
  centerRadius: LAYOUT_CONSTANTS.WORD_NODE_SIZE / 2,
  ringSpacing: LAYOUT_CONSTANTS.BASE_RING_SPACING,
  minNodeSize: LAYOUT_CONSTANTS.DEFINITION_NODE_SIZE,
  maxNodeSize: LAYOUT_CONSTANTS.WORD_NODE_SIZE,
  initialZoom: LAYOUT_CONSTANTS.INITIAL_ZOOM / 100,
  minZoom: LAYOUT_CONSTANTS.MIN_ZOOM / 100,
  maxZoom: LAYOUT_CONSTANTS.MAX_ZOOM / 100
};

// Helper function to sort nodes by vote count
function sortNodes(nodes: NodeLayoutMetadata[], mode: SortMode): NodeLayoutMetadata[] {
  return [...nodes].sort((a, b) => {
    if (mode === 'newest') {
      return b.timestamp.getTime() - a.timestamp.getTime();
    }
    // For popular mode, put liveDefinition first, then sort by votes
    if (a.nodeType === 'liveDefinition') return -1;
    if (b.nodeType === 'liveDefinition') return 1;
    return b.votesCount - a.votesCount;
  });
}

function calculateRingRadius(ringIndex: number, baseSpacing: number): number {
  if (ringIndex === 0) {
    // Live definition spacing
    return baseSpacing * LAYOUT_CONSTANTS.SPACING_MULTIPLIERS.LIVE_DEFINITION;
  }
  // Alternative definitions spacing
  const baseRadius = baseSpacing * LAYOUT_CONSTANTS.SPACING_MULTIPLIERS.ALTERNATIVE_SPACING;
  const increment = baseSpacing * LAYOUT_CONSTANTS.SPACING_MULTIPLIERS.RING_INCREMENT * ringIndex;
  return baseRadius + increment;
}

function positionNodesInRing(
  nodes: NodeLayoutMetadata[],
  radius: number,
  ringNumber: number,
  positions: Map<string, ConcentricNodePosition>,
  baseScale: number,
  centerX: number,
  centerY: number
): void {
  // For single nodes in a ring
  if (nodes.length === 1) {
    const node = nodes[0];
    const angle = -Math.PI / 6;  // 30 degrees up from horizontal right
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    positions.set(node.id, {
      x,
      y,
      scale: baseScale,
      ring: ringNumber,
      ringPosition: 0,
      distanceFromCenter: radius,
      rotation: (angle * 180) / Math.PI
    });
    return;
  }

  // For multiple nodes, start from the same position and distribute around
  const angleStep = (2 * Math.PI) / Math.max(6, nodes.length);  // Use minimum of 6 positions for spacing
  const startAngle = -Math.PI / 6;  // Same starting position as single node
  
  nodes.forEach((node, index) => {
    const angle = startAngle + (index * angleStep);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    const scale = baseScale * Math.max(0.8, 1 - (ringNumber * 0.1));

    positions.set(node.id, {
      x,
      y,
      scale,
      ring: ringNumber,
      ringPosition: index / nodes.length,
      distanceFromCenter: radius,
      rotation: (angle * 180) / Math.PI
    });
  });
}

function calculateOptimalNodesPerRing(totalNodes: number): number[] {
  if (totalNodes <= 6) return [totalNodes];
  if (totalNodes <= 12) return [6, totalNodes - 6];
  
  const rings: number[] = [];
  let remainingNodes = totalNodes;
  let currentRingCapacity = 6;
  
  while (remainingNodes > 0) {
    const nodesInThisRing = Math.min(currentRingCapacity, remainingNodes);
    rings.push(nodesInThisRing);
    remainingNodes -= nodesInThisRing;
    currentRingCapacity = Math.floor(currentRingCapacity * 1.5);
  }
  
  return rings;
}

function distributeNodesIntoRings(
  nodes: NodeLayoutMetadata[],
  nodesPerRing: number[]
): NodeLayoutMetadata[][] {
  const rings: NodeLayoutMetadata[][] = [];
  let nodeIndex = 0;

  for (const capacity of nodesPerRing) {
    if (nodeIndex >= nodes.length) break;
    
    const ring: NodeLayoutMetadata[] = [];
    for (let i = 0; i < capacity && nodeIndex < nodes.length; i++) {
      ring.push(nodes[nodeIndex]);
      nodeIndex++;
    }
    rings.push(ring);
  }

  return rings;
}

export function calculateNodePositions(
  centerNode: NodeLayoutMetadata,
  alternativeNodes: NodeLayoutMetadata[],
  config: ConcentricLayoutConfig,
  sortMode: SortMode,
  canvasWidth: number,
  canvasHeight: number
): Map<string, ConcentricNodePosition> {
  const positions = new Map<string, ConcentricNodePosition>();
  
  // Calculate base scale based on viewport
  const baseScale = Math.max(0.5, Math.min(canvasWidth, canvasHeight) / 1000);
  
  // Position center word node at origin
  positions.set(centerNode.id, {
    x: 0,
    y: 0,
    scale: baseScale,
    ring: 0,
    ringPosition: 0,
    distanceFromCenter: 0,
    rotation: 0
  });

  const sortedNodes = sortNodes(alternativeNodes, sortMode);
  const nodesPerRing = calculateOptimalNodesPerRing(sortedNodes.length);
  const rings = distributeNodesIntoRings(sortedNodes, nodesPerRing);

  rings.forEach((nodesInRing, ringIndex) => {
    const radius = calculateRingRadius(ringIndex + 1, config.ringSpacing);
    positionNodesInRing(nodesInRing, radius, ringIndex + 1, positions, baseScale, 0, 0);
  });

  return positions;
}

export function calculateTransitionPositions(
  currentPositions: Map<string, ConcentricNodePosition>,
  targetPositions: Map<string, ConcentricNodePosition>,
  progress: number
): Map<string, ConcentricNodePosition> {
  const interpolatedPositions = new Map<string, ConcentricNodePosition>();

  currentPositions.forEach((currentPos, nodeId) => {
    const targetPos = targetPositions.get(nodeId);
    if (!targetPos) return;

    interpolatedPositions.set(nodeId, {
      x: interpolate(currentPos.x, targetPos.x, progress),
      y: interpolate(currentPos.y, targetPos.y, progress),
      scale: interpolate(currentPos.scale, targetPos.scale, progress),
      ring: targetPos.ring,
      ringPosition: interpolate(currentPos.ringPosition, targetPos.ringPosition, progress),
      distanceFromCenter: interpolate(currentPos.distanceFromCenter, targetPos.distanceFromCenter, progress),
      rotation: interpolate(currentPos.rotation || 0, targetPos.rotation || 0, progress)
    });
  });

  return interpolatedPositions;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}