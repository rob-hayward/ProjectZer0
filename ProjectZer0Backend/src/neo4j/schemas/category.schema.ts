// src/neo4j/schemas/category.schema.ts - CORRECTED & UPDATED

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { DiscussionSchema } from './discussion.schema';
import { UserSchema } from './user.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';

export interface CategoryData extends BaseNodeData {
  name: string;
  description?: string;
  wordCount?: number;
  contentCount?: number;
  childCount?: number;
  words?: Array<{
    id: string;
    word: string;
    inclusionNetVotes: number;
  }>;
  parentCategory?: {
    id: string;
    name: string;
  } | null;
  childCategories?: Array<{
    id: string;
    name: string;
    inclusionNetVotes: number;
  }>;
}

export interface CategoryNodeData {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  wordIds: string[];
  parentCategoryId?: string;
  initialComment?: string;
}

/**
 * Schema for CategoryNode - hierarchical categorization system.
 *
 * Extends: BaseNodeSchema (not CategorizedNodeSchema - special case)
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Inclusion voting only (no content voting)
 * - Self-categorizing: Every category has CATEGORIZED_AS relationship to itself
 * - Composed of: 1-5 approved WordNodes via COMPOSED_OF relationships
 * - Hierarchical: Can have parent/child categories via PARENT_OF relationships
 * - Has discussions (via injected DiscussionSchema)
 * - Tracks user creation (via injected UserSchema)
 *
 * Self-Categorization Pattern:
 * - Similar to WordNode self-tagging
 * - Ensures category appears in its own category-filtered datasets
 * - Safe: Categories only belong to themselves, never to other categories
 * - Pattern: (CategoryNode)-[:CATEGORIZED_AS]->(CategoryNode) [same node]
 * - Content counts exclude the self-reference to maintain accurate statistics
 *
 * IMPORTANT: Visibility is handled by VisibilityService, NOT by this schema
 */
