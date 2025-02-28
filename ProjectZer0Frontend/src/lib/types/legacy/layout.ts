// // src/lib/types/graph/layout.ts
// import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
// import type { NodeType, ViewType } from './core';

// // Expanded EdgeType to include all possible edge types
// export type EdgeType = 'live' | 'alternative' | 'definition' | 'navigation' | 'wordDefinition';

// // Layout-specific node interface
// export interface LayoutNode extends SimulationNodeDatum {
//     id: string;
//     type: NodeType | 'central';
//     subtype?: 'live' | 'alternative';
//     metadata: {
//         group: 'central' | 'word' | 'definition' | 'navigation';
//         fixed?: boolean;
//         isDetail?: boolean;
//         votes?: number;
//         createdAt?: string;
//         angle?: number;    // For navigation node positioning
//         radius?: number;   // For radial positioning
//     };
// }

// // Layout-specific edge interface
// export interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
//     source: string | LayoutNode;
//     target: string | LayoutNode;
//     type: EdgeType;
//     strength: number;
// }

// // Layout configuration
// export interface LayoutConfig {
//     width: number;
//     height: number;
//     viewType: ViewType;
//     isPreviewMode?: boolean;
// }

// // Layout result
// export interface LayoutResult {
//     nodes: Map<string, {
//         x: number;
//         y: number;
//         scale: number;
//         svgTransform: string;
//     }>;
// }

// // Force configuration
// export interface ForceConfig {
//     charge: {
//         strength: number;
//         distanceMin?: number;
//         distanceMax?: number;
//     };
//     collision: {
//         radius: number;
//         strength: number;
//     };
//     radial?: {
//         radius: number;
//         strength: number;
//     };
//     link?: {
//         distance: number;
//         strength: number;
//     };
// }