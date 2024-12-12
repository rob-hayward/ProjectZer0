// src/lib/types/nodes.ts
export interface Definition {
    id: string;
    text: string;
    createdBy: string;
    createdAt: string;
    votes: number;
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

export type NodeMode = 'preview' | 'zoomed';
export type NodeType = 'word' | 'definition' | 'belief';

export interface NodeStyle {
    previewSize: number;
    zoomedSize: number;
    colors: {
        background: string;
        border: string;
        text: string;
        hover: string;
        gradient?: {
            start: string;
            end: string;
        }
    };
    padding: {
        preview: number;
        zoomed: number;
    };
    lineHeight: {
        preview: number;
        zoomed: number;
    };
    svg?: {
        filters?: {
            blur?: string;
            glow?: string;
        };
        animation?: {
            duration: string;
            easing: string;
        };
        transform?: {
            translate?: { x: number; y: number };
            scale?: number;
            rotate?: number;
        };
    };
}