// src/lib/components/graph/edges/utils/edgeUtils.ts
import type { GraphNode } from '$lib/types/graph';
import type { Definition } from '$lib/types/nodes';
import { NODE_CONSTANTS } from '../../nodes/base/BaseNodeConstants';

export function getNodeRadius(node: GraphNode): number {
    if (node.type === 'word') {
        return NODE_CONSTANTS.SIZES.WORD.preview / 2;
    }
    
    if (node.type === 'definition') {
        const definitionData = node.data as Definition;
        const isLive = definitionData.isLive ?? false;
        return isLive ? 
            NODE_CONSTANTS.SIZES.DEFINITION.live.preview / 2 :
            NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview / 2;
    }

    return NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview / 2;
}

export function adjustEdgeLength(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    sourceRadius: number,
    targetRadius: number
): { x1: number; y1: number; x2: number; y2: number } {
    // Calculate the total distance between centers
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return { x1: sourceX, y1: sourceY, x2: targetX, y2: targetY };

    // Calculate the direction unit vector
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Calculate edge start and end points at node boundaries
    return {
        x1: sourceX + (directionX * sourceRadius),
        y1: sourceY + (directionY * sourceRadius),
        x2: targetX - (directionX * targetRadius),
        y2: targetY - (directionY * targetRadius)
    };
}

export function calculateEdgePath(
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
): string {
    // Simple straight line
    return `M${sourceX},${sourceY}L${targetX},${targetY}`;
}