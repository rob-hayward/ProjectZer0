// // src/lib/components/graph/layouts/ConcentricLayout.ts
// import type { GraphNode, GraphEdge } from '$lib/types/graph';
// import type { SvgLayoutConfig, SvgNodePosition } from '$lib/types/svgLayout';

// export const LAYOUT_CONSTANTS = {
//     NODE_SIZES: {
//         WORD: 300,
//         DEFINITION: 360
//     },
    
//     RING_SPACING: 800,
//     SPACING_MULTIPLIERS: {
//         LIVE_DEFINITION: 0.5,
//         ALTERNATIVE: 0.7,
//         RING_INCREMENT: 0.2
//     },
    
//     ZOOM: {
//         INITIAL: 100,
//         MIN: 25,
//         MAX: 200
//     },

//     SVG: {
//         TRANSITION_DURATION: 300,
//         TRANSITION_EASING: 'cubic-bezier(0.4, 0, 0.2, 1)'
//     }
// } as const;

// export const DEFAULT_CONFIG: SvgLayoutConfig = {
//     renderMode: 'svg',
//     viewport: {
//         width: 0,
//         height: 0
//     },
//     animation: {
//         duration: LAYOUT_CONSTANTS.SVG.TRANSITION_DURATION,
//         easing: LAYOUT_CONSTANTS.SVG.TRANSITION_EASING
//     },
//     centerRadius: LAYOUT_CONSTANTS.NODE_SIZES.WORD / 2,
//     ringSpacing: LAYOUT_CONSTANTS.RING_SPACING,
//     minNodeSize: LAYOUT_CONSTANTS.NODE_SIZES.DEFINITION,
//     maxNodeSize: LAYOUT_CONSTANTS.NODE_SIZES.WORD,
//     initialZoom: LAYOUT_CONSTANTS.ZOOM.INITIAL / 100,
//     minZoom: LAYOUT_CONSTANTS.ZOOM.MIN / 100,
//     maxZoom: LAYOUT_CONSTANTS.ZOOM.MAX / 100
// };

// /**
//  * ConcentricLayout class handles the positioning of nodes in a concentric layout pattern.
//  * It maintains two coordinate systems:
//  * 1. Logical coordinates (x, y): Used for edge connections and position tracking
//  * 2. Rendering transforms (svgTransform): Used for actual node rendering and D3 zoom interaction
//  */
// export class ConcentricLayout {
//     protected config: SvgLayoutConfig;

//     constructor(config: Partial<SvgLayoutConfig> = {}) {
//         this.config = { ...DEFAULT_CONFIG, ...config };
//     }

//     /**
//      * Calculates the layout positions for all nodes.
//      * 
//      * The coordinate system uses two separate concepts:
//      * - Logical positions (x, y): Center of the screen (width/2, height/2)
//      * - Rendering transforms: Starting at (0,0) to work with D3 zoom
//      * 
//      * This separation allows:
//      * 1. Correct edge positioning and calculations using logical coordinates
//      * 2. Proper zoom behavior around the cursor using D3's transform
//      * 3. Node components to handle their own internal centering
//      */
//     calculateLayout(
//         nodes: GraphNode[], 
//         edges: GraphEdge[], 
//         containerWidth: number, 
//         containerHeight: number
//     ): Map<string, SvgNodePosition> {
//         const positions = new Map<string, SvgNodePosition>();
//         const centerNode = nodes.find(node => !edges.some(edge => edge.target === node.id));
        
//         if (!centerNode) return positions;
    
//         const centerX = containerWidth / 2;
//         const centerY = containerHeight / 2;
//         const baseRadius = 250; // Smaller base radius
        
//         // Position center node
//         positions.set(centerNode.id, {
//             x: centerX,
//             y: centerY,
//             scale: 1,
//             ring: 0,
//             ringPosition: 0,
//             distanceFromCenter: 0,
//             rotation: 0,
//             svgTransform: this.createSvgTransform(0, 0, 1, 0),
//             renderOrder: 0
//         });
    
//         const connectedNodes = this.getConnectedNodes(nodes, edges, centerNode);
//         const sortedNodes = this.sortByImportance(connectedNodes);
    
//         if (sortedNodes.length === 1) {
//             // Special case for single definition
//             const node = sortedNodes[0];
//             const angle = -Math.PI / 8;  // 30 degrees up from horizontal right
//             const x = centerX + Math.cos(angle) * baseRadius;
//             const y = centerY + Math.sin(angle) * baseRadius;
            
//             positions.set(node.id, {
//                 x,
//                 y,
//                 scale: 0.9,
//                 ring: 1,
//                 ringPosition: 0,
//                 distanceFromCenter: baseRadius,
//                 rotation: 0,
//                 svgTransform: this.createSvgTransform(x, y, scale, 0),
//                 renderOrder: 1
//             });
//         } else {
//             sortedNodes.forEach((node, index) => {
//                 let angle, radius;
                
//                 if (index === 0) {
//                     // Live definition at -30 degrees
//                     angle = -Math.PI / 6;
//                     radius = baseRadius;
//                 } else {
//                     // Other definitions in an arc
//                     const remainingAngleRange = (2 * Math.PI) - (2 * Math.PI / sortedNodes.length);
//                     const angleStep = remainingAngleRange / Math.max(1, sortedNodes.length - 1);
//                     angle = -Math.PI / 6 + (index * angleStep);
                    
//                     // Gradually increase radius for subsequent nodes
//                     radius = baseRadius * (1 + (index * 0.15));
//                 }
    
//                 const x = centerX + Math.cos(angle) * radius;
//                 const y = centerY + Math.sin(angle) * radius;
    
//                 // Scale based on position
//                 const positionScale = Math.max(0.8, 1 - (index * 0.05));
//                 const scale = 0.9 * positionScale;
    
//                 positions.set(node.id, {
//                     x,
//                     y,
//                     scale,
//                     ring: 1,
//                     ringPosition: index / sortedNodes.length,
//                     distanceFromCenter: radius,
//                     rotation: 0,
//                     svgTransform: this.createSvgTransform(x - centerX, y - centerY, scale, 0),
//                     renderOrder: 1
//                 });
//             });
//         }
    
//         return positions;
//     }

//     /**
//      * Creates an SVG transform string for rendering.
//      * The transform is applied in this order: translate -> scale -> rotate
//      */
//     protected createSvgTransform(x: number, y: number, scale: number, rotation: number): string {
//         return `translate(${x} ${y}) scale(${scale}) rotate(${rotation})`;
//     }

//     private getConnectedNodes(nodes: GraphNode[], edges: GraphEdge[], centerNode: GraphNode): GraphNode[] {
//         return nodes.filter(node => 
//             edges.some(edge => edge.source === centerNode.id && edge.target === node.id)
//         );
//     }

//     protected sortByImportance(nodes: GraphNode[]): GraphNode[] {
//         return [...nodes].sort((a, b) => {
//             if ('votes' in a.data && 'votes' in b.data) {
//                 return (b.data.votes as number) - (a.data.votes as number);
//             }
//             return 0;
//         });
//     }
// }