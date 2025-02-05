// src/lib/types/graph/core.ts
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { UserProfile } from '../user';
import type { NavigationOption } from '../navigation';
import type { Definition } from '../nodes';
import type { WordNode as WordNodeData } from '../nodes';

// View and group types
export type ViewType = 'dashboard' | 'edit-profile' | 'create-node' | 'word' | 'statement' | 'network';
export type NodeType = 'dashboard' | 'edit-profile' | 'create-node' | 'navigation' | 'word' | 'definition';
export type NodeGroup = 'central' | 'navigation' | 'word' | 'live-definition' | 'alternative-definition';
export type EdgeType = 'live' | 'alternative';

// Page data interface
export interface GraphPageData {
    view: ViewType;
    viewType: ViewType;
    wordData: WordNodeData | null;
    nodes?: GraphNode[];
    links?: GraphEdge[];
}

// Layout configuration
export interface LayoutConfig {
    centerNode: boolean;
    navigationRadius: {
        preview: number;
        detail: number;
    };
    forceConfig: Record<string, any>;
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

// Core node interface
export interface GraphNode extends SimulationNodeDatum {
    id: string;
    type: NodeType;
    data: UserProfile | NavigationOption | WordNodeData | Definition;
    group: NodeGroup;
}

// Core edge interface
export interface GraphEdge {
    source: string | GraphNode;
    target: string | GraphNode;
    type: EdgeType;
    value: number;
}

// Main graph data structure
export interface GraphData {
    nodes: GraphNode[];
    links: GraphEdge[];
}

// Type guards
export const isDashboardNode = (node: GraphNode): node is GraphNode & {
    type: 'dashboard';
    data: UserProfile;
} => node.type === 'dashboard';

export const isEditProfileNode = (node: GraphNode): node is GraphNode & {
    type: 'edit-profile';
    data: UserProfile;
} => node.type === 'edit-profile';

export const isCreateNodeNode = (node: GraphNode): node is GraphNode & {
    type: 'create-node';
    data: UserProfile;
} => node.type === 'create-node';

export const isNavigationNode = (node: GraphNode): node is GraphNode & {
    type: 'navigation';
    data: NavigationOption;
} => node.type === 'navigation';

export const isWordNode = (node: GraphNode): node is GraphNode & {
    type: 'word';
    data: WordNodeData;
} => node.type === 'word';

export const isDefinitionNode = (node: GraphNode): node is GraphNode & {
    type: 'definition';
    data: Definition;
} => node.type === 'definition';

export const isLiveDefinitionNode = (node: GraphNode): boolean => 
    node.type === 'definition' && node.group === 'live-definition';

export const isAlternativeDefinitionNode = (node: GraphNode): boolean => 
    node.type === 'definition' && node.group === 'alternative-definition';

export const isGraphNodeReference = (value: string | GraphNode): value is GraphNode => 
    typeof value === 'object' && value !== null && 'id' in value;

export const isLiveEdge = (edge: GraphEdge): boolean => edge.type === 'live';
export const isAlternativeEdge = (edge: GraphEdge): boolean => edge.type === 'alternative';

// Data preparation utility
export function prepareGraphData(wordNode: WordNodeData): GraphData {
    const nodes: GraphNode[] = [
        {
            id: wordNode.id,
            type: 'word',
            data: wordNode,
            group: 'word'
        },
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