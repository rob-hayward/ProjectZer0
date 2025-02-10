// src/lib/types/graph/link.ts
import type { GraphNode } from './core';

export type LinkType = 'live' | 'alternative' | 'wordDefinition';

export interface BaseLink {
    source: string | GraphNode;
    target: string | GraphNode;
    type: LinkType;
    value: number;
}

export interface WordDefinitionLink extends BaseLink {
    type: 'wordDefinition';
}