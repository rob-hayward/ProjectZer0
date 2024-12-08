// src/lib/types/graph.ts
import type { Definition } from './nodes';

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

export interface WordNode {
    id: string;
    word: string;
    createdBy: string;
    publicCredit: boolean;
    createdAt: string;
    updatedAt: string;
    positiveVotes: number;
    negativeVotes: number;
    definitions: Definition[];
    discussion?: {
        id: string;
        comments: Comment[];
    };
}