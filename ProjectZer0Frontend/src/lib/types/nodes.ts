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
    comments: Comment[];
  }
  
  export interface WordNode {
    id: string;
    word: string;
    createdBy: string;
    publicCredit: boolean;
    createdAt: string;
    updatedAt: string;
    definitions: Definition[];
    discussion?: Discussion;
  }