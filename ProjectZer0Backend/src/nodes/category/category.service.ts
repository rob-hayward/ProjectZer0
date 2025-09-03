// src/nodes/category/category.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CategorySchema } from '../../neo4j/schemas/category.schema';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { v4 as uuidv4 } from 'uuid';
import type { CategoryNodeData } from '../../neo4j/schemas/category.schema';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
// Fallback constants - these should match your actual validation constants
const TEXT_LIMITS = {
  MAX_CATEGORY_NAME_LENGTH: 100,
  MAX_CATEGORY_DESCRIPTION_LENGTH: 500,
  MAX_COMMENT_LENGTH: 2000,
};

interface CreateCategoryData {
  name: string;
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  wordIds: string[]; // 1-5 words that compose this category
  parentCategoryId?: string; // Optional parent category for hierarchy
  initialComment?: string;
}

interface UpdateCategoryData {
  name?: string;
  description?: string;
  publicCredit?: boolean;
}

interface GetCategoryOptions {
  includeHierarchy?: boolean;
  includeUsageStats?: boolean;
  includeDiscussion?: boolean;
}

interface GetCategoriesOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created' | 'votes' | 'usage';
  sortDirection?: 'asc' | 'desc';
  onlyApproved?: boolean;
  parentId?: string; // Filter by parent category
  searchQuery?: string; // Search in name/description
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
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly categorySchema: CategorySchema,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

  /**
   * Create a new category
   */
  async createCategory(categoryData: CreateCategoryData) {
    try {
      // Validate input data
      this.validateCategoryData(categoryData);

      const categoryId = uuidv4();

      this.logger.log(`Creating category: ${categoryData.name}`);
      this.logger.debug(`Category data: ${JSON.stringify(categoryData)}`);

      const categoryNodeData: CategoryNodeData = {
        id: categoryId,
        name: categoryData.name.trim(),
        description: categoryData.description?.trim() || undefined,
        createdBy: categoryData.createdBy,
        publicCredit: categoryData.publicCredit,
        wordIds: categoryData.wordIds,
        parentCategoryId: categoryData.parentCategoryId || undefined,
        initialComment: categoryData.initialComment?.trim() || undefined,
      };

      const result = await this.categorySchema.createCategory(categoryNodeData);

      this.logger.log(`Successfully created category with ID: ${result.id}`);
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );

      if (error.message.includes('some words may not exist')) {
        throw new BadRequestException(
          'All words must exist and have passed inclusion threshold before being used in a category',
        );
      }

      if (error.message.includes('parent category')) {
        throw new BadRequestException(
          'Parent category must exist and have passed inclusion threshold',
        );
      }

      throw new InternalServerErrorException(
        `Failed to create category: ${error.message}`,
      );
    }
  }

  /**
   * Get a category by ID
   */
  async getCategory(id: string, options: GetCategoryOptions = {}) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Retrieving category: ${id}`);

      const category = await this.categorySchema.getCategory(id);

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // Enhance with additional data if requested
      if (options.includeDiscussion && category.discussionId) {
        try {
          const discussion = await this.discussionService.getDiscussion(
            category.discussionId,
          );
          category.discussion = discussion;
        } catch (error) {
          this.logger.warn(
            `Could not fetch discussion ${category.discussionId} for category ${id}: ${error.message}`,
          );
        }
      }

      this.logger.debug(`Retrieved category: ${JSON.stringify(category)}`);
      return category;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error retrieving category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve category: ${error.message}`,
      );
    }
  }

  /**
   * Update an existing category
   */
  async updateCategory(id: string, updateData: UpdateCategoryData) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      // Validate update data
      if (updateData.name !== undefined) {
        if (!updateData.name || updateData.name.trim() === '') {
          throw new BadRequestException('Category name cannot be empty');
        }
        if (updateData.name.length > TEXT_LIMITS.MAX_CATEGORY_NAME_LENGTH) {
          throw new BadRequestException(
            `Category name must not exceed ${TEXT_LIMITS.MAX_CATEGORY_NAME_LENGTH} characters`,
          );
        }
      }

      if (
        updateData.description !== undefined &&
        updateData.description &&
        updateData.description.length >
          TEXT_LIMITS.MAX_CATEGORY_DESCRIPTION_LENGTH
      ) {
        throw new BadRequestException(
          `Category description must not exceed ${TEXT_LIMITS.MAX_CATEGORY_DESCRIPTION_LENGTH} characters`,
        );
      }

      this.logger.log(`Updating category ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      const updatedCategory = await this.categorySchema.updateCategory(
        id,
        updateData,
      );

      if (!updatedCategory) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated category ${id}`);
      return updatedCategory;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update category: ${error.message}`,
      );
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Deleting category ${id}`);

      const result = await this.categorySchema.deleteCategory(id);

      if (!result.success) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      this.logger.log(`Successfully deleted category ${id}`);
      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete category: ${error.message}`,
      );
    }
  }

  /**
   * Get all categories with filtering and sorting options
   */
  async getCategories(options: GetCategoriesOptions = {}) {
    try {
      const {
        limit,
        offset = 0,
        sortBy = 'name',
        sortDirection = 'asc',
        onlyApproved = false,
        parentId,
      } = options;

      this.logger.debug(
        `Getting categories with options: ${JSON.stringify(options)}`,
      );

      // Validate options
      if (limit !== undefined && (limit < 1 || limit > 1000)) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }

      if (offset < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      const validSortOptions = ['name', 'created', 'votes', 'usage'];
      if (!validSortOptions.includes(sortBy)) {
        throw new BadRequestException(
          `sortBy must be one of: ${validSortOptions.join(', ')}`,
        );
      }

      if (!['asc', 'desc'].includes(sortDirection)) {
        throw new BadRequestException(
          'sortDirection must be either asc or desc',
        );
      }

      // Get categories from schema
      if (onlyApproved) {
        return await this.categorySchema.getApprovedCategories({
          limit,
          offset,
          sortBy: sortBy === 'usage' ? 'name' : sortBy, // Fallback since schema doesn't support 'usage' yet
          sortDirection,
          parentId,
        });
      } else {
        return await this.categorySchema.getAllCategories({
          limit,
          offset,
          sortBy: sortBy === 'usage' ? 'name' : sortBy, // Fallback since schema doesn't support 'usage' yet
          sortDirection,
          onlyApproved: false,
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get categories: ${error.message}`,
      );
    }
  }

  /**
   * Get only approved categories (shorthand method)
   */
  async getApprovedCategories(
    options: Omit<GetCategoriesOptions, 'onlyApproved'> = {},
  ) {
    return this.getCategories({ ...options, onlyApproved: true });
  }

  /**
   * Get nodes that are using a specific category
   */
  async getNodesUsingCategory(
    categoryId: string,
    options: {
      nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
      limit?: number;
      offset?: number;
      sortBy?: 'created' | 'votes' | 'type';
      sortDirection?: 'asc' | 'desc';
    } = {},
  ) {
    try {
      if (!categoryId || categoryId.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(
        `Getting nodes using category ${categoryId} with options: ${JSON.stringify(options)}`,
      );

      return await this.categorySchema.getNodesUsingCategory(
        categoryId,
        options,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting nodes using category ${categoryId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get nodes using category: ${error.message}`,
      );
    }
  }

  /**
   * Get the hierarchical path for a category (from root to current)
   */
  async getCategoryPath(categoryId: string) {
    try {
      if (!categoryId || categoryId.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(`Getting category path for ${categoryId}`);

      return await this.categorySchema.getCategoryPath(categoryId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting category path ${categoryId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category path: ${error.message}`,
      );
    }
  }

  // VOTING METHODS

  /**
   * Vote for category inclusion (only voting type for categories)
   */
  async voteCategoryInclusion(id: string, sub: string, isPositive: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing inclusion vote on category ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.categorySchema.voteCategoryInclusion(
        id,
        sub,
        isPositive,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error voting on category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on category: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a category by a specific user
   */
  async getCategoryVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      return await this.categorySchema.getCategoryVoteStatus(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category vote status: ${error.message}`,
      );
    }
  }

  /**
   * Remove vote from a category
   */
  async removeCategoryVote(id: string, sub: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Removing vote from category ${id} by user ${sub}`);

      return await this.categorySchema.removeCategoryVote(id, sub);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to remove category vote: ${error.message}`,
      );
    }
  }

  /**
   * Get aggregated vote counts for a category
   */
  async getCategoryVotes(id: string): Promise<VoteResult | null> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      return await this.categorySchema.getCategoryVotes(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category votes: ${error.message}`,
      );
    }
  }

  // VISIBILITY METHODS

  /**
   * Set visibility status for a category
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.log(`Setting visibility for category ${id} to ${isVisible}`);

      return await this.categorySchema.setVisibilityStatus(id, isVisible);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set category visibility: ${error.message}`,
      );
    }
  }

  /**
   * Get visibility status for a category
   */
  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      return await this.categorySchema.getVisibilityStatus(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category visibility status: ${error.message}`,
      );
    }
  }

  // DISCOVERY METHODS

  /**
   * Get related content that shares categories with the given category
   * Note: This method will be fully implemented when CategorySchema discovery methods are complete
   */
  async getRelatedContentBySharedCategories(
    categoryId: string,
    options: DiscoveryOptions = {},
  ) {
    try {
      if (!categoryId || categoryId.trim() === '') {
        throw new BadRequestException('Category ID is required');
      }

      this.logger.debug(
        `Getting related content for category ${categoryId} with options: ${JSON.stringify(options)}`,
      );

      // TODO: Implement when CategorySchema.getRelatedContentBySharedCategories is available
      // return await this.categorySchema.getRelatedContentBySharedCategories(
      //   categoryId,
      //   options,
      // );

      // Temporary placeholder - return empty array until schema method is implemented
      this.logger.warn(
        `getRelatedContentBySharedCategories not yet implemented in CategorySchema`,
      );
      return [];
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting related content for category ${categoryId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get related content: ${error.message}`,
      );
    }
  }

  /**
   * Get categories associated with a specific node
   * Note: This method will be fully implemented when CategorySchema discovery methods are complete
   */
  async getNodeCategories(nodeId: string) {
    try {
      if (!nodeId || nodeId.trim() === '') {
        throw new BadRequestException('Node ID is required');
      }

      this.logger.debug(`Getting categories for node ${nodeId}`);

      // TODO: Implement when CategorySchema.getNodeCategories is available
      // return await this.categorySchema.getNodeCategories(nodeId);

      // Temporary placeholder - return empty array until schema method is implemented
      this.logger.warn(
        `getNodeCategories not yet implemented in CategorySchema`,
      );
      return [];
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for node ${nodeId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get node categories: ${error.message}`,
      );
    }
  }

  // DISCUSSION & COMMENT INTEGRATION

  /**
   * Get category with its discussion
   */
  async getCategoryWithDiscussion(id: string) {
    return this.getCategory(id, { includeDiscussion: true });
  }

  /**
   * Get comments for a category's discussion
   */
  async getCategoryComments(id: string) {
    try {
      const category = await this.getCategory(id);

      if (!category.discussionId) {
        return { comments: [] };
      }

      const comments = await this.commentService.getCommentsByDiscussionId(
        category.discussionId,
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
        `Error getting comments for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category comments: ${error.message}`,
      );
    }
  }

  /**
   * Add comment to a category's discussion
   */
  async addCategoryComment(
    id: string,
    commentData: { commentText: string; parentCommentId?: string },
    createdBy: string,
  ) {
    try {
      const category = await this.getCategory(id);

      if (!category.discussionId) {
        throw new Error(
          `Category ${id} is missing its discussion - this should not happen`,
        );
      }

      // Create the comment
      const comment = await this.commentService.createComment({
        createdBy,
        discussionId: category.discussionId,
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
        `Error adding comment to category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to add category comment: ${error.message}`,
      );
    }
  }

  // UTILITY METHODS

  /**
   * Check if a category has passed the inclusion threshold
   */
  async isCategoryApproved(id: string): Promise<boolean> {
    try {
      const votes = await this.getCategoryVotes(id);
      return votes ? votes.inclusionNetVotes > 0 : false;
    } catch (error) {
      this.logger.error(
        `Error checking approval status for category ${id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStats(id: string) {
    try {
      const [category, votes, usageNodes] = await Promise.all([
        this.getCategory(id),
        this.getCategoryVotes(id),
        this.getNodesUsingCategory(id),
      ]);

      return {
        id: category.id,
        name: category.name,
        totalUsages: usageNodes.length,
        votes: votes || {
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        },
        isApproved: votes ? votes.inclusionNetVotes > 0 : false,
        composedWords: category.composedWords || [],
        hierarchyLevel: category.parentCategory ? 1 : 0, // Simplified for now
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting stats for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category stats: ${error.message}`,
      );
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Validate category creation data
   */
  private validateCategoryData(categoryData: CreateCategoryData): void {
    if (!categoryData.name || categoryData.name.trim() === '') {
      throw new BadRequestException('Category name is required');
    }

    if (categoryData.name.length > TEXT_LIMITS.MAX_CATEGORY_NAME_LENGTH) {
      throw new BadRequestException(
        `Category name must not exceed ${TEXT_LIMITS.MAX_CATEGORY_NAME_LENGTH} characters`,
      );
    }

    if (
      categoryData.description &&
      categoryData.description.length >
        TEXT_LIMITS.MAX_CATEGORY_DESCRIPTION_LENGTH
    ) {
      throw new BadRequestException(
        `Category description must not exceed ${TEXT_LIMITS.MAX_CATEGORY_DESCRIPTION_LENGTH} characters`,
      );
    }

    if (!categoryData.createdBy || categoryData.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (!categoryData.wordIds || !Array.isArray(categoryData.wordIds)) {
      throw new BadRequestException('Word IDs array is required');
    }

    if (categoryData.wordIds.length < 1 || categoryData.wordIds.length > 5) {
      throw new BadRequestException('Category must be composed of 1-5 words');
    }

    // Validate each word ID
    for (const wordId of categoryData.wordIds) {
      if (!wordId || typeof wordId !== 'string' || wordId.trim() === '') {
        throw new BadRequestException('All word IDs must be valid strings');
      }
    }

    if (
      categoryData.initialComment &&
      categoryData.initialComment.length > TEXT_LIMITS.MAX_COMMENT_LENGTH
    ) {
      throw new BadRequestException(
        `Initial comment must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }
  }
}
