// src/config/voting.config.ts - UPDATED TO INCLUDE CommentNode

export type VoteKind = 'INCLUSION' | 'CONTENT';

export const NODE_VOTING_RULES = {
  WordNode: { hasInclusion: true, hasContent: false },
  DefinitionNode: { hasInclusion: true, hasContent: true },
  CategoryNode: { hasInclusion: true, hasContent: false },
  StatementNode: { hasInclusion: true, hasContent: true },
  AnswerNode: { hasInclusion: true, hasContent: true },
  QuantityNode: { hasInclusion: true, hasContent: false },
  OpenQuestionNode: { hasInclusion: true, hasContent: false },
  CommentNode: { hasInclusion: false, hasContent: true },
  // DiscussionNode: NOT INCLUDED (discussions don't support voting, they are just a container for comments)
} as const;

export const VotingUtils = {
  hasPassedInclusion: (netVotes: number): boolean => netVotes > 0,

  isDefinitionCreationAllowed: (wordInclusionNetVotes: number): boolean =>
    wordInclusionNetVotes > 0,

  isContentVisible: (contentNetVotes: number): boolean => contentNetVotes >= -5, // Hide heavily downvoted content

  // ✅ NEW: Comment-specific utility
  isCommentVisible: (contentNetVotes: number): boolean => contentNetVotes >= -3, // Hide heavily downvoted comments (stricter threshold)

  getVotingThresholds: () => ({
    inclusion: {
      hide: -10,
      neutral: 0,
      promoted: 5,
    },
    content: {
      hide: -5,
      neutral: 0,
      quality: 3,
    },
    comment: {
      hide: -3, // ✅ NEW: Comment-specific threshold
      neutral: 0,
      helpful: 2,
    },
  }),
};

export type NodeVotingRules = typeof NODE_VOTING_RULES;
export type VotableNodeType = keyof NodeVotingRules;
