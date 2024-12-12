// src/lib/types/graph.ts
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { WordNode, Definition } from './nodes';

export interface GraphNode extends SimulationNodeDatum {
    id: string;
    type: 'word' | 'definition';
    data: WordNode | Definition;
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
    type: string;
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

export interface LayoutState {
    zoom: number;
    panX: number;
    panY: number;
    isTransitioning: boolean;
}

export interface MainGraphProps {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface MainGraphSlotProps {
    node: GraphNode;
}