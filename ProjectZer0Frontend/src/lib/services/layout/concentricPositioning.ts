// src/lib/services/layout/concentricPositioning.ts

import type { 
    ConcentricLayoutConfig, 
    ConcentricNodePosition, 
    NodeLayoutMetadata,
    SortMode 
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
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
  
    // Position center node
    positions.set(centerNode.id, {
      x: centerX,
      y: centerY,
      scale: 1,
      ring: 0,
      ringPosition: 0,
      distanceFromCenter: 0
    });
  
    // Sort nodes based on mode
    const sortedNodes = sortNodes(alternativeNodes, sortMode);
  
    // Calculate rings needed
    const nodesPerRing = calculateNodesPerRing();
    const rings = distributeNodesIntoRings(sortedNodes, nodesPerRing);
  
    // Position nodes in each ring
    rings.forEach((nodesInRing, ringIndex) => {
      const ringRadius = config.centerRadius + (ringIndex + 1) * config.ringSpacing;
      positionNodesInRing(nodesInRing, ringRadius, ringIndex + 1, positions, centerX, centerY);
    });
  
    return positions;
  }
  
  function sortNodes(nodes: NodeLayoutMetadata[], mode: SortMode): NodeLayoutMetadata[] {
    return [...nodes].sort((a, b) => {
      if (mode === 'newest') {
        return b.timestamp.getTime() - a.timestamp.getTime();
      }
      return b.votesCount - a.votesCount;
    });
  }
  
  function calculateNodesPerRing(): number[] {
    // Calculate how many nodes can fit in each ring based on circumference
    // This could be made more sophisticated based on node sizes and spacing
    return [6, 12, 18, 24]; // Example: increasing capacity per ring
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
  
  function positionNodesInRing(
    nodes: NodeLayoutMetadata[],
    radius: number,
    ringNumber: number,
    positions: Map<string, ConcentricNodePosition>,
    centerX: number,
    centerY: number
  ): void {
    const angleStep = (2 * Math.PI) / nodes.length;
    
    nodes.forEach((node, index) => {
      const angle = index * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      // Calculate scale based on ring number (nodes further out are smaller)
      const scale = Math.max(0.5, 1 - (ringNumber * 0.15));
  
      positions.set(node.id, {
        x,
        y,
        scale,
        ring: ringNumber,
        ringPosition: index / nodes.length,
        distanceFromCenter: radius,
        rotation: (angle * 180) / Math.PI // Convert to degrees
      });
    });
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
  
  // Helper function to get the ideal radius for a ring based on node count
  export function calculateIdealRingRadius(
    nodeCount: number,
    nodeSize: number,
    spacing: number
  ): number {
    const circumference = nodeCount * (nodeSize + spacing);
    return circumference / (2 * Math.PI);
  }
  
  // Helper to check if a position would cause overlap
  export function wouldCauseOverlap(
    position: ConcentricNodePosition,
    existingPositions: ConcentricNodePosition[],
    minDistance: number
  ): boolean {
    return existingPositions.some(existing => {
      const dx = position.x - existing.x;
      const dy = position.y - existing.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < minDistance;
    });
  }