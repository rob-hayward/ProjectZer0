// src/lib/constants/voting.ts

/**
 * Voting Constants
 * 
 * These constants define the behavior of the two-tier voting system.
 * 
 * IMPORTANT: These values should match the backend voting constants.
 * Backend location: [path to backend voting constants]
 */

export const VOTING_CONSTANTS = {
  /**
   * INCLUSION VOTING (Primary - "Should this exist?")
   * 
   * Determines when a node can be expanded to detail mode.
   * Nodes with inclusionNetVotes <= DETAIL_MODE_THRESHOLD remain locked in preview mode.
   */
  INCLUSION: {
    /**
     * Minimum net votes required to unlock detail mode
     * 
     * - If netVotes > DETAIL_MODE_THRESHOLD: Node can be expanded (or shown in detail by default)
     * - If netVotes <= DETAIL_MODE_THRESHOLD: Node locked in preview mode
     * 
     * Default: 0 (node needs positive net votes)
     * Backend equivalent: INCLUSION_THRESHOLD or similar
     */
    DETAIL_MODE_THRESHOLD: 0,
    
    /**
     * Vote weight for inclusion votes
     * (For future use if we implement weighted voting)
     */
    VOTE_WEIGHT: 1,
  },

  /**
   * CONTENT VOTING (Secondary - "Do you agree with this content?")
   * 
   * Quality assessment voting for specific node types.
   * Only applicable to: Statement, Answer, Quantity, Evidence
   */
  CONTENT: {
    /**
     * Vote weight for content votes
     * (For future use if we implement weighted voting)
     */
    VOTE_WEIGHT: 1,
    
    /**
     * Threshold for "controversial" content indicator
     * (For future use - shows when content has high engagement but mixed votes)
     */
    CONTROVERSIAL_THRESHOLD: {
      MIN_TOTAL_VOTES: 10,
      MAX_AGREEMENT_RATIO: 0.65, // Below 65% agreement = controversial
    },
  },

  /**
   * VOTE RATE LIMITING
   * 
   * Client-side rate limiting to prevent spam
   * (Backend should have its own rate limiting)
   */
  RATE_LIMIT: {
    /**
     * Minimum time between votes on the same node (milliseconds)
     */
    MIN_VOTE_INTERVAL_MS: 500,
    
    /**
     * Maximum votes per minute across all nodes
     */
    MAX_VOTES_PER_MINUTE: 30,
  },

  /**
   * UI FEEDBACK
   * 
   * Timing for vote success animations and feedback
   */
  UI: {
    /**
     * Duration of vote success animation (milliseconds)
     */
    SUCCESS_ANIMATION_DURATION: 800,
    
    /**
     * Delay before hiding vote success indicator (milliseconds)
     */
    SUCCESS_INDICATOR_DELAY: 1500,
    
    /**
     * Duration of optimistic UI update before API confirmation (milliseconds)
     */
    OPTIMISTIC_UPDATE_TIMEOUT: 3000,
  },
} as const;

/**
 * Type-safe access to voting constants
 */
export type VotingConstants = typeof VOTING_CONSTANTS;

/**
 * Helper function: Check if node has met inclusion threshold
 */
export function hasMetInclusionThreshold(netVotes: number): boolean {
  return netVotes > VOTING_CONSTANTS.INCLUSION.DETAIL_MODE_THRESHOLD;
}

/**
 * Helper function: Check if content is controversial
 */
export function isContentControversial(
  positiveVotes: number, 
  negativeVotes: number
): boolean {
  const totalVotes = positiveVotes + negativeVotes;
  if (totalVotes < VOTING_CONSTANTS.CONTENT.CONTROVERSIAL_THRESHOLD.MIN_TOTAL_VOTES) {
    return false;
  }
  
  const agreementRatio = positiveVotes / totalVotes;
  return agreementRatio < VOTING_CONSTANTS.CONTENT.CONTROVERSIAL_THRESHOLD.MAX_AGREEMENT_RATIO &&
         agreementRatio > (1 - VOTING_CONSTANTS.CONTENT.CONTROVERSIAL_THRESHOLD.MAX_AGREEMENT_RATIO);
}