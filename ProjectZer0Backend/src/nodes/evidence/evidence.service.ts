// src/nodes/evidence/evidence.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EvidenceSchema } from '../../neo4j/schemas/evidence.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { CategoryService } from '../category/category.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import type {
  EvidenceData,
  EvidenceType,
  EvidencePeerReview,
} from '../../neo4j/schemas/evidence.schema';

/**
 * EvidenceService - Business logic for evidence node operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to EvidenceSchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates evidence creation + keyword extraction + word creation + discussion
 * - Handles business validation beyond schema rules
 *
 * KEY CHARACTERISTICS:
 * - Uses 'id' as ID field (standard)
 * - Discussion creation uses nodeIdField: 'id'
 * - Inclusion voting ONLY (no content voting - uses peer review instead)
 * - AI keyword extraction (like Statement/OpenQuestion/Answer/Quantity)
 * - Auto-creates missing word nodes
 * - 0-3 categories
 * - Requires parent node (Statement, Answer, or Quantity)
 * - 3D peer review system (quality, independence, relevance)
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (evidence + discussion + keywords + categories)
 * ✅ Business validation (text limits, category count, URL validation)
 * ✅ Keyword extraction and word creation
 * ✅ Peer review management
 * ✅ Parent node validation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's EvidenceSchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's EvidenceController)
 */

// ============================================
// INTERFACES
// ============================================

