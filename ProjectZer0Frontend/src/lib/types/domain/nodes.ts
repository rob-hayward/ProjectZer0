// src/lib/types/domain/nodes.ts
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
    // We don't need directlyRelatedStatements since we'll detect direct relationships
    // from the relatedStatements array based on sharedWord === 'direct'
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

// OpenQuestion Node related interfaces
export interface RelatedQuestion {
    nodeId: string;
    questionText: string;
    sharedWord: string;
    strength: number;
}

export interface AnswerStatement {
    id: string;
    statement: string;
    createdBy: string;
    createdAt: string;
    publicCredit?: boolean; // ADD THIS PROPERTY
    netVotes: number;
}

export interface OpenQuestionNode {
	answerCount: number;
    id: string;
    questionText: string;
    createdBy: string;
    publicCredit: boolean;
    initialComment?: string;
    createdAt: string;
    updatedAt: string;
    positiveVotes: number;
    negativeVotes: number;
    keywords?: Keyword[];
    relatedQuestions?: RelatedQuestion[];
    answers?: AnswerStatement[];
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

/**
 * Interface representing a Quantity Node
 */
export interface QuantityNode {
    id: string;
    question: string;
    unitCategoryId: string;
    defaultUnitId: string;
    createdBy: string;
    publicCredit: boolean;
    initialComment?: string;
    createdAt: string;
    updatedAt: string;
    responseCount?: number;
    keywords?: Keyword[];
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

/**
 * Interface representing a Comment Node
 */
export interface CommentNode {
    id: string;
    commentText: string;
    createdBy: string;
    createdAt: string | Date;
    updatedAt?: string | Date;
    parentCommentId?: string;
    positiveVotes: number;
    negativeVotes: number;
    publicCredit?: boolean;
    childComments?: CommentNode[];
    depth?: number;
    isVisible?: boolean;
    isExpanded?: boolean;
}

/**
 * Simple interface for comment form data
 */
export interface CommentFormData {
    id: string;
    parentCommentId?: string | null;
    // Add these properties to satisfy union type compatibility
    // The actual implementation won't use these, but TypeScript needs them
    sub?: string; // To satisfy UserProfile
    label?: string; // To satisfy NavigationOption
    word?: string; // To satisfy WordNode
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