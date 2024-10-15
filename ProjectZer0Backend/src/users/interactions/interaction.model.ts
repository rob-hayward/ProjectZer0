export interface CreatedInteraction {
  type: string;
  timestamp: string;
}

export interface VotedInteraction {
  type: string;
  value: number;
  timestamp: string;
}

export interface CommentedInteraction {
  type: string;
  commentIds: string[];
  lastCommentTimestamp: string;
}

export interface VisibilityPreference {
  isVisible: boolean;
}

export interface UserInteractions {
  created?: Record<string, CreatedInteraction>;
  voted?: Record<string, VotedInteraction>;
  commented?: Record<string, CommentedInteraction>;
  visibilityPreferences?: Record<string, VisibilityPreference>;
}
