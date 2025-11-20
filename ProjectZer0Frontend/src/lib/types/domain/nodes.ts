// src/lib/types/domain/nodes.ts
export interface Definition {
    id: string;
    word: string;
    definitionText: string;
    createdBy: string;
    publicCredit: boolean;
    isApiDefinition?: boolean;
    isAICreated?: boolean;
    isLiveDefinition?: boolean;  
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

export interface CategoryNode {
    id: string; // UUID
    name: string; // Auto-generated from composed words (e.g., "artificial intelligence")
    createdBy: string;
    publicCredit: boolean;
    createdAt: string;
    updatedAt: string;
    // Inclusion voting only for categories
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    // Content voting (always 0 for Category nodes)
    contentPositiveVotes?: number;
    contentNegativeVotes?: number;
    contentNetVotes?: number;
    // Category-specific properties
    wordCount?: number;
    contentCount?: number;
    childCount?: number;
    words?: Array<{ // The 1-5 words that compose this category
        id: string; // The word itself (e.g., 'artificial')
        word: string; // Same as id
        inclusionNetVotes: number;
    }>;
    parentCategory?: {
        id: string; // Parent category UUID
        name: string;
    } | null;
    childCategories?: Array<{
        id: string; // Child category UUID
        name: string;
        inclusionNetVotes: number;
    }>;
    discussionId?: string;
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

export interface Category {
    id: string;
    name: string;
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
    // Dual voting for statements
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    contentPositiveVotes: number;
    contentNegativeVotes: number;
    contentNetVotes: number;
    // Legacy properties (may be deprecated)
    positiveVotes?: number;
    negativeVotes?: number;
    // Content node properties
    keywords?: Keyword[];
    categories?: string[] | Category[]; // Category IDs (creation) or enriched objects (from API)
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
    // Content node properties
    keywords?: Keyword[];
    categories?: string[] | Category[]; // Category IDs (creation) or enriched objects (from API)
    relatedQuestions?: RelatedQuestion[];
    answers?: AnswerStatement[];
    discussionId?: string;
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

export interface AnswerNode {
    id: string;
    answerText: string;
    questionId: string; // Parent question UUID
    createdBy: string;
    publicCredit: boolean;
    initialComment?: string;
    createdAt: string;
    updatedAt: string;
    // Dual voting for answers
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    contentPositiveVotes: number;
    contentNegativeVotes: number;
    contentNetVotes: number;
    // Content node properties
    keywords?: Keyword[];
    categories?: string[] | Category[]; // Category IDs (creation) or enriched objects (from API)
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
    // Content node properties
    keywords?: Keyword[];
    categories?: Category[]; // Category objects (max 3)
    discussionId?: string;
    discussion?: {
        id: string;
        comments: Comment[];
    };
}

export interface EvidenceNode {
    id: string;
    title: string;
    url: string;
    authors?: string[]; // ADDED
    publicationDate?: Date | string; // ADDED
    description?: string; // ADDED
    evidenceType: 'peer_reviewed_study' | 'government_report' | 'news_article' | 'expert_opinion' | 'dataset' | 'video' | 'image' | 'other';
    parentNodeId: string; // Parent statement/answer/quantity UUID
    parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
    parentInfo?: { // ADDED
        id: string;
        type: string;
        title: string;
    };
    createdBy: string;
    publicCredit: boolean;
    initialComment?: string;
    createdAt: string;
    updatedAt: string;
    // Inclusion voting only for evidence (no standard content voting)
    inclusionPositiveVotes: number;
    inclusionNegativeVotes: number;
    inclusionNetVotes: number;
    contentPositiveVotes: number; // Keep for schema compatibility
    contentNegativeVotes: number; // Keep for schema compatibility
    contentNetVotes: number; // Keep for schema compatibility
    // Peer review metrics (aggregated) - ADDED
    avgQualityScore?: number;
    avgIndependenceScore?: number;
    avgRelevanceScore?: number;
    overallScore?: number;
    reviewCount?: number;
    // Content node properties
    keywords?: Keyword[];
    categories?: string[] | Category[]; // Category IDs (creation) or enriched objects (from API)
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