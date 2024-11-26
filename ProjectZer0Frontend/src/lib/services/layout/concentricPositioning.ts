// src/lib/services/layout/concentricPositioning.ts
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
    
    // Calculate base scale based on canvas size
    const baseScale = Math.min(canvasWidth, canvasHeight) / 2000;
    
    // Position center node exactly in the middle with appropriate scale
    positions.set(centerNode.id, {
      x: 0,
      y: 0,
      scale: baseScale,
      ring: 0,
      ringPosition: 0,
      distanceFromCenter: 0
    });
  
    // Sort nodes based on mode
    const sortedNodes = sortNodes(alternativeNodes, sortMode);
  
    // Calculate optimal distribution of nodes
    const totalNodes = sortedNodes.length;
    const nodesPerRing = calculateOptimalNodesPerRing(totalNodes);
    const rings = distributeNodesIntoRings(sortedNodes, nodesPerRing);
  
    // Position nodes in each ring
    rings.forEach((nodesInRing, ringIndex) => {
      const ringRadius = (config.centerRadius + (ringIndex + 1) * config.ringSpacing) * baseScale;
      positionNodesInRing(nodesInRing, ringRadius, ringIndex + 1, positions, baseScale);
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
  
  function positionNodesInRing(
    nodes: NodeLayoutMetadata[],
    radius: number,
    ringNumber: number,
    positions: Map<string, ConcentricNodePosition>,
    baseScale: number
  ): void {
    const angleStep = (2 * Math.PI) / nodes.length;
    const startAngle = -Math.PI / 2;
    
    nodes.forEach((node, index) => {
      const angle = startAngle + (index * angleStep);
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      
      const scale = baseScale * Math.max(0.7, 1 - (ringNumber * 0.1));
  
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
  
  function interpolate(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }