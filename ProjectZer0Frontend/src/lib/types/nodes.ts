// ProjectZer0Frontend/src/lib/types/nodes.ts

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