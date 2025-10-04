// src/nodes/category/category.service.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CategorySchema } from '../../neo4j/schemas/category.schema';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { CategoryData } from '../../neo4j/schemas/category.schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * CategoryService - Business logic for category operations
 *
 * ARCHITECTURE:
 * - Delegates all CRUD operations to CategorySchema
 * - Injects DiscussionSchema directly (NOT DiscussionService)
 * - Orchestrates category creation + word validation + discussion
 * - Handles hierarchical operations
 *
 * SPECIAL CHARACTERISTICS:
 * - Category extends BaseNodeSchema (not CategorizedNodeSchema)
 * - Self-categorization pattern (category belongs to itself)
 * - Composed of 1-5 approved words
 * - Hierarchical with parent/child relationships
 * - Inclusion voting only (no content voting)
 * - Standard 'id' field
 *
 * RESPONSIBILITIES:
 * ✅ Orchestrate multiple schema calls (category + discussion)
 * ✅ Business validation (1-5 words, word approval, hierarchy)
 * ✅ Data transformation and aggregation
 *
 * NOT RESPONSIBLE FOR:
 * ❌ Writing Cypher queries (that's CategorySchema)
 * ❌ Direct database access (that's Neo4jService)
 * ❌ HTTP concerns (that's CategoryController)
 */
@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly categorySchema: CategorySchema,
    private readonly discussionSchema: DiscussionSchema, // ← Direct injection
    private readonly userSchema: UserSchema,
  ) {}

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new category with optional discussion
   * Orchestrates: validation + category creation + discussion creation
   */
  async createCategory(categoryData: {
    name: string;
    description?: string;
    createdBy: string;
    publicCredit?: boolean;
    wordIds: string[]; // 1-5 words
    parentCategoryId?: string;
    initialComment?: string;
  }): Promise<CategoryData> {
    // Validate input
    this.validateCategoryInput(categoryData);

    this.logger.log(`Creating category: ${categoryData.name}`);

    try {
      // Generate ID
      const categoryId = uuidv4();

      // Create category via schema (schema validates words and creates self-categorization)
      const category = await this.categorySchema.createCategory({
        id: categoryId,
        name: categoryData.name.trim(),
        description: categoryData.description?.trim(),
        createdBy: categoryData.createdBy,
        publicCredit: categoryData.publicCredit ?? true,
        wordIds: categoryData.wordIds,
        parentCategoryId: categoryData.parentCategoryId,
      });

      // Create discussion if initialComment provided
      // ⚠️ CRITICAL: Use direct DiscussionSchema injection
      if (categoryData.initialComment) {
        try {
          await this.discussionSchema.createDiscussionForNode({
            nodeId: category.id, // ← Standard 'id' field
            nodeType: 'CategoryNode',
            nodeIdField: 'id', // ← Standard 'id'
            createdBy: categoryData.createdBy,
            initialComment: categoryData.initialComment,
          });
          this.logger.debug(`Created discussion for category: ${category.id}`);
        } catch (error) {
          this.logger.warn(
            `Failed to create discussion for category ${category.id}: ${error.message}`,
          );
          // Continue - category creation succeeded
        }
      }

      this.logger.log(`Successfully created category: ${category.id}`);
      return category;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create category: ${error.message}`,
      );
    }
  }

  /**
   * Get a category by ID
   * Direct delegation to schema
   */
  async getCategory(id: string): Promise<CategoryData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    this.logger.debug(`Getting category: ${id}`);

    try {
      const category = await this.categorySchema.findById(id);

      if (!category) {
        this.logger.debug(`Category not found: ${id}`);
        return null;
      }

      return category;
    } catch (error) {
      this.logger.error(
        `Error getting category: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category: ${error.message}`,
      );
    }
  }

  /**
   * Update a category
   * Direct delegation to schema
   */
  async updateCategory(
    id: string,
    updateData: {
      name?: string;
      description?: string;
      publicCredit?: boolean;
    },
  ): Promise<CategoryData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    // Validate at least one field to update
    if (
      !updateData.name &&
      !updateData.description &&
      updateData.publicCredit === undefined
    ) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    // Validate name if provided
    if (updateData.name !== undefined && updateData.name.trim() === '') {
      throw new BadRequestException('Category name cannot be empty');
    }

    this.logger.log(`Updating category: ${id}`);

    try {
      const category = await this.categorySchema.update(id, updateData);

      if (!category) {
        this.logger.debug(`Category not found for update: ${id}`);
        return null;
      }

      this.logger.debug(`Updated category: ${id}`);
      return category;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating category: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update category: ${error.message}`,
      );
    }
  }

  /**
   * Delete a category
   * Direct delegation to schema
   */
  async deleteCategory(id: string): Promise<void> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    this.logger.log(`Deleting category: ${id}`);

    try {
      await this.categorySchema.delete(id);
      this.logger.debug(`Deleted category: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error deleting category: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete category: ${error.message}`,
      );
    }
  }

  // ============================================
  // VOTING OPERATIONS - Direct delegation
  // ============================================

  /**
   * Vote on category inclusion
   * Categories only support inclusion voting, not content voting
   */
  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Voting on category inclusion: ${id} by user: ${userId}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.categorySchema.voteInclusion(
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
        `Error voting on category: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on category: ${error.message}`,
      );
    }
  }

  /**
   * Get vote status for a user on a category
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for category: ${id}, user: ${userId}`,
    );

    try {
      return await this.categorySchema.getVoteStatus(id, userId);
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
   * Remove a vote
   */
  async removeVote(id: string, userId: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing vote for category: ${id}, user: ${userId}`);

    try {
      return await this.categorySchema.removeVote(id, userId, 'INCLUSION');
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error removing vote: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to remove vote: ${error.message}`,
      );
    }
  }

  /**
   * Get vote counts for a category
   */
  async getVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    this.logger.debug(`Getting votes for category: ${id}`);

    try {
      return await this.categorySchema.getVotes(id);
    } catch (error) {
      this.logger.error(`Error getting votes: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Failed to get votes: ${error.message}`,
      );
    }
  }

  // ============================================
  // HIERARCHICAL OPERATIONS
  // ============================================

  /**
   * Get category hierarchy (tree structure)
   * Direct delegation to schema
   */
  async getCategoryHierarchy(rootId?: string) {
    this.logger.debug(
      `Getting category hierarchy${rootId ? ` for root: ${rootId}` : ''}`,
    );

    try {
      return await this.categorySchema.getCategoryHierarchy(rootId);
    } catch (error) {
      this.logger.error(
        `Error getting category hierarchy: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get category hierarchy: ${error.message}`,
      );
    }
  }

  /**
   * Get categories for a node
   * Direct delegation to schema
   */
  async getCategoriesForNode(nodeId: string) {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }

    this.logger.debug(`Getting categories for node: ${nodeId}`);

    try {
      return await this.categorySchema.getCategoriesForNode(nodeId);
    } catch (error) {
      this.logger.error(
        `Error getting categories for node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get categories for node: ${error.message}`,
      );
    }
  }

  // ============================================
  // QUERY OPERATIONS
  // ============================================

  /**
   * Get all categories
   * Direct delegation to schema
   */
  async getAllCategories(): Promise<CategoryData[]> {
    this.logger.debug('Getting all categories');

    try {
      const categories = await this.categorySchema.getAllCategories();
      this.logger.debug(`Retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting all categories: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get all categories: ${error.message}`,
      );
    }
  }

  /**
   * Get approved categories (passed inclusion threshold)
   * Direct delegation to schema
   */
  async getApprovedCategories(): Promise<CategoryData[]> {
    this.logger.debug('Getting approved categories');

    try {
      const categories = await this.categorySchema.getApprovedCategories();
      this.logger.debug(`Retrieved ${categories.length} approved categories`);
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting approved categories: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get approved categories: ${error.message}`,
      );
    }
  }

  // ============================================
  // PRIVATE VALIDATION HELPERS
  // ============================================

  /**
   * Validates category input data
   * Business rules:
   * - Name required and not empty
   * - Description optional
   * - 1-5 words required
   * - Parent category prevents circular relationships (checked in schema)
   */
  private validateCategoryInput(categoryData: {
    name: string;
    wordIds: string[];
  }): void {
    if (!categoryData.name || categoryData.name.trim() === '') {
      throw new BadRequestException('Category name is required');
    }

    if (!categoryData.wordIds || categoryData.wordIds.length === 0) {
      throw new BadRequestException('At least one word is required');
    }

    if (categoryData.wordIds.length > 5) {
      throw new BadRequestException(
        'Maximum 5 words allowed for category composition',
      );
    }

    // Note: Word approval and circular parent checks done in CategorySchema
  }
}
