// src/nodes/quantity/quantity.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  QuantitySchema,
  QuantityNodeStats,
} from '../../neo4j/schemas/quantity.schema';
import { CategoryService } from '../category/category.service'; // NEW: Added CategoryService
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UnitService } from '../../units/unit.service';
import { v4 as uuidv4 } from 'uuid';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

// Constants
const TEXT_LIMITS = {
  MAX_QUESTION_LENGTH: 1000,
};

// Interface definitions
interface CreateQuantityNodeData {
  createdBy: string;
  publicCredit: boolean;
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateQuantityNodeData {
  question?: string;
  unitCategoryId?: string;
  defaultUnitId?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
}

interface SubmitResponseData {
  userId: string;
  quantityNodeId: string;
  value: number;
  unitId: string;
}

interface GetQuantityNodeOptions {
  includeDiscussion?: boolean;
  includeStatistics?: boolean;
}

interface DiscoveryOptions {
  nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
  limit?: number;
  offset?: number;
  sortBy?: 'category_overlap' | 'created' | 'inclusion_votes' | 'content_votes';
  sortDirection?: 'asc' | 'desc';
  excludeSelf?: boolean;
  minCategoryOverlap?: number;
}

@Injectable()
export class QuantityService {
  private readonly logger = new Logger(QuantityService.name);

  constructor(
    private readonly quantitySchema: QuantitySchema,
    private readonly categoryService: CategoryService, // NEW: Injected CategoryService
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly unitService: UnitService,
  ) {}

  // CRUD OPERATIONS

