// // ProjectZer0Frontend/src/lib/components/graphElements/layouts/concentricLayouts/base/concentricPositioning.ts
// import type { 
//   ConcentricLayoutConfig, 
//   NodeLayoutMetadata, 
//   SortMode,
//   ConcentricNodePosition 
// } from '$lib/types/graphLayout';

// // Layout Constants
// export const LAYOUT_CONSTANTS = {
//   // Node Sizes
//   WORD_NODE_SIZE: 300,          
//   DEFINITION_NODE_SIZE: 360,    
  
//   // Spacing
//   BASE_RING_SPACING: 250,      
//   SPACING_MULTIPLIERS: {
//       LIVE_DEFINITION: 1.0,     
//       ALTERNATIVE_SPACING: 1.2,  
//       RING_INCREMENT: 0.2       
//   },
  
//   // Zoom and View Settings
//   INITIAL_ZOOM: 100,
//   MIN_ZOOM: 40,
//   MAX_ZOOM: 200,
//   PAN_SPEED: 20
// } as const;

// // Default layout configuration
// export const DEFAULT_CONFIG: ConcentricLayoutConfig = {
//   centerRadius: LAYOUT_CONSTANTS.WORD_NODE_SIZE / 2,
//   ringSpacing: LAYOUT_CONSTANTS.BASE_RING_SPACING,
//   minNodeSize: LAYOUT_CONSTANTS.DEFINITION_NODE_SIZE,
//   maxNodeSize: LAYOUT_CONSTANTS.WORD_NODE_SIZE,
//   initialZoom: LAYOUT_CONSTANTS.INITIAL_ZOOM / 100,
//   minZoom: LAYOUT_CONSTANTS.MIN_ZOOM / 100,
//   maxZoom: LAYOUT_CONSTANTS.MAX_ZOOM / 100
// };

// // Helper function to sort nodes by vote count
// function sortNodes(nodes: NodeLayoutMetadata[], mode: SortMode): NodeLayoutMetadata[] {
//   return [...nodes].sort((a, b) => {
//     if (mode === 'newest') {
//       return b.timestamp.getTime() - a.timestamp.getTime();
//     }
//     // For popular mode, put liveDefinition first, then sort by votes
//     if (a.nodeType === 'liveDefinition') return -1;
//     if (b.nodeType === 'liveDefinition') return 1;
//     return b.votesCount - a.votesCount;
//   });
// }

// function calculateRingRadius(ringIndex: number, baseSpacing: number, nodeVotes: number, totalNodes: number): number {
//   const baseRadius = baseSpacing * LAYOUT_CONSTANTS.SPACING_MULTIPLIERS.LIVE_DEFINITION;
  
//   if (ringIndex > 0) {
//     const voteMultiplier = Math.max(0.5, Math.min(1, nodeVotes / 100));
//     const popularitySpacing = baseSpacing * (1.2 - voteMultiplier);
//     const positionSpacing = baseSpacing * (ringIndex / totalNodes) * LAYOUT_CONSTANTS.SPACING_MULTIPLIERS.RING_INCREMENT;
    
//     return baseRadius + popularitySpacing + positionSpacing;
//   }
  
//   return baseRadius;
// }

// function positionNodesInRing(
//   nodes: NodeLayoutMetadata[],
//   radius: number,
//   ringNumber: number,
//   positions: Map<string, ConcentricNodePosition>,
//   baseScale: number,
//   centerX: number,
//   centerY: number
// ): void {
//   const totalNodes = nodes.length;
  
//   if (totalNodes === 1) {
//     const node = nodes[0];
//     const angle = -Math.PI / 6;  // 30 degrees up from horizontal right
//     const adjustedRadius = calculateRingRadius(0, radius, node.votesCount, totalNodes);
//     const x = Math.cos(angle) * adjustedRadius;
//     const y = Math.sin(angle) * adjustedRadius;
    
//     positions.set(node.id, {
//       x,
//       y,
//       scale: baseScale,
//       ring: ringNumber,
//       ringPosition: 0,
//       distanceFromCenter: adjustedRadius,
//       rotation: (angle * 180) / Math.PI
//     });
//     return;
//   }

//   nodes.forEach((node, index) => {
//     let angle: number;
    
//     if (index === 0) {
//       angle = -Math.PI / 6;  // First node always at -30 degrees
//     } else if (totalNodes === 2) {
//       angle = -Math.PI / 6 + Math.PI;  // Second node opposite when only two
//     } else {
//       const remainingAngleRange = 2 * Math.PI - (2 * Math.PI / totalNodes);
//       const angleStep = remainingAngleRange / (totalNodes - 1);
//       angle = -Math.PI / 6 + ((index) * angleStep);
//     }

