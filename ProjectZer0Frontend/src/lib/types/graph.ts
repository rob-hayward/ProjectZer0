// src/lib/types/graph.ts
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { WordNode, Definition } from './nodes';

export interface GraphNode extends SimulationNodeDatum {
    id: string;
    type: 'word' | 'definition';
    data: WordNode | Definition;
    group: 'word' | 'live-definition' | 'alternative-definition';
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
    source: string;
    target: string;
    type: 'live' | 'alternative';
    value: number;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphEdge[]; 
}

export interface NodePosition {
    x: number;
    y: number;
    scale: number;
    ring: number;
    ringPosition: number;
    distanceFromCenter: number;
    rotation: number;
    svgTransform: string;
    renderOrder: number;
}

export interface GraphLayoutConfig {
    renderMode: 'svg';
    viewport: {
        width: number;
        height: number;
    };
    animation: {
        duration: number;
        easing: string;
    };
    initialZoom: number;
    minZoom: number;
    maxZoom: number;
}

export function prepareGraphData(wordNode: WordNode): GraphData {
    const nodes: GraphNode[] = [
        {
            id: wordNode.id,
            type: 'word' as const,
            data: wordNode,
            group: 'word'
        },
        ...wordNode.definitions.map((def, index) => ({
            id: def.id,
            type: 'definition' as const,
            data: def,
            group: index === 0 ? 'live-definition' as const : 'alternative-definition' as const
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