  /**
   * Create a new quantity node
   */
  async createQuantityNode(nodeData: CreateQuantityNodeData) {
    try {
      // Validate input data
      this.validateCreateQuantityNodeData(nodeData);

      const quantityId = uuidv4();

      this.logger.log(
        `Creating quantity node: ${nodeData.question.substring(0, 50)}...`,
      );
      this.logger.debug(`Quantity node data: ${JSON.stringify(nodeData)}`);

      // Extract keywords if not provided by user
      let keywords: KeywordWithFrequency[] = [];
      if (nodeData.userKeywords && nodeData.userKeywords.length > 0) {
        keywords = nodeData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else {
        try {
          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: nodeData.question,
              userKeywords: nodeData.userKeywords,
            });
          keywords = extractionResult.keywords;
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed for quantity node: ${error.message}`,
          );
          keywords = [];
        }
      }

      // Process keywords to ensure Word nodes exist
      if (keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, {
          createdBy: nodeData.createdBy,
          question: nodeData.question,
          publicCredit: nodeData.publicCredit,
          unitCategoryId: nodeData.unitCategoryId,
          defaultUnitId: nodeData.defaultUnitId,
          initialComment: nodeData.initialComment || '',
        });
      }

      // Validate categories if provided
      if (nodeData.categoryIds && nodeData.categoryIds.length > 0) {
        await this.validateCategories(nodeData.categoryIds);
      }

      // Create quantity node with extracted keywords
      const nodeWithId = {
        ...nodeData,
        id: quantityId,
        keywords,
      };

      const createdNode =
        await this.quantitySchema.createQuantityNode(nodeWithId);

      // Create discussion for the quantity node
      if (nodeData.initialComment && nodeData.initialComment.trim()) {
        try {
          await this.discussionService.createDiscussion({
            createdBy: nodeData.createdBy,
            associatedNodeId: quantityId,
            associatedNodeType: 'QuantityNode',
            initialComment: nodeData.initialComment,
          });
        } catch (error) {
          this.logger.warn(
            `Discussion creation failed for quantity node ${quantityId}: ${error.message}`,
          );
          // Continue - quantity node created successfully even if discussion fails
        }
      }

      this.logger.log(
        `Successfully created quantity node with ID: ${createdNode.id}`,
      );
      return createdNode;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error creating quantity node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Get a quantity node by ID
   */
  async getQuantityNode(id: string, options: GetQuantityNodeOptions = {}) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting quantity node with ID: ${id}`);
      const quantityNode = await this.quantitySchema.getQuantityNode(id);

      if (!quantityNode) {
        this.logger.debug(`Quantity node with ID ${id} not found`);
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      // If includeDiscussion is requested, fetch and attach discussion
      if (options.includeDiscussion && quantityNode.discussionId) {
        quantityNode.discussion = await this.discussionService.getDiscussion(
          quantityNode.discussionId,
        );
      }

      // If includeStatistics is requested, fetch and attach statistics
      if (options.includeStatistics) {
        try {
          quantityNode.statistics = await this.getStatistics(id);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch statistics for quantity node ${id}: ${error.message}`,
          );
          quantityNode.statistics = null;
        }
      }

      return quantityNode;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Update a quantity node
   */
  async updateQuantityNode(id: string, updateData: UpdateQuantityNodeData) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      // Validate update data
      this.validateUpdateQuantityNodeData(updateData);

      this.logger.log(
        `Updating quantity node ${id}: ${JSON.stringify(updateData)}`,
      );

      // If question text is being updated, re-extract keywords
      if (updateData.question) {
        return this.updateQuantityNodeWithKeywords(id, updateData);
      }

      // If only other fields are being updated, no need to re-extract keywords
      const updatedNode = await this.quantitySchema.updateQuantityNode(
        id,
        updateData,
      );
      if (!updatedNode) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated quantity node: ${id}`);
      return updatedNode;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Delete a quantity node
   */
  async deleteQuantityNode(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Deleting quantity node: ${id}`);

      // Verify node exists
      const node = await this.getQuantityNode(id);
      if (!node) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      await this.quantitySchema.deleteQuantityNode(id);

      this.logger.log(`Successfully deleted quantity node: ${id}`);
      return { success: true, message: 'Quantity node deleted successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete quantity node: ${error.message}`,
      );
    }
  }

  // VISIBILITY MANAGEMENT

  /**
   * Set visibility status for a quantity node
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (typeof isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean value');
      }

      this.logger.log(
        `Setting visibility for quantity node ${id}: ${isVisible}`,
      );

      const updatedNode = await this.quantitySchema.setVisibilityStatus(
        id,
        isVisible,
      );
      if (!updatedNode) {
        throw new NotFoundException(`Quantity node with ID ${id} not found`);
      }

      this.logger.debug(
        `Visibility status updated for quantity node ${id}: ${isVisible}`,
      );
      return updatedNode;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set quantity node visibility: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility status for a quantity node
   */
  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting visibility status for quantity node ${id}`);
      const status = await this.quantitySchema.getVisibilityStatus(id);

      return { isVisible: status };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node visibility status: ${error.message}`,
      );
    }
  }

  // VOTING METHODS - DUAL VOTING (INCLUSION + CONTENT)

  /**
   * Vote for quantity node inclusion
   */
  async voteQuantityInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing inclusion vote on quantity node ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.quantitySchema.voteQuantityInclusion(
        id,
        sub,
        isPositive,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on quantity node: ${error.message}`,
      );
    }
  }

  /**
   * Vote for quantity node content (approach approval)
   */
  async voteQuantityContent(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing content vote on quantity node ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.quantitySchema.voteQuantityContent(id, sub, isPositive);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on quantity node content ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on quantity node content: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a quantity node by a specific user
   */
  async getQuantityVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      return await this.quantitySchema.getQuantityVoteStatus(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove vote from a quantity node
   */
  async removeQuantityVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' | 'CONTENT' = 'INCLUSION',
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Removing ${kind} vote from quantity node ${id} by user ${sub}`,
      );

