import type { SimulationNodeDatum } from 'd3';
import type { WordNode, Definition } from './nodes';

export interface GraphNode extends SimulationNodeDatum {
    id: string;
    type: 'word' | 'definition';
    data: WordNode | Definition;
    parentId?: string;
}

export interface GraphEdge {
    source: GraphNode | string;  // D3 force simulation can use either
    target: GraphNode | string;
    type: string;
}

export interface MainGraphProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface MainGraphSlotProps {
    node: GraphNode;
}

// Type guard for checking if source/target is a GraphNode
export function isGraphNode(value: GraphNode | string): value is GraphNode {
    return typeof value === 'object' && value !== null && 'id' in value;
}