@Injectable()
export class CategorySchema extends BaseNodeSchema<CategoryData> {
  protected readonly nodeLabel = 'CategoryNode';
  protected readonly idField = 'id';

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly discussionSchema: DiscussionSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, CategorySchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return false; // Categories only have inclusion voting
  }

  protected mapNodeFromRecord(record: Record): CategoryData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      name: props.name,
      description: props.description,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
      wordCount: this.toNumber(props.wordCount),
      contentCount: this.toNumber(props.contentCount),
      childCount: this.toNumber(props.childCount),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<CategoryData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id')
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:CategoryNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // ============================================
  // CATEGORY-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new category composed of 1-5 approved words.
   * Implements self-categorization pattern.
   */
  async createCategory(categoryData: CategoryNodeData): Promise<CategoryData> {
    try {
      // Validate word count
      if (
        !categoryData.wordIds ||
        categoryData.wordIds.length < 1 ||
        categoryData.wordIds.length > 5
      ) {
        throw new BadRequestException('Category must be composed of 1-5 words');
      }

      // Validate category name
      if (!categoryData.name || categoryData.name.trim() === '') {
        throw new BadRequestException('Category name cannot be empty');
      }

      this.logger.debug(`Creating category: ${categoryData.id}`);

      const result = await this.neo4jService.write(
        `
        WITH $wordIds as wordIds
        UNWIND wordIds as wordId
        MATCH (w:WordNode {id: wordId})
        WHERE w.inclusionNetVotes > 0
        WITH collect(w) as validWords, wordIds
        WHERE size(validWords) = size(wordIds)
        
        WITH validWords
        CALL {
          WITH $parentCategoryId as parentId
          WHERE parentId IS NOT NULL
          MATCH (parent:CategoryNode {id: parentId})
          WHERE parent.inclusionNetVotes > 0
          
          WITH parent
          OPTIONAL MATCH path = (parent)-[:PARENT_OF*]->(descendant:CategoryNode {id: $id})
          WHERE descendant IS NOT NULL
          WITH parent, path
          WHERE path IS NULL
          
          RETURN parent
          UNION
          WITH $parentCategoryId as parentId
          WHERE parentId IS NULL
          RETURN NULL as parent
        }
        
        CREATE (c:CategoryNode {
          id: $id,
          name: $name,
          description: $description,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
        
        WITH c, validWords, parent
        UNWIND validWords as word
        CREATE (c)-[:COMPOSED_OF]->(word)
        
        // Self-categorization: category belongs to itself
        WITH c, parent
        CREATE (c)-[:CATEGORIZED_AS]->(c)
        
        // Create parent relationship if specified
        WITH c, parent
        FOREACH (dummy IN CASE WHEN parent IS NOT NULL THEN [1] ELSE [] END |
          CREATE (parent)-[:PARENT_OF]->(c)
        )
        
        RETURN c as n
        `,
        {
          id: categoryData.id,
          name: categoryData.name,
          description: categoryData.description || '',
          createdBy: categoryData.createdBy,
          publicCredit: categoryData.publicCredit,
          wordIds: categoryData.wordIds,
          parentCategoryId: categoryData.parentCategoryId,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Some words may not exist or have not passed inclusion threshold',
        );
      }

      const createdCategory = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: categoryData.id,
          nodeType: this.nodeLabel,
          nodeIdField: 'id',
          createdBy: categoryData.createdBy,
          initialComment: categoryData.initialComment,
        });

      createdCategory.discussionId = discussionResult.discussionId;

      // Track user creation
      try {
        await this.userSchema.addCreatedNode(
          categoryData.createdBy,
          categoryData.id,
          'category',
        );
      } catch (error) {
        this.logger.warn(
          `Could not track user creation for category ${categoryData.id}: ${error.message}`,
        );
        // Non-blocking - continue even if tracking fails
      }

      this.logger.log(`Successfully created category: ${categoryData.id}`);
      return createdCategory;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error.message.includes('Some words may not exist') ||
        error.message.includes('some words may not exist')
      ) {
        throw new BadRequestException(
          'All words must exist and have passed inclusion threshold before being used in a category',
        );
      }

      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create category', error);
    }
  }

  /**
   * Gets a category with its composition, hierarchy, and content statistics
   */
  async getCategory(id: string): Promise<CategoryData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $id})
        OPTIONAL MATCH (c)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        OPTIONAL MATCH (parent:CategoryNode)-[:PARENT_OF]->(c)
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
        OPTIONAL MATCH (content)-[:CATEGORIZED_AS]->(c)
        WHERE (content:StatementNode OR content:AnswerNode OR 
               content:OpenQuestionNode OR content:QuantityNode OR
               content:EvidenceNode)
          AND content.id <> c.id  // Exclude self-categorization from content count
        
        RETURN c as n,
        disc.id as discussionId,
        collect(DISTINCT {
          id: w.id,
          word: w.word,
          inclusionNetVotes: w.inclusionNetVotes
        }) as words,
        CASE WHEN parent IS NOT NULL 
          THEN {id: parent.id, name: parent.name}
          ELSE null
        END as parentCategory,
        collect(DISTINCT {
          id: child.id,
          name: child.name,
          inclusionNetVotes: child.inclusionNetVotes
        }) as childCategories,
        count(DISTINCT content) as contentCount
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const category = this.mapNodeFromRecord(record);

      category.discussionId = record.get('discussionId');
      category.words = (record.get('words') || []).filter((w) => w && w.id);
      category.parentCategory = record.get('parentCategory');
      category.childCategories = (record.get('childCategories') || []).filter(
        (c) => c && c.id,
      );
      category.contentCount = this.toNumber(record.get('contentCount'));

      return category;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error retrieving category: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve category', error);
    }
  }

  /**
   * Gets all categories with optional filtering and sorting
   */
  async getAllCategories(
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created' | 'votes' | 'usage';
      sortDirection?: 'asc' | 'desc';
      onlyApproved?: boolean;
      parentId?: string;
      searchQuery?: string;
    } = {},
  ): Promise<CategoryData[]> {
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

      let query = 'MATCH (c:CategoryNode)';
      const params: any = { offset, limit: limit || 1000 };

      if (parentId) {
        query = `
          MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)
        `;
        params.parentId = parentId;
      }

      const whereConditions: string[] = [];

      if (onlyApproved) {
        whereConditions.push('c.inclusionNetVotes > 0');
      }

      if (searchQuery) {
        whereConditions.push(`
          (toLower(c.name) CONTAINS toLower($searchQuery) 
           OR toLower(c.description) CONTAINS toLower($searchQuery) 
           OR EXISTS {
             MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
             WHERE toLower(w.word) CONTAINS toLower($searchQuery)
           })
        `);
        params.searchQuery = searchQuery;
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      const sortField = this.getSortFieldForQuery(sortBy);
      query += `
        RETURN c as n
        ORDER BY ${sortField} ${sortDirection.toUpperCase()}
      `;

      if (limit) {
        query += ` SKIP $offset LIMIT $limit`;
      } else if (offset > 0) {
        query += ` SKIP $offset`;
      }

      const result = await this.neo4jService.read(query, params);
      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting all categories: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get all categories', error);
    }
  }

  /**
   * Gets approved categories (passed inclusion threshold)
   */
  async getApprovedCategories(): Promise<CategoryData[]> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode)
        WHERE c.inclusionNetVotes > 0
        RETURN c as n
        ORDER BY c.inclusionNetVotes DESC, c.name ASC
        `,
        {},
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting approved categories: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get approved categories', error);
    }
  }

  /**
   * Gets detailed statistics for a category
   */
  async getCategoryStats(categoryId: string): Promise<{
    contentCount: number;
    childCount: number;
    wordCount: number;
    inclusionNetVotes: number;
  }> {
    if (!categoryId || categoryId.trim() === '') {
      throw new BadRequestException('Category ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $categoryId})
        
        OPTIONAL MATCH (content)-[:CATEGORIZED_AS]->(c)
        WHERE (content:StatementNode OR content:AnswerNode OR 
               content:OpenQuestionNode OR content:QuantityNode OR
               content:EvidenceNode)
          AND content.id <> c.id  // Exclude self from content count
        
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        
        RETURN {
          contentCount: count(DISTINCT content),
          childCount: count(DISTINCT child),
          wordCount: count(DISTINCT w),
          inclusionNetVotes: c.inclusionNetVotes
        } as stats
        `,
        { categoryId },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      const stats = result.records[0].get('stats');

      // Convert Neo4j integers to numbers
      return {
        contentCount: this.toNumber(stats.contentCount),
        childCount: this.toNumber(stats.childCount),
        wordCount: this.toNumber(stats.wordCount),
        inclusionNetVotes: this.toNumber(stats.inclusionNetVotes),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting category stats: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get category stats', error);
    }
  }

  /**
   * Gets all categories associated with a specific node
   */
  async getCategoriesForNode(nodeId: string): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      inclusionNetVotes: number;
      path: Array<{ id: string; name: string }>;
    }>
  > {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (node)
        WHERE node.id = $nodeId
        
        MATCH (node)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
        OPTIONAL MATCH path = (root:CategoryNode)-[:PARENT_OF*]->(c)
        WHERE NOT EXISTS((other:CategoryNode)-[:PARENT_OF]->(root))
        
        RETURN collect({
          id: c.id,
          name: c.name,
          description: c.description,
          inclusionNetVotes: c.inclusionNetVotes,
          path: CASE 
            WHEN path IS NOT NULL 
            THEN [node IN nodes(path) | {id: node.id, name: node.name}]
            ELSE [{id: c.id, name: c.name}]
          END
        }) as categories
        `,
        { nodeId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const categories = result.records[0].get('categories') || [];

      // Convert Neo4j integers
      categories.forEach((cat: any) => {
        cat.inclusionNetVotes = this.toNumber(cat.inclusionNetVotes);
      });

      return categories;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for node: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get categories for node', error);
    }
  }

  /**
   * Gets the category hierarchy starting from root categories or a specific category
   */
  async getCategoryHierarchy(rootId?: string): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      inclusionNetVotes: number;
      children: Array<{
        id: string;
        name: string;
        description?: string;
        inclusionNetVotes: number;
      }>;
    }>
  > {
    try {
      let query = `
        MATCH (root:CategoryNode)
        WHERE root.inclusionNetVotes >= 0
      `;

      const params: any = {};
      if (rootId) {
        query += ` AND root.id = $rootId`;
        params.rootId = rootId;
      } else {
        query += ` AND NOT EXISTS((parent:CategoryNode)-[:PARENT_OF]->(root))`;
      }

      query += `
        OPTIONAL MATCH path = (root)-[:PARENT_OF*]->(descendant:CategoryNode)
        WHERE descendant.inclusionNetVotes >= 0
        
        WITH root, collect(DISTINCT descendant) as descendants
        
        RETURN {
          id: root.id,
          name: root.name,
          description: root.description,
          inclusionNetVotes: root.inclusionNetVotes,
          children: [d IN descendants | {
            id: d.id,
            name: d.name,
            description: d.description,
            inclusionNetVotes: d.inclusionNetVotes
          }]
        } as hierarchy
        ORDER BY root.inclusionNetVotes DESC, root.name ASC
      `;

      const result = await this.neo4jService.read(query, params);

      const hierarchies = result.records.map((record) => {
        const hierarchy = record.get('hierarchy');
        hierarchy.inclusionNetVotes = this.toNumber(
          hierarchy.inclusionNetVotes,
        );
        hierarchy.children.forEach((child: any) => {
          child.inclusionNetVotes = this.toNumber(child.inclusionNetVotes);
        });
        return hierarchy;
      });

      return hierarchies;
    } catch (error) {
      this.logger.error(
        `Error getting category hierarchy: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get category hierarchy', error);
    }
  }

  /**
   * Gets total category count
   */
  async checkCategories(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (c:CategoryNode) RETURN count(c) as count',
        {},
      );

      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      this.logger.error(
        `Error checking categories: ${error.message}`,
        error.stack,
      );
      throw this.standardError('check categories', error);
    }
  }

  /**
   * Checks if a word is available for category composition
   * (exists and has passed inclusion threshold)
   */
  async isWordAvailableForCategoryComposition(
    wordId: string,
  ): Promise<boolean> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {id: $wordId})
        RETURN w.inclusionNetVotes as inclusionNetVotes
        `,
        { wordId },
      );

      if (!result.records || result.records.length === 0) {
        return false;
      }

      const inclusionNetVotes = this.toNumber(
        result.records[0].get('inclusionNetVotes'),
      );

      return VotingUtils.hasPassedInclusion(inclusionNetVotes);
    } catch {
      return false;
    }
  }

  /**
   * Checks if multiple words are available for category composition
   * Useful for validating before category creation
   */
  async validateWordsForComposition(wordIds: string[]): Promise<{
    valid: boolean;
    invalidWords: string[];
    message?: string;
  }> {
    if (!wordIds || wordIds.length < 1 || wordIds.length > 5) {
      return {
        valid: false,
        invalidWords: [],
        message: 'Must provide 1-5 word IDs',
      };
    }

    try {
      const result = await this.neo4jService.read(
        `
        UNWIND $wordIds as wordId
        MATCH (w:WordNode {id: wordId})
        WHERE w.inclusionNetVotes > 0
        RETURN collect(w.id) as validWords
        `,
        { wordIds },
      );

      const validWords = result.records[0]?.get('validWords') || [];
      const invalidWords = wordIds.filter((id) => !validWords.includes(id));

      if (invalidWords.length > 0) {
        return {
          valid: false,
          invalidWords,
          message: `The following words are not available: ${invalidWords.join(', ')}`,
        };
      }

      return {
        valid: true,
        invalidWords: [],
      };
    } catch (error) {
      this.logger.error(
        `Error validating words for composition: ${error.message}`,
      );
      return {
        valid: false,
        invalidWords: wordIds,
        message: 'Error validating words',
      };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private getSortFieldForQuery(sortBy: string): string {
    switch (sortBy) {
      case 'votes':
        return 'c.inclusionNetVotes';
      case 'created':
        return 'c.createdAt';
      case 'usage':
        return 'c.contentCount';
      case 'name':
      default:
        return 'c.name';
    }
  }
}
