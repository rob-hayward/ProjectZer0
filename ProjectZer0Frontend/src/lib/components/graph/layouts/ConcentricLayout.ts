// src/lib/components/graph/layouts/ConcentricLayout.ts
import * as d3 from 'd3';
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
   NODE_SIZES: {
       WORD: 300,
       DEFINITION: 360
   },
   
   RING_SPACING: 400,  // Increased for better spacing
   SPACING_MULTIPLIERS: {
       LIVE_DEFINITION: 1.0,
       ALTERNATIVE: 1.2,
       RING_INCREMENT: 0.2
   },
   
   ZOOM: {
       INITIAL: 100,
       MIN: 25,
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

// In ConcentricLayout.ts
export class ConcentricLayout {
    private config: ConcentricLayoutConfig;

    constructor(config: Partial<ConcentricLayoutConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    calculateLayout(nodes: GraphNode[], edges: GraphEdge[], containerWidth: number, containerHeight: number): Map<string, NodePosition> {
        const positions = new Map<string, NodePosition>();
        const centerNode = nodes.find(node => !edges.some(edge => edge.target === node.id));
        
        if (!centerNode) return positions;

        // Position center node at exact container center
        positions.set(centerNode.id, {
            x: containerWidth / 2,
            y: containerHeight / 2,
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

        // Position nodes in a circle around center
        const radius = this.config.ringSpacing;
        sortedNodes.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / sortedNodes.length;
            
            // Calculate position relative to center node
            const x = (containerWidth / 2) + Math.cos(angle) * radius;
            const y = (containerHeight / 2) + Math.sin(angle) * radius;
            
            positions.set(node.id, {
                x,
                y,
                scale: 0.8,
                ring: 1,
                ringPosition: index / sortedNodes.length,
                distanceFromCenter: radius,
                rotation: 0
            });
        });

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
}