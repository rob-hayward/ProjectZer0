// src/lib/types/graph/edges.ts
import type { GraphNode } from './core';

export type EdgeType = 'live' | 'alternative' | 'wordDefinition';

export interface BaseEdge {
    source: string | GraphNode;
    target: string | GraphNode;
    type: EdgeType;
    value: number;
}

export interface WordDefinitionEdge extends BaseEdge {
    type: 'wordDefinition';
}