import { 
    LAYOUT_CONSTANTS,
    DEFAULT_CONFIG,
    calculateNodePositions,
    calculateTransitionPositions
} from '../base/concentricPositioning';
import type { 
    NodeLayoutMetadata, 
    SortMode,
    ConcentricNodePosition,
    ConcentricLayoutConfig 
} from '$lib/types/graphLayout';

// Word-specific layout adjustments
export const WORD_LAYOUT_CONSTANTS = {
    DEFINITION_SPACING_MULTIPLIER: 0.7,  // Make definitions slightly closer than default
    ALTERNATIVE_SPREAD: 0.9,     // Control how spread out alternative definitions are
    EXPANDED_NODE_SPACING: 1.5,  // Additional spacing multiplier when a node is expanded
} as const;

interface ExpandedNodeInfo {
    id: string;
    size: number;
}

export function calculateWordNodePositions(
    centerNode: NodeLayoutMetadata,
    alternativeNodes: NodeLayoutMetadata[],
    sortMode: SortMode,
    canvasWidth: number,
    canvasHeight: number,
    expandedNodeId?: string | null
): Map<string, ConcentricNodePosition> {
    // Use default config with word-specific adjustments
    const wordConfig = {
        ...DEFAULT_CONFIG,
        ringSpacing: DEFAULT_CONFIG.ringSpacing * WORD_LAYOUT_CONSTANTS.DEFINITION_SPACING_MULTIPLIER
    };

    // Find expanded node if any
    const expandedNode = expandedNodeId ? 
        (expandedNodeId === centerNode.id ? centerNode : 
        alternativeNodes.find(node => node.id === expandedNodeId)) : null;

    // Adjust spacing if a node is expanded
    if (expandedNode) {
        wordConfig.ringSpacing *= WORD_LAYOUT_CONSTANTS.EXPANDED_NODE_SPACING;
    }

    // Calculate base positions
    const positions = calculateNodePositions(
        centerNode,
        alternativeNodes,
        wordConfig,
        sortMode,
        canvasWidth,
        canvasHeight
    );

    // If there's an expanded node, adjust positions
    if (expandedNode && positions.has(expandedNode.id)) {
        adjustPositionsForExpandedNode(
            positions,
            expandedNode,
            centerNode,
            alternativeNodes,
            canvasWidth,
            canvasHeight
        );
    }

    return positions;
}

function adjustPositionsForExpandedNode(
    positions: Map<string, ConcentricNodePosition>,
    expandedNode: NodeLayoutMetadata,
    centerNode: NodeLayoutMetadata,
    alternativeNodes: NodeLayoutMetadata[],
    canvasWidth: number,
    canvasHeight: number
): void {
    const expandedPos = positions.get(expandedNode.id);
    if (!expandedPos) return;

    // Calculate the center point
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Move expanded node to center if it's not the center node
    if (expandedNode.id !== centerNode.id) {
        expandedPos.x = 0;
        expandedPos.y = 0;
        expandedPos.scale = 2; // Increase scale for expanded state
    }

    // Push other nodes away from expanded node
    positions.forEach((pos, id) => {
        if (id === expandedNode.id) return;

        // Calculate vector from expanded node to current node
        const dx = pos.x - expandedPos.x;
        const dy = pos.y - expandedPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate minimum required distance based on node sizes
        const expandedSize = expandedNode.size * expandedPos.scale;
        const currentSize = (id === centerNode.id ? centerNode.size : 
            alternativeNodes.find(n => n.id === id)?.size || 0) * pos.scale;
        const minDistance = (expandedSize + currentSize) / 2 * 1.2; // Add 20% padding

        // Push node away if too close
        if (distance < minDistance) {
            const pushFactor = (minDistance - distance) / distance;
            pos.x += dx * pushFactor;
            pos.y += dy * pushFactor;

            // Update ring position and distance from center
            pos.distanceFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
            pos.ringPosition = Math.atan2(pos.y, pos.x) / (2 * Math.PI) + 0.5;
        }
    });
}

// Re-export transition calculation for convenience
export { calculateTransitionPositions } from '../base/concentricPositioning';