import type { GraphNode, GraphEdge } from '$lib/types/graph';

export interface ConcentricLayoutConfig {
    centerRadius: number;
    ringSpacing: number;
    minNodeSize: number;
    maxNodeSize: number;
    initialZoom: number;
    minZoom: number;
    maxZoom: number;
}

export interface NodePosition {
    x: number;
    y: number;
    scale: number;
    ring: number;
    ringPosition: number;
    distanceFromCenter: number;
    rotation: number;
}

export const LAYOUT_CONSTANTS = {
    // Node Sizes
    NODE_SIZES: {
        WORD: 300,
        DEFINITION: 360
    },
    
    // Spacing
    RING_SPACING: 250,
    SPACING_MULTIPLIERS: {
        LIVE_DEFINITION: 1.0,
        ALTERNATIVE: 1.2,
        RING_INCREMENT: 0.2
    },
    
    // View Settings
    ZOOM: {
        INITIAL: 100,
        MIN: 40,
        MAX: 200
    }
} as const;

export const DEFAULT_CONFIG: ConcentricLayoutConfig = {
    centerRadius: LAYOUT_CONSTANTS.NODE_SIZES.WORD / 2,
    ringSpacing: LAYOUT_CONSTANTS.RING_SPACING,
    minNodeSize: LAYOUT_CONSTANTS.NODE_SIZES.DEFINITION,
    maxNodeSize: LAYOUT_CONSTANTS.NODE_SIZES.WORD,
    initialZoom: LAYOUT_CONSTANTS.ZOOM.INITIAL / 100,
    minZoom: LAYOUT_CONSTANTS.ZOOM.MIN / 100,
    maxZoom: LAYOUT_CONSTANTS.ZOOM.MAX / 100
};

export class ConcentricLayout {
    private config: ConcentricLayoutConfig;

    constructor(config: Partial<ConcentricLayoutConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    calculateLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<string, NodePosition> {
        const positions = new Map<string, NodePosition>();
        const centerNode = nodes.find(node => !edges.some(edge => edge.target === node.id));
        
        if (!centerNode) {
            return positions;
        }

        // Position center node
        positions.set(centerNode.id, {
            x: 0,
            y: 0,
            scale: 1,
            ring: 0,
            ringPosition: 0,
            distanceFromCenter: 0,
            rotation: 0
        });

        // Get connected nodes (definitions)
        const connectedNodes = nodes.filter(node => 
            edges.some(edge => edge.source === centerNode.id && edge.target === node.id)
        );

        // Sort connected nodes by votes if they're definitions
        const sortedNodes = this.sortByImportance(connectedNodes);

        // Position connected nodes in rings
        this.positionNodesInRings(sortedNodes, positions);

        return positions;
    }

    private sortByImportance(nodes: GraphNode[]): GraphNode[] {
        return [...nodes].sort((a, b) => {
            if ('votes' in a.data && 'votes' in b.data) {
                return (b.data.votes as number) - (a.data.votes as number);
            }
            return 0;
        });
    }

    private positionNodesInRings(nodes: GraphNode[], positions: Map<string, NodePosition>): void {
        nodes.forEach((node, index) => {
            const ringIndex = Math.floor(index / 6) + 1;
            const nodesInRing = Math.min(6, nodes.length - (ringIndex - 1) * 6);
            const angleStep = (2 * Math.PI) / nodesInRing;
            const nodeInRingIndex = index % 6;
            
            const radius = this.config.ringSpacing * ringIndex;
            const angle = angleStep * nodeInRingIndex;
            
            positions.set(node.id, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                scale: 1 - (ringIndex * 0.1),
                ring: ringIndex,
                ringPosition: nodeInRingIndex / nodesInRing,
                distanceFromCenter: radius,
                rotation: (angle * 180) / Math.PI
            });
        });
    }
}