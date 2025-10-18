// src/lib/types/domain/nodes.ts
export interface Definition {
    id: string;
    word: string;
    definitionText: string;
    createdBy: string;
    publicCredit: boolean;
    isApiDefinition?: boolean;
    isAICreated?: boolean;
    discussionId?: string;
    createdAt: string;
    updatedAt: string;
    
    // BOTH inclusion and content voting
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    contentPositiveVotes: number;
    contentNegativeVotes: number;
    contentNetVotes: number;
}

export interface WordNode {
    id: string;
    word: string;
    createdBy: string;
    publicCredit: boolean;
    discussionId?: string;
    createdAt: string;
    updatedAt: string;
    // Inclusion voting properties (Word nodes have inclusion voting only)
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    // Content voting (always 0 for Word nodes)
    contentPositiveVotes: number;
    contentNegativeVotes: number;
    contentNetVotes: number;
    // Optional properties
    categories?: string[]; // Categories this word appears in
    definitions?: Definition[];
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

export interface Keyword {
    word: string;
    frequency?: number;
    source: 'user' | 'ai' | 'both';
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
    // Content voting for statements
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    contentPositiveVotes: number;
    contentNegativeVotes: number;
    contentNetVotes: number;
    // Legacy properties (may be deprecated)
    positiveVotes?: number;
    negativeVotes?: number;
    keywords?: Keyword[];
    relatedStatements?: RelatedStatement[];
    discussionId?: string;
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

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
    publicCredit?: boolean;
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
    // Inclusion voting only for questions
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    // Legacy properties
    positiveVotes?: number;
    negativeVotes?: number;
    keywords?: Keyword[];
    relatedQuestions?: RelatedQuestion[];
    answers?: AnswerStatement[];
    discussionId?: string;
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

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
    // Dual voting for quantity
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    contentPositiveVotes: number;
    contentNegativeVotes: number;
    contentNetVotes: number;
    responseCount?: number;
    keywords?: Keyword[];
    discussionId?: string;
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

export interface CommentNode {
    id: string;
    commentText: string;
    createdBy: string;
    createdAt: string | Date;
    updatedAt?: string | Date;
    parentCommentId?: string;
    // Inclusion voting only for comments
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    // Legacy properties
    positiveVotes?: number;
    negativeVotes?: number;
    publicCredit?: boolean;
    childComments?: CommentNode[];
    depth?: number;
    isVisible?: boolean;
    isExpanded?: boolean;
}

export interface CommentFormData {
    id: string;
    parentCommentId?: string | null;
    sub?: string;
    label?: string;
    word?: string;
}

// Common types
// VoteStatus is used for BOTH inclusion and content voting
// The component labels differ ('Include'/'Exclude' vs 'Agree'/'Disagree')
// but the underlying type is the same
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