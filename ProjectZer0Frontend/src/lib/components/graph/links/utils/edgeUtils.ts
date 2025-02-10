// // src/lib/components/graph/edges/utils/edgeUtils.ts
// import type { GraphNode } from '$lib/types/graph/core';
// import type { Definition } from '$lib/types/nodes';
// import { NODE_CONSTANTS } from '../../../../constants/graph/NodeConstants';

// export function getNodeRadius(node: GraphNode): number {
//     if (node.type === 'word') {
//         return NODE_CONSTANTS.SIZES.WORD.preview / 2;
//     }
    
//     if (node.type === 'definition') {
//         const definitionData = node.data as Definition;
//         const isLive = definitionData.isLive ?? false;
//         return isLive ? 
//             NODE_CONSTANTS.SIZES.DEFINITION.live.preview / 2 :
//             NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview / 2;
//     }

//     return NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview / 2;
// }

// export function calculateEdgePath(
//     sourceX: number,
//     sourceY: number,
//     targetX: number,
//     targetY: number,
//     sourceNode: GraphNode,
//     targetNode: GraphNode
// ): string {
//     // Get the direction vector
//     const dx = targetX - sourceX;
//     const dy = targetY - sourceY;
//     const distance = Math.sqrt(dx * dx + dy * dy);

//     if (distance === 0) {
//         return '';
//     }

//     // Calculate unit vector
//     const unitX = dx / distance;
//     const unitY = dy / distance;

//     // Get node radii
//     const sourceRadius = getNodeRadius(sourceNode);
//     const targetRadius = getNodeRadius(targetNode);

//     // Calculate start and end points at node boundaries
//     const startX = sourceX + (unitX * sourceRadius);
//     const startY = sourceY + (unitY * sourceRadius);
//     const endX = targetX - (unitX * targetRadius);
//     const endY = targetY - (unitY * targetRadius);

//     return `M${startX},${startY}L${endX},${endY}`;
// }