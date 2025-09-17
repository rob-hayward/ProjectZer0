// src/nodes/category/category.service.ts - UPDATED WITH COMPLETE FILTERING IMPLEMENTATION

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
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

// Interface definitions
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

interface CategoryNodeData {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  wordIds: string[]; // 1-5 words that compose this category
  parentCategoryId?: string; // Optional parent category for hierarchy
  initialComment?: string;
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

  // CRUD OPERATIONS - HYBRID PATTERN IMPLEMENTATION

  /**
   * Create a new category - Uses enhanced createCategory() method
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

      // ✅ Use enhanced domain method for complex creation
      const result = await this.categorySchema.createCategory(categoryNodeData);

      this.logger.log(`Successfully created category with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(error, 'create category');
    }
  }

  /**
   * Get category by ID - Uses enhanced getCategory() method
   */
  async getCategory(id: string, options: GetCategoryOptions = {}) {
    try {
      this.validateId(id);

      this.logger.debug(
        `Getting category: ${id} with options: ${JSON.stringify(options)}`,
      );

      // ✅ Use enhanced domain method for complex retrieval
      const category = await this.categorySchema.getCategory(id);

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // Handle optional discussion loading
      if (options.includeDiscussion) {
        // Note: CategoryData interface doesn't have discussionId
        // This functionality might need to be implemented differently
        this.logger.debug(
          `Discussion inclusion requested but not implemented yet for category ${id}`,
        );
      }

      return category;
    } catch (error) {
      this.handleError(error, `get category ${id}`);
    }
  }

