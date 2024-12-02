// ProjectZer0Frontend/src/lib/components/graphElements/layouts/concentricLayouts/base/concentricPositioning.ts
import type { 
  ConcentricLayoutConfig, 
  NodeLayoutMetadata, 
  SortMode,
  ConcentricNodePosition 
} from '$lib/types/layout';

export function calculateNodePositions(
  centerNode: NodeLayoutMetadata,
  alternativeNodes: NodeLayoutMetadata[],
  config: ConcentricLayoutConfig,
  sortMode: SortMode,
  canvasWidth: number,
  canvasHeight: number
): Map<string, ConcentricNodePosition> {
  const positions = new Map<string, ConcentricNodePosition>();
  
  // Use viewport-relative scaling
  const baseScale = Math.max(0.5, Math.min(canvasWidth, canvasHeight) / 1000);
  
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  
  // Position center node
  positions.set(centerNode.id, {
      x: centerX,
      y: centerY,
      scale: baseScale,
      ring: 0,
      ringPosition: 0,
      distanceFromCenter: 0,
      rotation: 0
  });

  const sortedNodes = sortNodes(alternativeNodes, sortMode);
  const totalNodes = sortedNodes.length;
  const nodesPerRing = calculateOptimalNodesPerRing(totalNodes);
  const rings = distributeNodesIntoRings(sortedNodes, nodesPerRing);

  // Position nodes with tighter spacing from center
  rings.forEach((nodesInRing, ringIndex) => {
      // Modify the radius calculation to start closer to the center
      // and increase by smaller increments
      const ringRadius = ringIndex === 0 
  ? config.ringSpacing * 0.6  // First ring is closer
  : (ringIndex + 1) * config.ringSpacing;
      positionNodesInRing(nodesInRing, ringRadius, ringIndex + 1, positions, baseScale, centerX, centerY);
  });

  return positions;
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
  const angleStep = (2 * Math.PI) / nodes.length;
  // Start angle offset to position first node at top
  const startAngle = -Math.PI / 2;
  
  nodes.forEach((node, index) => {
      const angle = startAngle + (index * angleStep);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      // Scale gets smaller as rings go out, but not too much
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

function sortNodes(nodes: NodeLayoutMetadata[], mode: SortMode): NodeLayoutMetadata[] {
  return [...nodes].sort((a, b) => {
      if (mode === 'newest') {
          return b.timestamp.getTime() - a.timestamp.getTime();
      }
      return b.votesCount - a.votesCount;
  });
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
          distanceFromCenter: interpolate(
              currentPos.distanceFromCenter,
              targetPos.distanceFromCenter,
              progress
          ),
          rotation: interpolate(currentPos.rotation || 0, targetPos.rotation || 0, progress)
      });
  });

  return interpolatedPositions;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}