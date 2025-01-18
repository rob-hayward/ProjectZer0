// src/lib/types/nodes.ts
export interface Definition {
    id: string;
    text: string;
    createdBy: string;
    createdAt: string;
    votes?: number; // Keep for backwards compatibility
    positiveVotes: number;
    negativeVotes: number;
    isLive?: boolean;
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

export type NodeMode = 'preview' | 'detail';
export type NodeType = 'word' | 'definition' | 'belief';
export type VoteStatus = 'agree' | 'disagree' | 'none';

export interface NodeStyle {
    previewSize: number;
    detailSize: number;
    colors: {
        background: string;
        border: string;
        text: string;
        hover: string;
        gradient?: {
            start: string;
            end: string;
        };
    };
    padding: {
        preview: number;
        detail: number;
    };
    lineHeight: {
        preview: number;
        detail: number;
    };
    stroke: {
        preview: {
            normal: number;
            hover: number;
        };
        detail: {
            normal: number;
            hover: number;
        };
    };
    highlightColor?: string; 
}
