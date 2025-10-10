// src/neo4j/schemas/category.schema.ts - CORRECTED FOR AUTO-GENERATED NAMES

import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { DiscussionSchema } from './discussion.schema';
import { UserSchema } from './user.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { Record } from 'neo4j-driver';

export interface CategoryData extends BaseNodeData {
  name: string; // Auto-generated from constituent words
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

// Input data for creating a category - name is NOT provided by user
export interface CategoryNodeData {
  id: string;
  wordIds: string[]; // 1-5 word IDs - name will be auto-generated from these
  parentCategoryId?: string;
  createdBy: string;
  publicCredit: boolean;
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
 * - **Name is auto-generated** from constituent words (e.g., "word category")
 * - **No description field** (definitions already exist on words)
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
      name: props.name, // Auto-generated during creation
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
      .filter((key) => key !== 'id' && key !== 'name') // Name cannot be updated manually
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
   * Name is auto-generated from constituent words.
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

      this.logger.debug(
        `Creating category with word IDs: ${categoryData.wordIds.join(', ')}`,
      );

      const result = await this.neo4jService.write(
        `
        WITH $wordIds as wordIds
        UNWIND wordIds as wordId
        MATCH (w:WordNode {word: wordId})
        WHERE w.inclusionNetVotes > 0
        WITH collect(w) as validWords, wordIds
        WHERE size(validWords) = size(wordIds)
        
        // Generate category name from constituent words
        WITH validWords, [word IN validWords | word.word] as wordStrings
        WITH validWords, apoc.text.join(wordStrings, ' ') as generatedName
        
        WITH validWords, generatedName
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
          name: generatedName,
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
          createdBy: categoryData.createdBy,
          publicCredit: categoryData.publicCredit,
          wordIds: categoryData.wordIds,
          parentCategoryId: categoryData.parentCategoryId || null, // ← Explicitly pass null
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
          `Failed to track user creation for category ${categoryData.id}: ${error.message}`,
        );
      }

      this.logger.debug(
        `Successfully created category with auto-generated name: ${createdCategory.name}`,
      );

      return createdCategory;
    } catch (error) {
      this.logger.error(
        `Failed to create category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get category by ID with full details
   */
  async getCategory(id: string): Promise<CategoryData | null> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $id})
        
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        WITH c, collect({
          id: w.id,
          word: w.word,
          inclusionNetVotes: w.inclusionNetVotes
        }) as words
        
        OPTIONAL MATCH (parent:CategoryNode)-[:PARENT_OF]->(c)
        WITH c, words, parent
        
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
        WITH c, words, parent, collect({
          id: child.id,
          name: child.name,
          inclusionNetVotes: child.inclusionNetVotes
        }) as children
        
        RETURN c as n, words, 
               CASE WHEN parent IS NOT NULL THEN {id: parent.id, name: parent.name} ELSE null END as parentCategory,
               children as childCategories
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const category = this.mapNodeFromRecord(record);
      category.words = record.get('words');
      category.parentCategory = record.get('parentCategory');
      category.childCategories = record.get('childCategories');

      return category;
    } catch (error) {
      this.logger.error(`Failed to get category ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get category hierarchy
   * Returns tree structure of categories
   */
  async getCategoryHierarchy(rootId?: string): Promise<CategoryData[]> {
    try {
      const query = rootId
        ? `
          MATCH (root:CategoryNode {id: $rootId})
          WHERE root.inclusionNetVotes > 0
          OPTIONAL MATCH path = (root)-[:PARENT_OF*]->(descendant:CategoryNode)
          WHERE descendant.inclusionNetVotes > 0
          WITH collect(DISTINCT root) + collect(DISTINCT descendant) as categories
          UNWIND categories as c
          RETURN DISTINCT c as n
          ORDER BY c.name
          `
        : `
          MATCH (c:CategoryNode)
          WHERE c.inclusionNetVotes > 0
          RETURN c as n
          ORDER BY c.name
          `;

      const result = await this.neo4jService.read(query, { rootId });

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(`Failed to get category hierarchy: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all categories a node belongs to
   */
  async getCategoriesForNode(nodeId: string): Promise<CategoryData[]> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (node {id: $nodeId})-[:CATEGORIZED_AS]->(c:CategoryNode)
        WHERE c.inclusionNetVotes > 0
        RETURN c as n
        ORDER BY c.inclusionNetVotes DESC, c.name
        `,
        { nodeId },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Failed to get categories for node ${nodeId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all categories (for admin/overview)
   */
  async getAllCategories(): Promise<CategoryData[]> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode)
        RETURN c as n
        ORDER BY c.name
        `,
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(`Failed to get all categories: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get approved categories (passed inclusion threshold)
   */
  async getApprovedCategories(): Promise<CategoryData[]> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode)
        WHERE c.inclusionNetVotes > 0
        RETURN c as n
        ORDER BY c.inclusionNetVotes DESC, c.name
        `,
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(`Failed to get approved categories: ${error.message}`);
      throw error;
    }
  }
}