      return await this.quantitySchema.removeQuantityVote(id, sub, kind);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote counts for a quantity node
   */
  async getQuantityVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting votes for quantity node ${id}`);
      return await this.quantitySchema.getQuantityVotes(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // NEW: DISCOVERY METHODS - Delegating to QuantitySchema

  /**
   * Get related content that shares categories with the given quantity node
   */
  async getRelatedContentBySharedCategories(
    nodeId: string,
    options: DiscoveryOptions = {},
  ) {
    try {
      if (!nodeId || nodeId.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(
        `Getting related content for quantity node ${nodeId} with options: ${JSON.stringify(options)}`,
      );

      return await this.quantitySchema.getRelatedContentBySharedCategories(
        nodeId,
        options,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting related content for quantity node ${nodeId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get related content: ${error.message}`,
      );
    }
  }

  /**
   * Get categories associated with a quantity node
   */
  async getQuantityNodeCategories(nodeId: string) {
    try {
      if (!nodeId || nodeId.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting categories for quantity node ${nodeId}`);

      return await this.quantitySchema.getNodeCategories(nodeId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for quantity node ${nodeId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node categories: ${error.message}`,
      );
    }
  }

  // RESPONSE MANAGEMENT

  /**
   * Submit a response to a quantity node
   */
  async submitResponse(responseData: SubmitResponseData) {
    try {
      // Validate response data
      this.validateResponseData(responseData);

      this.logger.log(
        `Submitting response to quantity node ${responseData.quantityNodeId}`,
      );

      // Verify quantity node exists and has passed inclusion threshold
      const votes = await this.getQuantityVotes(responseData.quantityNodeId);

      if (!votes || votes.inclusionNetVotes <= 0) {
        throw new BadRequestException(
          'Quantity node must pass inclusion threshold before responses can be submitted',
        );
      }

      const result = await this.quantitySchema.submitResponse(responseData);

      this.logger.log(
        `Successfully submitted response to quantity node ${responseData.quantityNodeId}`,
      );
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error submitting response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to submit response: ${error.message}`,
      );
    }
  }

  /**
   * Get user's response to a quantity node
   */
  async getUserResponse(userId: string, quantityNodeId: string) {
    try {
      if (!userId || !quantityNodeId) {
        throw new BadRequestException(
          'Both user ID and quantity node ID are required',
        );
      }

      this.logger.debug(
        `Getting user response for quantity node ${quantityNodeId} by user ${userId}`,
      );

      return await this.quantitySchema.getUserResponse(userId, quantityNodeId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting user response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get user response: ${error.message}`,
      );
    }
  }

  /**
   * Delete user's response to a quantity node
   */
  async deleteUserResponse(userId: string, quantityNodeId: string) {
    try {
      if (!userId || !quantityNodeId) {
        throw new BadRequestException(
          'Both user ID and quantity node ID are required',
        );
      }

      this.logger.log(
        `Deleting user response for quantity node ${quantityNodeId} by user ${userId}`,
      );

      await this.quantitySchema.deleteUserResponse(userId, quantityNodeId);

      this.logger.log(`Successfully deleted user response`);
      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error deleting user response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete user response: ${error.message}`,
      );
    }
  }

  /**
   * Get statistics for a quantity node
   */
  async getStatistics(id: string): Promise<QuantityNodeStats> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting statistics for quantity node ${id}`);

      return await this.quantitySchema.getStatistics(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting statistics for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get statistics: ${error.message}`,
      );
    }
  }

  // DISCUSSION & COMMENT INTEGRATION

  /**
   * Get quantity node with its discussion
   */
  async getQuantityNodeWithDiscussion(id: string) {
    return this.getQuantityNode(id, { includeDiscussion: true });
  }

  /**
   * Get comments for a quantity node's discussion
   */
  async getQuantityNodeComments(id: string) {
    try {
      const quantityNode = await this.getQuantityNode(id);

      if (!quantityNode.discussionId) {
        return { comments: [] };
      }

      const comments = await this.commentService.getCommentsByDiscussionId(
        quantityNode.discussionId,
      );
      return { comments };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting comments for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node comments: ${error.message}`,
      );
    }
  }

  /**
   * Add comment to a quantity node's discussion
   */
  async addQuantityNodeComment(
    id: string,
    commentData: { commentText: string; parentCommentId?: string },
    createdBy: string,
  ) {
    try {
      const quantityNode = await this.getQuantityNode(id);

      if (!quantityNode.discussionId) {
        throw new Error(
          `Quantity node ${id} is missing its discussion - this should not happen`,
        );
      }

      // Create the comment
      const comment = await this.commentService.createComment({
        createdBy,
        discussionId: quantityNode.discussionId,
        commentText: commentData.commentText,
        parentCommentId: commentData.parentCommentId,
      });

      return comment;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error adding comment to quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to add quantity node comment: ${error.message}`,
      );
    }
  }

  // UTILITY METHODS

  /**
   * Check if a quantity node has passed the inclusion threshold
   */
  async isQuantityNodeApproved(id: string): Promise<boolean> {
    try {
      const votes = await this.getQuantityVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking approval status for quantity node ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Check if content voting is available for a quantity node
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    try {
      const quantityNode = await this.getQuantityNode(id);
      if (!quantityNode) return false;

      // For quantity nodes, content voting is always available (unlike statements)
      return true;
    } catch (error) {
      this.logger.error(
        `Error checking content voting availability for quantity node ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Check if numeric responses are allowed for a quantity node
   */
  async isNumericResponseAllowed(id: string): Promise<boolean> {
    try {
      const votes = await this.getQuantityVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking numeric response availability for quantity node ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get quantity node statistics
   */
  async getQuantityNodeStats(id: string) {
    try {
      const [quantityNode, votes, categories, statistics] = await Promise.all([
        this.getQuantityNode(id),
        this.getQuantityVotes(id),
        this.getQuantityNodeCategories(id),
        this.getStatistics(id),
      ]);

      const isApproved = votes ? votes.inclusionNetVotes > 0 : false;
      const contentVotingAvailable = await this.isContentVotingAvailable(id);
      const numericResponseAllowed = await this.isNumericResponseAllowed(id);

      return {
        id: quantityNode.id,
        question: quantityNode.question,
        unitCategoryId: quantityNode.unitCategoryId,
        defaultUnitId: quantityNode.defaultUnitId,
        categories: categories || [],
        votes: votes || {
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        },
        statistics: statistics || {
          responseCount: 0,
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
          standardDeviation: 0,
          percentiles: {},
          distributionCurve: [],
        },
        isApproved,
        contentVotingAvailable,
        numericResponseAllowed,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting stats for quantity node ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get quantity node stats: ${error.message}`,
      );
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Validate quantity node creation data
   */
  private validateCreateQuantityNodeData(
    nodeData: CreateQuantityNodeData,
  ): void {
    if (!nodeData.question || nodeData.question.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (nodeData.question.length > TEXT_LIMITS.MAX_QUESTION_LENGTH) {
      throw new BadRequestException(
        `Question text must not exceed ${TEXT_LIMITS.MAX_QUESTION_LENGTH} characters`,
      );
    }

    if (!nodeData.createdBy || nodeData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (!nodeData.unitCategoryId || nodeData.unitCategoryId.trim() === '') {
      throw new BadRequestException('Unit category ID is required');
    }

    if (!nodeData.defaultUnitId || nodeData.defaultUnitId.trim() === '') {
      throw new BadRequestException('Default unit ID is required');
    }

    if (typeof nodeData.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit flag is required');
    }

    // Validate category count (0-3)
    if (nodeData.categoryIds && nodeData.categoryIds.length > 3) {
      throw new BadRequestException(
        'Quantity node can have maximum 3 categories',
      );
    }
  }

  /**
   * Validate quantity node update data
   */
  private validateUpdateQuantityNodeData(
    updateData: UpdateQuantityNodeData,
  ): void {
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (updateData.question !== undefined) {
      if (!updateData.question || updateData.question.trim() === '') {
        throw new BadRequestException('Question text cannot be empty');
      }

      if (updateData.question.length > TEXT_LIMITS.MAX_QUESTION_LENGTH) {
        throw new BadRequestException(
          `Question text must not exceed ${TEXT_LIMITS.MAX_QUESTION_LENGTH} characters`,
        );
      }
    }

    if (
      updateData.publicCredit !== undefined &&
      typeof updateData.publicCredit !== 'boolean'
    ) {
      throw new BadRequestException('Public credit must be a boolean value');
    }
  }

  /**
   * Validate response submission data
   */
  private validateResponseData(responseData: SubmitResponseData): void {
    if (!responseData.userId || responseData.userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    if (
      !responseData.quantityNodeId ||
      responseData.quantityNodeId.trim() === ''
    ) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (responseData.value === undefined || isNaN(responseData.value)) {
      throw new BadRequestException('Response value must be a valid number');
    }

    if (!responseData.unitId || responseData.unitId.trim() === '') {
      throw new BadRequestException('Unit ID is required');
    }
  }

  /**
   * Update quantity node with keyword re-extraction
   */
  private async updateQuantityNodeWithKeywords(
    id: string,
    updateData: UpdateQuantityNodeData,
  ) {
    const originalNode = await this.getQuantityNode(id);
    if (!originalNode) {
      throw new NotFoundException(`Quantity node with ID ${id} not found`);
    }

    // Extract keywords for the new text
    let keywords: KeywordWithFrequency[] = [];
    if (updateData.userKeywords && updateData.userKeywords.length > 0) {
      keywords = updateData.userKeywords.map((keyword) => ({
        word: keyword,
        frequency: 1,
        source: 'user' as const,
      }));
    } else if (updateData.question) {
      try {
        const extractionResult =
          await this.keywordExtractionService.extractKeywords({
            text: updateData.question,
            userKeywords: updateData.userKeywords,
          });
        keywords = extractionResult.keywords;
      } catch (error) {
        this.logger.warn(
          `Keyword extraction failed during update: ${error.message}`,
        );
        keywords = [];
      }
    }

    // Process keywords to ensure Word nodes exist
    if (keywords.length > 0) {
      await this.processKeywordsForCreation(keywords, {
        createdBy: originalNode.createdBy,
        question: updateData.question || originalNode.question,
        publicCredit:
          updateData.publicCredit !== undefined
            ? updateData.publicCredit
            : originalNode.publicCredit,
        unitCategoryId: originalNode.unitCategoryId,
        defaultUnitId: originalNode.defaultUnitId,
        initialComment: '', // Not used for updates
      });
    }

    // Prepare update data with keywords
    const updateDataWithKeywords = {
      ...updateData,
      keywords,
    };

    const updatedNode = await this.quantitySchema.updateQuantityNode(
      id,
      updateDataWithKeywords,
    );
    if (!updatedNode) {
      throw new NotFoundException(`Quantity node with ID ${id} not found`);
    }

    return updatedNode;
  }

  /**
   * Process keywords to ensure Word nodes exist before quantity node creation/update
   */
  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    nodeData: {
      createdBy: string;
      question: string;
      publicCredit: boolean;
      unitCategoryId: string;
      defaultUnitId: string;
      initialComment: string;
    },
  ): Promise<void> {
    const newWordPromises = keywords.map(async (keyword) => {
      try {
        const wordExists = await this.wordService.checkWordExistence(
          keyword.word,
        );
        if (!wordExists) {
          // Create new word if it doesn't exist
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: nodeData.createdBy,
            publicCredit: nodeData.publicCredit,
            discussion: `Word created from quantity node: "${nodeData.question.substring(0, 100)}..."`,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create word '${keyword.word}': ${error.message}`,
        );
        // Continue with other keywords even if one fails
      }
    });

    // Wait for all word creation processes to complete
    await Promise.all(newWordPromises);
  }

  /**
   * Validate categories exist and are approved for use
   */
  private async validateCategories(categoryIds: string[]): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) return;

    const validationPromises = categoryIds.map(async (categoryId) => {
      const isApproved =
        await this.categoryService.isCategoryApproved(categoryId);
      if (!isApproved) {
        throw new BadRequestException(
          `Category ${categoryId} must be approved before use`,
        );
      }
    });

    await Promise.all(validationPromises);
  }
}