  /**
   * Update category - Uses BaseNodeSchema method for simple updates
   */
  async updateCategory(id: string, updateData: UpdateCategoryData) {
    try {
      this.validateId(id);
      this.validateUpdateCategoryData(updateData);

      this.logger.log(`Updating category: ${id}`);

      // ✅ Use BaseNodeSchema method for simple updates
      const result = await this.categorySchema.update(id, updateData);

      if (!result) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated category: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `update category ${id}`);
    }
  }

  /**
   * Delete category - Uses BaseNodeSchema method
   */
  async deleteCategory(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Deleting category: ${id}`);

      // Check if category exists first
      const category = await this.categorySchema.findById(id);
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // ✅ Use BaseNodeSchema method for standard deletion
      await this.categorySchema.delete(id);

      this.logger.log(`Successfully deleted category: ${id}`);
      return { success: true };
    } catch (error) {
      this.handleError(error, `delete category ${id}`);
    }
  }

  // LISTING AND FILTERING METHODS - COMPLETE IMPLEMENTATION

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
        searchQuery,
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

      // Validate parent exists if provided
      if (parentId) {
        const parentCategory = await this.categorySchema.findById(parentId);
        if (!parentCategory) {
          throw new NotFoundException(
            `Parent category with ID ${parentId} not found`,
          );
        }
      }

      // ✅ USE ENHANCED SCHEMA METHOD FOR ALL FILTERING
      return await this.categorySchema.getAllCategories({
        limit,
        offset,
        sortBy,
        sortDirection,
        onlyApproved,
        parentId,
        searchQuery,
      });
    } catch (error) {
      this.handleError(error, 'get categories');
    }
  }

  /**
   * Get child categories for a specific parent (convenience method)
   */
  async getCategoriesByParent(
    parentId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created' | 'votes' | 'usage';
      sortDirection?: 'asc' | 'desc';
      onlyApproved?: boolean;
    } = {},
  ) {
    try {
      this.validateId(parentId);

      this.logger.debug(
        `Getting child categories for parent: ${parentId} with options: ${JSON.stringify(options)}`,
      );

      // Use the schema method with parent filtering
      return await this.categorySchema.getAllCategories({
        parentId,
        ...options,
      });
    } catch (error) {
      this.handleError(error, `get categories by parent ${parentId}`);
    }
  }

  /**
   * Search categories by text query (convenience method)
   */
  async searchCategories(
    searchQuery: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created' | 'votes' | 'usage';
      sortDirection?: 'asc' | 'desc';
      onlyApproved?: boolean;
    } = {},
  ) {
    try {
      if (!searchQuery || searchQuery.trim() === '') {
        throw new BadRequestException('Search query cannot be empty');
      }

      this.logger.debug(
        `Searching categories for: "${searchQuery}" with options: ${JSON.stringify(options)}`,
      );

      // Use the schema method with search filtering
      return await this.categorySchema.getAllCategories({
        searchQuery: searchQuery.trim(),
        ...options,
      });
    } catch (error) {
      this.handleError(error, `search categories for "${searchQuery}"`);
    }
  }

  /**
   * Get approved categories (convenience method for controller)
   * Uses the existing getAllCategories with onlyApproved filter
   */
  async getApprovedCategories(
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created' | 'votes' | 'usage';
      sortDirection?: 'asc' | 'desc';
      parentId?: string;
    } = {},
  ) {
    try {
      this.logger.debug(
        `Getting approved categories with options: ${JSON.stringify(options)}`,
      );

      // Use existing filtering with onlyApproved = true
      return await this.getCategories({
        ...options,
        onlyApproved: true,
      });
    } catch (error) {
      this.handleError(error, 'get approved categories');
    }
  }

  /**
   * Check if a category is approved (has positive inclusion votes)
   */
  async isCategoryApproved(id: string): Promise<boolean> {
    try {
      this.validateId(id);

      this.logger.debug(`Checking if category ${id} is approved`);

      // Get category using BaseNodeSchema method
      const category = await this.categorySchema.findById(id);

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // Category is approved if it has positive inclusion votes
      return category.inclusionNetVotes > 0;
    } catch (error) {
      this.handleError(error, `check if category ${id} is approved`);
    }
  }

  /**
   * Add comment to category (placeholder implementation)
   */
  async addCategoryComment(
    categoryId: string,
    userId: string,
    commentText: string,
    parentCommentId?: string,
  ) {
    try {
      this.validateId(categoryId);
      this.validateUserId(userId);

      if (!commentText || commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(
        `Adding comment to category ${categoryId} by user ${userId}`,
      );

      // Get category to ensure it exists
      const category = await this.getCategory(categoryId);

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      // For now, return a placeholder response since full comment integration is not implemented
      this.logger.warn(
        'Category comment integration not yet fully implemented',
      );

      // TODO: Integrate with CommentService when discussion system is implemented
      // This would need:
      // 1. Create discussion for category if not exists
      // 2. Add comment to discussion
      // 3. Update category with discussion reference

      return {
        id: `comment-${Date.now()}`,
        text: commentText.trim(),
        createdBy: userId,
        parentCommentId,
        createdAt: new Date(),
      };
    } catch (error) {
      this.handleError(error, `add comment to category ${categoryId}`);
    }
  }

  // VOTING METHODS - Uses BaseNodeSchema methods

  /**
   * Vote for category inclusion (only voting type for categories) - Uses BaseNodeSchema method
   */
  async voteCategoryInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Processing inclusion vote on category ${id} by user ${userId}: ${isPositive ? 'positive' : 'negative'}`,
      );

      // ✅ Use BaseNodeSchema method for standard voting
      return await this.categorySchema.voteInclusion(id, userId, isPositive);
    } catch (error) {
      this.handleError(error, `vote on category inclusion ${id}`);
    }
  }

  /**
   * Get vote status for a category by a specific user - Uses BaseNodeSchema method
   */
  async getCategoryVoteStatus(
    id: string,
    userId: string,
  ): Promise<VoteStatus | null> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      // ✅ Use BaseNodeSchema method
      return await this.categorySchema.getVoteStatus(id, userId);
    } catch (error) {
      this.handleError(error, `get vote status for category ${id}`);
    }
  }

  /**
   * Remove vote from a category - Uses BaseNodeSchema method
   */
  async removeCategoryVote(id: string, userId: string) {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(`Removing vote from category ${id} by user ${userId}`);

      // ✅ Use BaseNodeSchema method (categories only support INCLUSION voting)
      return await this.categorySchema.removeVote(id, userId, 'INCLUSION');
    } catch (error) {
      this.handleError(error, `remove vote from category ${id}`);
    }
  }

  /**
   * Get vote counts for a category - Uses BaseNodeSchema method
   */
  async getCategoryVotes(id: string): Promise<VoteResult> {
    try {
      this.validateId(id);

      this.logger.debug(`Getting votes for category ${id}`);

      // ✅ Use BaseNodeSchema method
      return await this.categorySchema.getVotes(id);
    } catch (error) {
      this.handleError(error, `get votes for category ${id}`);
    }
  }

  // UTILITY METHODS - Uses enhanced domain methods

  /**
   * Get category statistics - Uses enhanced domain method
   */
  async getCategoryStats(id: string) {
    try {
      this.validateId(id);

      this.logger.debug(`Getting category stats for ${id}`);

      // ✅ Use enhanced domain method
      return await this.categorySchema.getCategoryStats(id);
    } catch (error) {
      this.handleError(error, `get stats for category ${id}`);
    }
  }

  /**
   * Get nodes that use a specific category
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
      this.validateId(categoryId);

      this.logger.debug(
        `Getting nodes using category ${categoryId} with options: ${JSON.stringify(options)}`,
      );

      // For now, return empty array since this method doesn't exist in CategorySchema yet
      this.logger.warn(
        'getNodesUsingCategory not yet implemented in CategorySchema - returning empty array',
      );
      return [];
    } catch (error) {
      this.handleError(error, `get nodes using category ${categoryId}`);
    }
  }

  /**
   * Get the hierarchical path for a category (from root to current)
   */
  async getCategoryPath(categoryId: string) {
    try {
      this.validateId(categoryId);

      this.logger.debug(`Getting category path for ${categoryId}`);

      // For now, return empty array since this method doesn't exist in CategorySchema yet
      this.logger.warn(
        'getCategoryPath not yet implemented in CategorySchema - returning empty array',
      );
      return [];
    } catch (error) {
      this.handleError(error, `get category path for ${categoryId}`);
    }
  }

  // DISCOVERY METHODS - Alternative implementations

  /**
   * Get related content that shares categories with the given category
   */
  async getRelatedContentBySharedCategories(
    categoryId: string,
    options: DiscoveryOptions = {},
  ) {
    try {
      this.validateId(categoryId);

      this.logger.debug(
        `Getting related content for category ${categoryId} with options: ${JSON.stringify(options)}`,
      );

      // For now, return empty array since this method doesn't exist in CategorySchema yet
      this.logger.warn(
        'getRelatedContentBySharedCategories not yet implemented in CategorySchema - returning empty array',
      );
      return [];
    } catch (error) {
      this.handleError(error, `get related content for category ${categoryId}`);
    }
  }

  /**
   * Get categories associated with a specific node
   */
  async getNodeCategories(nodeId: string) {
    try {
      this.validateId(nodeId);

      this.logger.debug(`Getting categories for node ${nodeId}`);

      // For now, return empty array since this method doesn't exist in CategorySchema yet
      this.logger.warn(
        'getNodeCategories not yet implemented in CategorySchema - returning empty array',
      );
      return [];
    } catch (error) {
      this.handleError(error, `get categories for node ${nodeId}`);
    }
  }

  // VISIBILITY METHODS - Uses enhanced domain methods

  /**
   * Set visibility status for a category - Uses enhanced domain method
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      this.validateId(id);

      if (typeof isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean value');
      }

      this.logger.log(`Setting visibility for category ${id}: ${isVisible}`);

      // ✅ Use enhanced domain method (preserved for category-specific visibility logic)
      const result = await this.categorySchema.setVisibilityStatus(
        id,
        isVisible,
      );

      if (!result) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      return result;
    } catch (error) {
      this.handleError(error, `set visibility status for category ${id}`);
    }
  }

  /**
   * Get visibility status for a category - Uses enhanced domain method
   */
  async getVisibilityStatus(id: string) {
    try {
      this.validateId(id);

      // ✅ Use enhanced domain method
      return await this.categorySchema.getVisibilityStatus(id);
    } catch (error) {
      this.handleError(error, `get visibility status for category ${id}`);
    }
  }

  // DISCUSSION AND COMMENT METHODS - Alternative implementations

  /**
   * Get category with its discussion
   */
  async getCategoryWithDiscussion(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Getting category with discussion: ${id}`);

      const category = await this.getCategory(id);

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // For now, return category without discussion since discussionId is not in CategoryData interface
      this.logger.warn('Category discussion integration not yet implemented');
      return category;
    } catch (error) {
      this.handleError(error, `get category with discussion ${id}`);
    }
  }

  /**
   * Get comments for a category
   */
  async getCategoryComments(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Getting comments for category: ${id}`);

      const category = await this.getCategory(id);

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // For now, return empty array since discussionId is not in CategoryData interface
      this.logger.warn('Category comments integration not yet implemented');
      return { comments: [] };
    } catch (error) {
      this.handleError(error, `get comments for category ${id}`);
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

    if (categoryData.name.length > 100) {
      throw new BadRequestException(
        'Category name cannot exceed 100 characters',
      );
    }

    if (!categoryData.createdBy || categoryData.createdBy.trim() === '') {
      throw new BadRequestException('Creator user ID is required');
    }

    if (!categoryData.wordIds || !Array.isArray(categoryData.wordIds)) {
      throw new BadRequestException('Word IDs array is required');
    }

    if (categoryData.wordIds.length < 1 || categoryData.wordIds.length > 5) {
      throw new BadRequestException('Category must be composed of 1-5 words');
    }

    // Validate word IDs are not empty
    categoryData.wordIds.forEach((wordId, index) => {
      if (!wordId || wordId.trim() === '') {
        throw new BadRequestException(
          `Word ID at index ${index} cannot be empty`,
        );
      }
    });

    if (categoryData.description && categoryData.description.length > 500) {
      throw new BadRequestException(
        'Category description cannot exceed 500 characters',
      );
    }
  }

  /**
   * Validate category update data
   */
  private validateUpdateCategoryData(updateData: UpdateCategoryData): void {
    if (!updateData || Object.keys(updateData).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    if (updateData.name !== undefined) {
      if (!updateData.name || updateData.name.trim() === '') {
        throw new BadRequestException('Category name cannot be empty');
      }

      if (updateData.name.length > 100) {
        throw new BadRequestException(
          'Category name cannot exceed 100 characters',
        );
      }
    }

    if (
      updateData.description !== undefined &&
      updateData.description &&
      updateData.description.length > 500
    ) {
      throw new BadRequestException(
        'Category description cannot exceed 500 characters',
      );
    }
  }

  private validateId(id: string, fieldName: string = 'ID') {
    if (!id || id.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }
  }

  private validateUserId(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }
  }

  private handleError(error: any, operation: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    this.logger.error(`Error ${operation}: ${error.message}`, error.stack);
    throw new InternalServerErrorException(
      `Failed to ${operation}: ${error.message}`,
    );
  }
}