interface CreateEvidenceData {
  title: string;
  url: string;
  authors?: string[];
  publicationDate?: Date;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateEvidenceData {
  title?: string;
  url?: string;
  authors?: string[];
  publicationDate?: Date;
  description?: string;
  publicCredit?: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
}

interface SubmitPeerReviewData {
  evidenceId: string;
  userId: string;
  qualityScore: number;
  independenceScore: number;
  relevanceScore: number;
  comments?: string;
}

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly evidenceSchema: EvidenceSchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
    private readonly categoryService: CategoryService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new evidence node with optional discussion
   * Orchestrates: validation + keyword extraction + word creation + evidence creation + discussion creation
   */
  async createEvidence(
    evidenceData: CreateEvidenceData,
  ): Promise<EvidenceData> {
    this.validateCreateEvidenceData(evidenceData);

    const evidenceId = uuidv4();
    this.logger.log(
      `Creating evidence node: ${evidenceData.title.substring(0, 50)}...`,
    );

    try {
      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (evidenceData.userKeywords && evidenceData.userKeywords.length > 0) {
        keywords = evidenceData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
        this.logger.debug(`Using ${keywords.length} user-provided keywords`);
      } else {
        try {
          const textToAnalyze = [
            evidenceData.title,
            evidenceData.description || '',
            evidenceData.authors?.join(', ') || '',
          ]
            .filter((t) => t)
            .join(' ');

          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: textToAnalyze,
            });
          keywords = extractionResult.keywords;
          this.logger.debug(`Extracted ${keywords.length} AI keywords`);
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed for evidence: ${error.message}`,
          );
          keywords = [];
        }
      }

      // Create missing word nodes
      if (keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, evidenceData);
      }

      // Validate categories
      if (evidenceData.categoryIds && evidenceData.categoryIds.length > 0) {
        await this.validateCategories(evidenceData.categoryIds);
      }

      // Create evidence node
      const evidence = await this.evidenceSchema.createEvidence({
        id: evidenceId,
        ...evidenceData,
        keywords,
      });

      // Track user creation
      try {
        await this.userSchema.addCreatedNode(
          evidenceData.createdBy,
          evidenceId,
          'evidence',
        );
      } catch (error) {
        this.logger.warn(
          `Failed to track evidence creation in UserSchema: ${error.message}`,
        );
      }

      // Create discussion if initial comment provided
      if (evidenceData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: evidenceId,
            nodeType: 'EvidenceNode',
            nodeIdField: 'id', // Standard ID field
            createdBy: evidenceData.createdBy,
            initialComment: evidenceData.initialComment,
          });
          this.logger.debug(`Created discussion for evidence: ${evidenceId}`);
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for evidence: ${error.message}`,
          );
          // Continue - don't fail creation if discussion fails
        }
      }

      this.logger.log(`Successfully created evidence: ${evidence.id}`);
      return evidence;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create evidence: ${error.message}`,
      );
    }
  }

  /**
   * Get an evidence node by ID
   * Direct delegation to schema with error handling
   */
  async getEvidence(id: string): Promise<EvidenceData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Getting evidence: ${id}`);

    try {
      const evidence = await this.evidenceSchema.getEvidence(id);

      if (!evidence) {
        throw new NotFoundException(`Evidence with ID ${id} not found`);
      }

      return evidence;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get evidence: ${error.message}`,
      );
    }
  }

  /**
   * Update an evidence node with optional keyword re-extraction
   * Orchestrates: validation + optional keyword re-extraction + word creation + update
   */
  async updateEvidence(
    id: string,
    updateData: UpdateEvidenceData,
  ): Promise<EvidenceData> {
    this.validateUpdateEvidenceData(updateData);

    this.logger.debug(`Updating evidence: ${id}`);

    try {
      // Get original evidence for context
      const originalEvidence = await this.getEvidence(id);

      // Handle keyword updates
      let keywords: KeywordWithFrequency[] | undefined;

      if (updateData.userKeywords) {
        // User provided new keywords
        keywords = updateData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else if (
        updateData.title ||
        updateData.description ||
        updateData.authors
      ) {
        // Re-extract keywords if text changed
        try {
          const textToAnalyze = [
            updateData.title || originalEvidence.title,
            updateData.description || originalEvidence.description || '',
            (updateData.authors || originalEvidence.authors)?.join(', ') || '',
          ]
            .filter((t) => t)
            .join(' ');

          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: textToAnalyze,
            });
          keywords = extractionResult.keywords;
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed during update: ${error.message}`,
          );
          keywords = [];
        }
      }

      // Create missing word nodes if we have keywords
      if (keywords && keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, {
          ...originalEvidence,
          ...updateData,
        });
        (updateData as any).keywords = keywords;
      }

      // Validate categories if provided
      if (updateData.categoryIds !== undefined) {
        if (updateData.categoryIds.length > 0) {
          await this.validateCategories(updateData.categoryIds);
        }
      }

      // Update via schema
      const updatedEvidence = await this.evidenceSchema.updateEvidence(
        id,
        updateData,
      );

      if (!updatedEvidence) {
        throw new NotFoundException(`Evidence with ID ${id} not found`);
      }

      this.logger.debug(`Successfully updated evidence: ${id}`);
      return updatedEvidence;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update evidence: ${error.message}`,
      );
    }
  }

  /**
   * Delete an evidence node
   * Direct delegation to schema
   */
  async deleteEvidence(id: string, userId: string): Promise<void> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Deleting evidence: ${id}`);

    try {
      // Verify evidence exists and user is creator
      const evidence = await this.getEvidence(id);

      if (evidence.createdBy !== userId) {
        throw new BadRequestException(
          'Only the creator can delete this evidence',
        );
      }

      await this.evidenceSchema.delete(id);
      this.logger.debug(`Deleted evidence: ${id}`);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete evidence: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - INCLUSION ONLY
  // ============================================

  /**
   * Vote on evidence inclusion
   * Delegates to schema after validation
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting ${isPositive ? 'positive' : 'negative'} on evidence inclusion: ${id}`,
    );

    try {
      const result = await this.evidenceSchema.voteInclusion(
        id,
        userId,
        isPositive,
      );
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error voting on evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on evidence: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on an evidence node
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for evidence: ${id}, user: ${userId}`,
    );

    try {
      const status = await this.evidenceSchema.getVoteStatus(id, userId);
      return status;
    } catch (error) {
      this.logger.error(
        `Error getting vote status: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove a user's vote on an evidence node
   */
  async removeVote(id: string, userId: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing vote on evidence: ${id} by user: ${userId}`);

    try {
      const result = await this.evidenceSchema.removeVote(
        id,
        userId,
        'INCLUSION',
      );
      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing vote: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote totals for an evidence node
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Getting votes for evidence: ${id}`);

    try {
      const votes = await this.evidenceSchema.getVotes(id);
      this.logger.debug(`Votes for evidence ${id}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // PEER REVIEW OPERATIONS
  // ============================================

  /**
   * Submit a peer review for evidence
   * Reviews only allowed after inclusion threshold passed
   */
  async submitPeerReview(
    reviewData: SubmitPeerReviewData,
  ): Promise<EvidencePeerReview> {
    this.validatePeerReviewData(reviewData);

    this.logger.log(
      `Submitting peer review for evidence ${reviewData.evidenceId}`,
    );

    try {
      const review = await this.evidenceSchema.submitPeerReview(reviewData);

      this.logger.log(`Successfully submitted peer review: ${review.id}`);
      return review;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error submitting peer review: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to submit peer review: ${error.message}`,
      );
    }
  }

  /**
   * Get peer review statistics for evidence
   */
  async getPeerReviewStats(evidenceId: string) {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Getting peer review stats for: ${evidenceId}`);

    try {
      return await this.evidenceSchema.getPeerReviewStats(evidenceId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting peer review stats: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get peer review stats: ${error.message}`,
      );
    }
  }

  /**
   * Get a user's peer review for specific evidence
   */
  async getUserPeerReview(
    evidenceId: string,
    userId: string,
  ): Promise<EvidencePeerReview | null> {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting peer review for evidence: ${evidenceId}, user: ${userId}`,
    );

    try {
      return await this.evidenceSchema.getUserPeerReview(evidenceId, userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting user peer review: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get user peer review: ${error.message}`,
      );
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if an evidence node has passed inclusion threshold
   */
  async isEvidenceApproved(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    try {
      const votes = await this.evidenceSchema.getVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking evidence approval: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Check if peer review is allowed for evidence
   */
  async isPeerReviewAllowed(evidenceId: string): Promise<boolean> {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    try {
      return await this.evidenceSchema.isPeerReviewAllowed(evidenceId);
    } catch (error) {
      this.logger.error(
        `Error checking peer review availability: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Get evidence for a specific parent node
   */
  async getEvidenceForNode(
    parentNodeId: string,
    parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode',
  ): Promise<EvidenceData[]> {
    if (!parentNodeId || parentNodeId.trim() === '') {
      throw new BadRequestException('Parent node ID is required');
    }

    this.logger.debug(
      `Getting evidence for ${parentNodeType}: ${parentNodeId}`,
    );

    try {
      return await this.evidenceSchema.getEvidenceForNode(
        parentNodeId,
        parentNodeType,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting evidence for node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get evidence for node: ${error.message}`,
      );
    }
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  /**
   * Validate evidence creation data
   */
  private validateCreateEvidenceData(data: CreateEvidenceData): void {
    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (!data.title || data.title.trim() === '') {
      throw new BadRequestException('Evidence title cannot be empty');
    }

    if (!data.url || data.url.trim() === '') {
      throw new BadRequestException('Evidence URL cannot be empty');
    }

    // Validate URL format
    try {
      new URL(data.url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (!data.parentNodeId || data.parentNodeId.trim() === '') {
      throw new BadRequestException('Parent node ID is required');
    }

    if (!data.parentNodeType) {
      throw new BadRequestException('Parent node type is required');
    }

    const validParentTypes = ['StatementNode', 'AnswerNode', 'QuantityNode'];
    if (!validParentTypes.includes(data.parentNodeType)) {
      throw new BadRequestException('Invalid parent node type');
    }

    if (!data.evidenceType) {
      throw new BadRequestException('Evidence type is required');
    }

    if (typeof data.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean');
    }

    if (data.categoryIds && data.categoryIds.length > 3) {
      throw new BadRequestException('Evidence can have maximum 3 categories');
    }
  }

  /**
   * Validate evidence update data
   */
  private validateUpdateEvidenceData(data: UpdateEvidenceData): void {
    if (data.url) {
      try {
        new URL(data.url);
      } catch {
        throw new BadRequestException('Invalid URL format');
      }
    }

    if (data.categoryIds && data.categoryIds.length > 3) {
      throw new BadRequestException('Evidence can have maximum 3 categories');
    }
  }

  /**
   * Validate peer review data
   */
  private validatePeerReviewData(data: SubmitPeerReviewData): void {
    if (!data.evidenceId || data.evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!data.userId || data.userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (
      typeof data.qualityScore !== 'number' ||
      data.qualityScore < 1 ||
      data.qualityScore > 5
    ) {
      throw new BadRequestException('Quality score must be between 1 and 5');
    }

    if (
      typeof data.independenceScore !== 'number' ||
      data.independenceScore < 1 ||
      data.independenceScore > 5
    ) {
      throw new BadRequestException(
        'Independence score must be between 1 and 5',
      );
    }

    if (
      typeof data.relevanceScore !== 'number' ||
      data.relevanceScore < 1 ||
      data.relevanceScore > 5
    ) {
      throw new BadRequestException('Relevance score must be between 1 and 5');
    }
  }

  /**
   * Process keywords and create missing word nodes
   */
  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    context: { createdBy: string; publicCredit: boolean },
  ): Promise<void> {
    for (const keyword of keywords) {
      try {
        const wordExists = await this.wordService.checkWordExistence(
          keyword.word,
        );
        if (!wordExists) {
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: context.createdBy,
            publicCredit: context.publicCredit,
          });
          this.logger.debug(`Created missing word: ${keyword.word}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create word '${keyword.word}': ${error.message}`,
        );
        // Continue - don't fail creation if word creation fails
      }
    }
  }

  /**
   * Validate categories exist and are approved for use
   */
  private async validateCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;

    const validationPromises = categoryIds.map(async (categoryId) => {
      try {
        const category = await this.categoryService.getCategory(categoryId);
        if (!category) {
          throw new BadRequestException(
            `Category ${categoryId} does not exist`,
          );
        }
        if (category.inclusionNetVotes <= 0) {
          throw new BadRequestException(
            `Category ${categoryId} must have passed inclusion threshold`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Category ${categoryId} does not exist or is not accessible`,
        );
      }
    });

    await Promise.all(validationPromises);
  }
}
