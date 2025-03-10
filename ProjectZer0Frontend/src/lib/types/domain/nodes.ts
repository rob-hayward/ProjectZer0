// ProjectZer0Frontend/src/lib/types/domain/nodes.ts
export interface Definition {
    id: string;
    definitionText: string;  // Changed from text to definitionText
    createdBy: string;
    createdAt: string;
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

// Statement Node related interfaces
export interface Keyword {
    word: string;
    frequency: number;
    source: 'user' | 'ai';
}

export interface RelatedStatement {
    nodeId: string;
    statement: string;
    sharedWord: string;
    strength: number;
}

export interface StatementNode {
    id: string;
    statement: string;
    createdBy: string;
    publicCredit: boolean;
    initialComment?: string;
    createdAt: string;
    updatedAt: string;
    positiveVotes: number;
    negativeVotes: number;
    keywords?: Keyword[];
    relatedStatements?: RelatedStatement[];
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

// Common types
export type VoteStatus = 'agree' | 'disagree' | 'none';

// Style types for node rendering
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