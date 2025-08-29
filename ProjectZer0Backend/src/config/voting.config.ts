// src/config/voting.config.ts

export type VoteKind = 'INCLUSION' | 'CONTENT';

export type NodeStatus = 'pending' | 'approved' | 'rejected';

/**
 * Voting thresholds configuration
 */
export const VOTING_THRESHOLDS = {
  // Inclusion threshold: >0 passes, 0 = pending, <0 fails
  INCLUSION_PASS_THRESHOLD: 0,

  // Optional: Different thresholds per node type if needed in future
  // WORD_INCLUSION_THRESHOLD: 0,
  // DEFINITION_INCLUSION_THRESHOLD: 0,
  // etc.
} as const;

/**
 * Node type voting rules
 */
export const NODE_VOTING_RULES = {
  WordNode: {
    hasInclusion: true,
    hasContent: false,
    inclusionUnlocks: 'definition_creation',
    contentMeaning: null,
  },
  DefinitionNode: {
    hasInclusion: true,
    hasContent: true,
    inclusionUnlocks: null,
    contentMeaning: 'definition_quality',
  },
  OpenQuestionNode: {
    hasInclusion: true,
    hasContent: false,
    inclusionUnlocks: 'answer_creation',
    contentMeaning: null,
  },
  AnswerNode: {
    hasInclusion: true,
    hasContent: true,
    inclusionUnlocks: null,
    contentMeaning: 'answer_quality',
  },
  StatementNode: {
    hasInclusion: true,
    hasContent: true,
    inclusionUnlocks: 'content_voting',
    contentMeaning: 'statement_agreement',
  },
  QuantityNode: {
    hasInclusion: true,
    hasContent: true,
    inclusionUnlocks: 'numeric_responses',
    contentMeaning: 'approach_approval',
  },
  CategoryNode: {
    hasInclusion: true,
    hasContent: false,
    inclusionUnlocks: 'categorized_children',
    contentMeaning: null,
  },
} as const;

/**
 * Helper functions for voting logic
 */
export class VotingUtils {
  /**
   * Check if a node has passed inclusion threshold
   */
  static hasPassedInclusion(inclusionNetVotes: number): boolean {
    return inclusionNetVotes > VOTING_THRESHOLDS.INCLUSION_PASS_THRESHOLD;
  }

  /**
   * Get node status based on inclusion votes
   */
  static getNodeStatus(inclusionNetVotes: number): NodeStatus {
    if (inclusionNetVotes > VOTING_THRESHOLDS.INCLUSION_PASS_THRESHOLD) {
      return 'approved';
    } else if (inclusionNetVotes < 0) {
      return 'rejected';
    } else {
      return 'pending';
    }
  }

  /**
   * Check if content voting is available for a node
   */
  static isContentVotingAvailable(
    nodeType: keyof typeof NODE_VOTING_RULES,
    inclusionNetVotes: number,
  ): boolean {
    const rules = NODE_VOTING_RULES[nodeType];
    if (!rules.hasContent) return false;

    // For Statement nodes, content voting requires passing inclusion
    if (nodeType === 'StatementNode') {
      return this.hasPassedInclusion(inclusionNetVotes);
    }

    // For all other content-voting nodes, it's always available
    return true;
  }

  // Specific gating methods for different creation/interaction types

  /**
   * Check if Definition creation is allowed for a Word
   */
  static isDefinitionCreationAllowed(wordInclusionNetVotes: number): boolean {
    return this.hasPassedInclusion(wordInclusionNetVotes);
  }

  /**
   * Check if Answer creation is allowed for an OpenQuestion
   */
  static isAnswerCreationAllowed(questionInclusionNetVotes: number): boolean {
    return this.hasPassedInclusion(questionInclusionNetVotes);
  }

  /**
   * Check if numeric responses are allowed for a Quantity node
   */
  static isNumericResponseAllowed(quantityInclusionNetVotes: number): boolean {
    return this.hasPassedInclusion(quantityInclusionNetVotes);
  }

  /**
   * Check if nodes can be categorized under a Category
   */
  static isCategorizedChildrenAllowed(
    categoryInclusionNetVotes: number,
  ): boolean {
    return this.hasPassedInclusion(categoryInclusionNetVotes);
  }

  /**
   * Check if Statement content voting is unlocked
   */
  static isStatementContentVotingUnlocked(
    statementInclusionNetVotes: number,
  ): boolean {
    return this.hasPassedInclusion(statementInclusionNetVotes);
  }
}

/**
 * Frontend display configuration
 */
export const VOTE_DISPLAY_CONFIG = {
  WordNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: null,
  },
  DefinitionNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: { positive: 'Agree', negative: 'Disagree' },
  },
  OpenQuestionNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: null,
  },
  AnswerNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: { positive: 'Agree', negative: 'Disagree' },
  },
  StatementNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: { positive: 'Agree', negative: 'Disagree' },
  },
  QuantityNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: { positive: 'Agree', negative: 'Disagree' },
  },
  CategoryNode: {
    inclusion: { positive: 'Include', negative: 'Exclude' },
    content: null,
  },
} as const;