//     const adjustedRadius = calculateRingRadius(index, radius, node.votesCount, totalNodes);
//     const x = Math.cos(angle) * adjustedRadius;
//     const y = Math.sin(angle) * adjustedRadius;
    
//     const voteMultiplier = Math.max(0.8, Math.min(1, node.votesCount / 100));
//     const positionScale = Math.max(0.8, 1 - (index * 0.05));
//     const scale = baseScale * voteMultiplier * positionScale;

//     positions.set(node.id, {
//       x,
//       y,
//       scale,
//       ring: ringNumber,
//       ringPosition: index / totalNodes,
//       distanceFromCenter: adjustedRadius,
//       rotation: (angle * 180) / Math.PI
//     });
//   });
// }

// function calculateOptimalNodesPerRing(totalNodes: number): number[] {
//   if (totalNodes <= 6) return [totalNodes];
//   if (totalNodes <= 12) return [6, totalNodes - 6];
  
//   const rings: number[] = [];
//   let remainingNodes = totalNodes;
//   let currentRingCapacity = 6;
  
//   while (remainingNodes > 0) {
//     const nodesInThisRing = Math.min(currentRingCapacity, remainingNodes);
//     rings.push(nodesInThisRing);
//     remainingNodes -= nodesInThisRing;
//     currentRingCapacity = Math.floor(currentRingCapacity * 1.5);
//   }
  
//   return rings;
// }

// function distributeNodesIntoRings(
//   nodes: NodeLayoutMetadata[],
//   nodesPerRing: number[]
// ): NodeLayoutMetadata[][] {
//   const rings: NodeLayoutMetadata[][] = [];
//   let nodeIndex = 0;

//   for (const capacity of nodesPerRing) {
//     if (nodeIndex >= nodes.length) break;
    
//     const ring: NodeLayoutMetadata[] = [];
//     for (let i = 0; i < capacity && nodeIndex < nodes.length; i++) {
//       ring.push(nodes[nodeIndex]);
//       nodeIndex++;
//     }
//     rings.push(ring);
//   }

//   return rings;
// }

// export function calculateNodePositions(
//   centerNode: NodeLayoutMetadata,
//   alternativeNodes: NodeLayoutMetadata[],
//   config: ConcentricLayoutConfig,
//   sortMode: SortMode,
//   canvasWidth: number,
//   canvasHeight: number
// ): Map<string, ConcentricNodePosition> {
//   const positions = new Map<string, ConcentricNodePosition>();
  
//   // Calculate base scale based on viewport
//   const baseScale = Math.max(0.5, Math.min(canvasWidth, canvasHeight) / 1000);
  
//   // Position center word node at origin
//   positions.set(centerNode.id, {
//     x: 0,
//     y: 0,
//     scale: baseScale,
//     ring: 0,
//     ringPosition: 0,
//     distanceFromCenter: 0,
//     rotation: 0
//   });

//   const sortedNodes = sortNodes(alternativeNodes, sortMode);
//   const nodesPerRing = calculateOptimalNodesPerRing(sortedNodes.length);
//   const rings = distributeNodesIntoRings(sortedNodes, nodesPerRing);

//   rings.forEach((nodesInRing, ringIndex) => {
//     const radius = calculateRingRadius(ringIndex + 1, config.ringSpacing, 0, rings.length);
//     positionNodesInRing(nodesInRing, radius, ringIndex + 1, positions, baseScale, 0, 0);
//   });

//   return positions;
// }

// export function calculateTransitionPositions(
//   currentPositions: Map<string, ConcentricNodePosition>,
//   targetPositions: Map<string, ConcentricNodePosition>,
//   progress: number
// ): Map<string, ConcentricNodePosition> {
//   const interpolatedPositions = new Map<string, ConcentricNodePosition>();

//   currentPositions.forEach((currentPos, nodeId) => {
//     const targetPos = targetPositions.get(nodeId);
//     if (!targetPos) return;

//     interpolatedPositions.set(nodeId, {
//       x: interpolate(currentPos.x, targetPos.x, progress),
//       y: interpolate(currentPos.y, targetPos.y, progress),
//       scale: interpolate(currentPos.scale, targetPos.scale, progress),
//       ring: targetPos.ring,
//       ringPosition: interpolate(currentPos.ringPosition, targetPos.ringPosition, progress),
//       distanceFromCenter: interpolate(currentPos.distanceFromCenter, targetPos.distanceFromCenter, progress),
//       rotation: interpolate(currentPos.rotation || 0, targetPos.rotation || 0, progress)
//     });
//   });

//   return interpolatedPositions;
// }

// function interpolate(start: number, end: number, progress: number): number {
//   return start + (end - start) * progress;
// }