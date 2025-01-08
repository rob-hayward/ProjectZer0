// src/lib/types/graph.ts

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { UserProfile } from './user';
import type { NavigationOption } from './navigation';
import type { Definition } from './nodes';
import type { WordNode as WordNodeData } from './nodes';  // Renamed to avoid conflict

// Node types and groups
export type NodeType = 'dashboard' | 'edit-profile' | 'create-node' | 'navigation' | 'word' | 'definition';
export type NodeGroup = 'central' | 'navigation' | 'word' | 'live-definition' | 'alternative-definition';
export type EdgeType = 'live' | 'alternative';

// Graph page data interface
export interface GraphPageData {
    view: string;
    wordData: WordNodeData | null;
}

// Node interfaces
export interface GraphNode extends SimulationNodeDatum {
    id: string;
    type: NodeType;
    data: UserProfile | NavigationOption | WordNodeData | Definition;
    group: NodeGroup;
}

export interface NodePosition {
    x: number;
    y: number;
    scale: number;
    svgTransform: string;
    angle?: number;
    distanceFromCenter?: number;
    renderOrder?: number;
}

// Edge interfaces
export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
    source: string;
    target: string;
    type: EdgeType;
    value: number;
}

export interface GraphData {
    nodes: GraphNode[];
    links?: GraphEdge[];
}

// Type guards
export function isDashboardNode(node: GraphNode): node is GraphNode & {
    type: 'dashboard';
    data: UserProfile;
} {
    return node.type === 'dashboard';
}

export function isEditProfileNode(node: GraphNode): node is GraphNode & {
    type: 'edit-profile';
    data: UserProfile;
} {
    return node.type === 'edit-profile';
}

export function isCreateNodeNode(node: GraphNode): node is GraphNode & {
    type: 'create-node';
    data: UserProfile;
} {
    return node.type === 'create-node';
}

export function isNavigationNode(node: GraphNode): node is GraphNode & {
    type: 'navigation';
    data: NavigationOption;
} {
    return node.type === 'navigation';
}

export function isWordNode(node: GraphNode): node is GraphNode & {
    type: 'word';
    data: WordNodeData;
} {
    return node.type === 'word';
}

export function isDefinitionNode(node: GraphNode): node is GraphNode & {
    type: 'definition';
    data: Definition;
} {
    return node.type === 'definition';
}

export function prepareGraphData(wordNode: WordNodeData): GraphData {
    const nodes: GraphNode[] = [
        {
            id: wordNode.id,
            type: 'word',
            data: wordNode,
            group: 'word'
        } as GraphNode,
        ...wordNode.definitions.map((def, index): GraphNode => ({
            id: def.id,
            type: 'definition',
            data: def,
            group: index === 0 ? 'live-definition' : 'alternative-definition'
        }))
    ];

    const links: GraphEdge[] = wordNode.definitions.map((def, index) => ({
        source: wordNode.id,
        target: def.id,
        type: index === 0 ? 'live' : 'alternative',
        value: 1
    }));

    return { nodes, links };
}

// // src/lib/types/graph.ts
// import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
// import type { WordNode, Definition } from './nodes';

// export interface GraphNode extends SimulationNodeDatum {
//     id: string;
//     type: 'word' | 'definition';
//     data: WordNode | Definition;
//     group: 'word' | 'live-definition' | 'alternative-definition';
// }

// export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
//     source: string;
//     target: string;
//     type: 'live' | 'alternative';
//     value: number;
// }

// export interface GraphData {
//     nodes: GraphNode[];
//     links: GraphEdge[]; 
// }

// export interface NodePosition {
//     x: number;
//     y: number;
//     scale: number;
//     ring: number;
//     ringPosition: number;
//     distanceFromCenter: number;
//     rotation: number;
//     svgTransform: string;
//     renderOrder: number;
// }

// export interface GraphLayoutConfig {
//     renderMode: 'svg';
//     viewport: {
//         width: number;
//         height: number;
//     };
//     animation: {
//         duration: number;
//         easing: string;
//     };
//     initialZoom: number;
//     minZoom: number;
//     maxZoom: number;
// }

// export function prepareGraphData(wordNode: WordNode): GraphData {
//     const nodes: GraphNode[] = [
//         {
//             id: wordNode.id,
//             type: 'word' as const,
//             data: wordNode,
//             group: 'word'
//         },
//         ...wordNode.definitions.map((def, index) => ({
//             id: def.id,
//             type: 'definition' as const,
//             data: def,
//             group: index === 0 ? 'live-definition' as const : 'alternative-definition' as const
//         }))
//     ];

//     const links: GraphEdge[] = wordNode.definitions.map((def, index) => ({
//         source: wordNode.id,
//         target: def.id,
//         type: index === 0 ? 'live' : 'alternative',
//         value: 1
//     }));

//     return { nodes, links };
// }