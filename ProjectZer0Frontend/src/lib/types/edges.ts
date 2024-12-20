// src/lib/types/edges.ts
export type EdgeType = 'wordDefinition';

export interface BaseEdge {
    type: EdgeType;
    value: number;
}

export interface WordDefinitionEdge extends BaseEdge {
    type: 'wordDefinition';
}