// src/lib/types/nodes.ts

// Base node types
export type NodeMode = 'preview' | 'zoomed';
export type NodeType = 'word' | 'definition' | 'belief';

// src/lib/types/nodes.ts
export interface NodeStyle {
  previewSize: number;
  zoomedSize: number;
  colors: {
      background: string;
      border: string;
      text: string;
      hover: string;
  };
  padding: {
      preview: number;
      zoomed: number;
  };
  lineHeight: {
      preview: number;
      zoomed: number;
  };
}

// Node type-specific sizes
export const NODE_SIZES = {
    WORD: {
        PREVIEW: 200,  // Smaller for single word
        ZOOMED: 600
    },
    DEFINITION: {
        PREVIEW: 360,  // Larger for definition text
        ZOOMED: 600
    },
    BELIEF: {
        PREVIEW: 300,
        ZOOMED: 600
    }
} as const;

// Existing types
export interface Definition {
    id: string;
    text: string;
    createdBy: string;
    createdAt: string;
    votes: number;
}

export interface Comment {
    id: string;
    commentText: string;
    createdBy: string;
    createdAt: string;
}

export interface Discussion {
    id: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    visibilityStatus: boolean;
    comments: Comment[];
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
    discussion?: Discussion;
}