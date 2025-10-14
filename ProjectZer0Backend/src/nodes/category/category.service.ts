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
import type {
  UniversalNodeData,
  UniversalRelationshipData,
  UniversalGraphExpansionResponse,
} from '../universal/universal-graph.service';

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
 * - Name auto-generated from constituent words
 * - No description field
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
   * Note: name is auto-generated from wordIds, not user-provided
   */
  async createCategory(categoryData: {
    createdBy: string;
    publicCredit?: boolean;
    wordIds: string[]; // 1-5 words - name will be auto-generated from these
    parentCategoryId?: string;
    initialComment?: string;
  }): Promise<CategoryData> {
    // Validate input
    this.validateCategoryInput(categoryData);

    this.logger.log(
      `Creating category from ${categoryData.wordIds.length} words`,
    );

    try {
      // Generate ID
      const categoryId = uuidv4();

      // Create category via schema (schema validates words, generates name, creates self-categorization)
      const category = await this.categorySchema.createCategory({
        id: categoryId,
        createdBy: categoryData.createdBy,
        publicCredit: categoryData.publicCredit ?? true,
        wordIds: categoryData.wordIds,
        parentCategoryId: categoryData.parentCategoryId,
        initialComment: categoryData.initialComment,
      });

      this.logger.log(
        `Successfully created category: ${category.name} (${category.id})`,
      );
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
      const category = await this.categorySchema.getCategory(id);

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
   * Note: name cannot be updated (auto-generated), description field removed
   */
  async updateCategory(
    id: string,
    updateData: {
      publicCredit?: boolean;
    },
  ): Promise<CategoryData> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (updateData.publicCredit === undefined) {
      throw new BadRequestException('No fields provided for update');
    }

    this.logger.debug(`Updating category: ${id}`);

    try {
      const updatedCategory = await this.categorySchema.update(id, updateData);

      if (!updatedCategory) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      this.logger.debug(`Successfully updated category: ${id}`);
      return updatedCategory;
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

    this.logger.debug(`Deleting category: ${id}`);

    try {
      await this.categorySchema.delete(id);
      this.logger.debug(`Successfully deleted category: ${id}`);
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
  // VOTING OPERATIONS
  // ============================================

  /**
   * Vote on category inclusion
   * Categories only have inclusion voting (no content voting)
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
      `User ${userId} voting ${isPositive ? 'positive' : 'negative'} on category inclusion: ${id}`,
    );

    try {
      return await this.categorySchema.voteInclusion(id, userId, isPositive);
    } catch (error) {
      this.logger.error(
        `Error voting on category inclusion: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to vote on category: ${error.message}`,
      );
    }
  }

  /**
   * Get user's vote status for a category
   */
  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting vote status for category ${id}, user ${userId}`);

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
   * Remove user's vote from a category
   */
  async removeVote(id: string, userId: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID is required');
    }

    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Removing vote from category ${id} for user ${userId}`);

    try {
      return await this.categorySchema.removeVote(id, userId, 'INCLUSION');
    } catch (error) {
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
  // HIERARCHY OPERATIONS
  // ============================================

  /**
   * Get category hierarchy
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
  // VALIDATION
  // ============================================

  /**
   * Validate category creation input
   * Note: name is not validated as it's auto-generated
   */
  private validateCategoryInput(data: {
    wordIds: string[];
    createdBy: string;
  }): void {
    // Validate word IDs
    if (!data.wordIds || data.wordIds.length === 0) {
      throw new BadRequestException(
        'At least one word is required to create a category',
      );
    }

    if (data.wordIds.length > 5) {
      throw new BadRequestException('Maximum 5 words allowed per category');
    }

    // Validate each word ID is not empty
    const invalidWordIds = data.wordIds.filter((id) => !id || id.trim() === '');
    if (invalidWordIds.length > 0) {
      throw new BadRequestException('Word IDs cannot be empty');
    }

    // Validate creator
    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }
  }

  /**
   * Get category with composed words for universal graph visualization
   * Phase 2c: Load category structure onto graph
   */
  async getCategoryWithContentsForGraph(
    categoryId: string,
    options: { userId?: string },
  ): Promise<UniversalGraphExpansionResponse> {
    try {
      this.logger.debug(
        `Getting category with contents for graph: ${categoryId}`,
      );

      // 1. Get category node
      const category = await this.getCategory(categoryId);
      if (!category) {
        throw new NotFoundException(`Category ${categoryId} not found`);
      }

      // 2. Get composed words - need to query via schema since they're not in CategoryData by default
      // Use the neo4jService to query the COMPOSED_OF relationships
      const composedWordsQuery = `
      MATCH (c:CategoryNode {id: $categoryId})-[:COMPOSED_OF]->(w:WordNode)
      RETURN w.word as word, w.createdBy as createdBy, w.publicCredit as publicCredit,
             w.createdAt as createdAt, w.updatedAt as updatedAt,
             w.inclusionPositiveVotes as inclusionPositiveVotes,
             w.inclusionNegativeVotes as inclusionNegativeVotes,
             w.inclusionNetVotes as inclusionNetVotes,
             w.discussionId as discussionId
      ORDER BY w.word ASC
    `;

      const result = await this.categorySchema['neo4jService'].read(
        composedWordsQuery,
        { categoryId },
      );

      const composedWords = result.records.map((record) => ({
        word: record.get('word'),
        createdBy: record.get('createdBy'),
        publicCredit: record.get('publicCredit'),
        createdAt: record.get('createdAt'),
        updatedAt: record.get('updatedAt'),
        inclusionPositiveVotes: this.toNumber(
          record.get('inclusionPositiveVotes'),
        ),
        inclusionNegativeVotes: this.toNumber(
          record.get('inclusionNegativeVotes'),
        ),
        inclusionNetVotes: this.toNumber(record.get('inclusionNetVotes')),
        discussionId: record.get('discussionId'),
      }));

      this.logger.debug(
        `Found ${composedWords.length} composed words for category: ${categoryId}`,
      );

      // 3. Transform category to universal format
      const categoryUniversal: UniversalNodeData = {
        id: category.id,
        type: 'category' as any,
        content: category.name,
        createdBy: category.createdBy,
        publicCredit: category.publicCredit,
        createdAt:
          category.createdAt instanceof Date
            ? category.createdAt.toISOString()
            : new Date().toISOString(),
        updatedAt:
          category.updatedAt instanceof Date
            ? category.updatedAt.toISOString()
            : new Date().toISOString(),
        inclusionPositiveVotes: category.inclusionPositiveVotes || 0,
        inclusionNegativeVotes: category.inclusionNegativeVotes || 0,
        inclusionNetVotes: category.inclusionNetVotes || 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        discussionId: category.discussionId || null,
        keywords: [],
        categories: [],
        metadata: {},
      };

      // 4. Transform composed words to universal format
      const wordNodes: UniversalNodeData[] = composedWords.map((word) => ({
        id: word.word,
        type: 'word' as any,
        content: word.word,
        createdBy: word.createdBy || 'system',
        publicCredit: word.publicCredit || false,
        createdAt: word.createdAt
          ? new Date(word.createdAt).toISOString()
          : new Date().toISOString(),
        updatedAt: word.updatedAt
          ? new Date(word.updatedAt).toISOString()
          : new Date().toISOString(),
        inclusionPositiveVotes: word.inclusionPositiveVotes || 0,
        inclusionNegativeVotes: word.inclusionNegativeVotes || 0,
        inclusionNetVotes: word.inclusionNetVotes || 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        discussionId: word.discussionId || null,
        keywords: [],
        categories: [],
        metadata: {},
      }));

      // 5. Combine all nodes
      const allNodes = [categoryUniversal, ...wordNodes];

      // 6. Build COMPOSED_OF relationships (Category → Word)
      const relationships: UniversalRelationshipData[] = composedWords.map(
        (word) => ({
          id: `${categoryId}-composed_of-${word.word}`,
          source: categoryId,
          target: word.word,
          type: 'composed_of',
          strength: 1.0,
        }),
      );

      // 7. Use options if needed (for future user context enrichment)
      if (options.userId) {
        this.logger.debug(`User context available: ${options.userId}`);
      }

      // 8. Return in expansion format
      return {
        nodes: allNodes,
        relationships,
        performance_metrics: {
          node_count: allNodes.length,
          relationship_count: relationships.length,
          relationship_density:
            allNodes.length > 0 ? relationships.length / allNodes.length : 0,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting category with contents for graph: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Helper to convert Neo4j Integer to number
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && 'toNumber' in value) {
      return value.toNumber();
    }
    return 0;
  }
}
