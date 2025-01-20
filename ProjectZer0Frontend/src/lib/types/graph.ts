import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { UserProfile } from './user';
import type { NavigationOption } from './navigation';
import type { Definition } from './nodes';
import type { WordNode as WordNodeData } from './nodes';  

// View types and configurations
export type ViewType = 'dashboard' | 'edit-profile' | 'create-node' | 'word' | 'statement' | 'network';

export interface LayoutConfig {
  centerNode: boolean;
  navigationRadius: {
    preview: number;
    detail: number;
  };
  forceConfig: Record<string, any>;
}

// Node types and groups (maintaining existing types)
export type NodeType = 'dashboard' | 'edit-profile' | 'create-node' | 'navigation' | 'word' | 'definition';
export type NodeGroup = 'central' | 'navigation' | 'word' | 'live-definition' | 'alternative-definition';
export type EdgeType = 'live' | 'alternative';

// Graph page data interface
export interface GraphPageData {
    view: string;
    wordData: WordNodeData | null;
}

// Position interface for rendering
export interface NodePosition {
    x: number;
    y: number;
    scale: number;
    svgTransform: string;
    angle?: number;
    distanceFromCenter?: number;
    renderOrder?: number;
}

// In graph.ts, update the GraphNode interface:
export interface GraphNode extends SimulationNodeDatum {
    id: string;
    type: NodeType;
    data: UserProfile | NavigationOption | WordNodeData | Definition;
    group: NodeGroup;
    // D3 force simulation properties from SimulationNodeDatum
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    index?: number;
}

// Edge interfaces
export interface GraphEdge {
    source: string | GraphNode;
    target: string | GraphNode;
    type: EdgeType;
    value: number;
}

// Simulation-specific edge interface
export type SimulationLink = Omit<SimulationLinkDatum<GraphNode>, 'source' | 'target'> & {
    source: string | GraphNode;
    target: string | GraphNode;
    type: EdgeType;
    value: number;
    distance?: number;
    strength?: number;
};

// Main graph data interface
export interface GraphData {
    nodes: GraphNode[];
    links?: GraphEdge[];
}

// Type guards for nodes (maintaining existing guards)
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

export function isLiveDefinitionNode(node: GraphNode): boolean {
    return node.type === 'definition' && node.group === 'live-definition';
}

export function isAlternativeDefinitionNode(node: GraphNode): boolean {
    return node.type === 'definition' && node.group === 'alternative-definition';
}

// Type guards for edges
export function isGraphNodeReference(value: string | GraphNode): value is GraphNode {
    return typeof value === 'object' && value !== null && 'id' in value;
}

export function isLiveEdge(edge: GraphEdge): boolean {
    return edge.type === 'live';
}

export function isAlternativeEdge(edge: GraphEdge): boolean {
    return edge.type === 'alternative';
}

// Data preparation utility
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