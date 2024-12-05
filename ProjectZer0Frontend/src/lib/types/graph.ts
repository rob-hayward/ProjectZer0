import type { WordNode, Definition } from './nodes';

export interface GraphNode {
    id: string;
    type: 'word' | 'definition';
    data: WordNode | Definition;
    parentId?: string;
}

export interface GraphEdge {
    source: string;
    target: string;
    type: string;
}

export interface MainGraphProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface MainGraphSlotProps {
    node: GraphNode;
}