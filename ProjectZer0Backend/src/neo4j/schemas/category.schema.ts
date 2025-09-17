// src/neo4j/schemas/category.schema.ts - CONVERTED TO BaseNodeSchema

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { Record } from 'neo4j-driver';

// Category-specific data interface extending BaseNodeData
export interface CategoryData extends BaseNodeData {
  name: string;
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  visibilityStatus?: boolean;
  wordCount?: number;
  contentCount?: number;
  childCount?: number;
  // Enhanced fields returned by getCategory()
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
  // Only inclusion voting supported for categories
}

export interface CategoryNodeData {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  publicCredit: boolean;
  wordIds: string[]; // 1-5 words that compose this category
  parentCategoryId?: string; // Optional parent category for hierarchy
  initialComment?: string;
}

@Injectable()
export class CategorySchema extends BaseNodeSchema<CategoryData> {
  protected readonly nodeLabel = 'CategoryNode';
  protected readonly idField = 'id'; // Categories use standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, CategorySchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return false; // Categories only support inclusion voting (like WordSchema, OpenQuestionSchema)
  }

  protected mapNodeFromRecord(record: Record): CategoryData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      visibilityStatus: props.visibilityStatus,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Only inclusion voting (no content voting)
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // Content voting disabled for categories
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
      // Additional category-specific fields
      wordCount: this.toNumber(props.wordCount),
      contentCount: this.toNumber(props.contentCount),
      childCount: this.toNumber(props.childCount),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<CategoryData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id') // Don't update the id field
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

  // CATEGORY-SPECIFIC METHODS - Keep all unique functionality

  async createCategory(categoryData: CategoryNodeData) {
    try {
      // Validate word count (1-5 words required)
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

      this.logger.log(`Creating category with ID: ${categoryData.id}`);
      this.logger.debug(`Category data: ${JSON.stringify(categoryData)}`);

      const result = await this.neo4jService.write(
        `
        // Validate that all words exist and have passed inclusion threshold
        WITH $wordIds as wordIds
        UNWIND wordIds as wordId
        MATCH (w:WordNode {id: wordId})
        WHERE w.inclusionNetVotes > 0 // Must have passed inclusion
        WITH collect(w) as validWords, wordIds
        
        // Ensure all words were found and passed inclusion
        WHERE size(validWords) = size(wordIds)
        
        // Validate parent category if provided (and prevent cycles)
        WITH validWords
        CALL {
          WITH $parentCategoryId as parentId
          WHERE parentId IS NOT NULL
          MATCH (parent:CategoryNode {id: parentId})
          WHERE parent.inclusionNetVotes > 0 // Parent must have passed inclusion
          
          // Prevent cycles: ensure parent is not a descendant of this category
          WITH parent
          OPTIONAL MATCH path = (parent)-[:PARENT_OF*]->(descendant:CategoryNode {id: $id})
          WHERE descendant IS NOT NULL
          WITH parent, path
          WHERE path IS NULL // No cycle detected
          
          RETURN parent
          UNION
          WITH $parentCategoryId as parentId
          WHERE parentId IS NULL
          RETURN NULL as parent
        }
        
        // Create the category node
        CREATE (c:CategoryNode {
          id: $id,
          name: $name,
          description: $description,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          initialComment: $initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          visibilityStatus: true,
          // Only inclusion voting for categories
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
        
        // Create relationships to words
        WITH c, validWords
        UNWIND validWords as word
        CREATE (c)-[:COMPOSED_OF]->(word)
        
        // Create parent relationship if parent exists
        WITH c, parent
        FOREACH (dummy IN CASE WHEN parent IS NOT NULL THEN [1] ELSE [] END |
          CREATE (parent)-[:PARENT_OF]->(c)
        )
        
        RETURN c
        `,
        {
          id: categoryData.id,
          name: categoryData.name,
          description: categoryData.description || '',
          createdBy: categoryData.createdBy,
          publicCredit: categoryData.publicCredit,
          initialComment: categoryData.initialComment || '',
          wordIds: categoryData.wordIds,
          parentCategoryId: categoryData.parentCategoryId,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'some words may not exist or have not passed inclusion threshold',
        );
      }

      const createdCategory = result.records[0].get('c').properties;
      this.logger.log(
        `Successfully created category with ID: ${createdCategory.id}`,
      );

      return createdCategory;
    } catch (error) {
      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );

      // Handle specific error cases
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message.includes('some words may not exist')) {
        throw new BadRequestException(
          'All words must exist and have passed inclusion threshold before being used in a category',
        );
      }

      throw this.standardError('create category', error);
    }
  }

  async getCategory(id: string): Promise<CategoryData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $id})
        
        // Get composed words
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        
        // Get parent category
        OPTIONAL MATCH (parent:CategoryNode)-[:PARENT_OF]->(c)
        
        // Get child categories
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
        
        // Get content count (statements, answers, etc. using this category)
        OPTIONAL MATCH (content)-[:CATEGORIZED_AS]->(c)
        WHERE content:StatementNode OR content:AnswerNode OR 
              content:OpenQuestionNode OR content:QuantityNode
        
        RETURN c,
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
      const category = record.get('c').properties;

      // Convert Neo4j integers to JavaScript numbers
      [
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
      ].forEach((prop) => {
        if (category[prop] !== undefined) {
          category[prop] = this.toNumber(category[prop]);
        }
      });

      // Add additional data
      category.words = (record.get('words') || []).filter((w) => w && w.id);
      category.parentCategory = record.get('parentCategory');
      category.childCategories = (record.get('childCategories') || []).filter(
        (c) => c && c.id,
      );
      category.contentCount = this.toNumber(record.get('contentCount'));

      return category;
    } catch (error) {
      this.logger.error(
        `Error getting category ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.standardError('retrieve category', error);
    }
  }

  /**
   * Get all categories with flexible filtering options
   * Enhanced method to support the CategoryService getCategories functionality
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

      // Build dynamic query
      let query = 'MATCH (c:CategoryNode)';
      const params: any = { offset, limit: limit || 1000 };

      // Add parent relationship if filtering by parent
      if (parentId) {
        query = `
          MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)
        `;
        params.parentId = parentId;
      }

      // Build WHERE conditions
      const whereConditions: string[] = [];

      // Visibility filter
      whereConditions.push(
        '(c.visibilityStatus = true OR c.visibilityStatus IS NULL)',
      );

      // Approval filter
      if (onlyApproved) {
        whereConditions.push('c.inclusionNetVotes > 0');
      }

      // Search query filter
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

      // Add WHERE clause if we have conditions
      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // Add sorting
      const sortField = this.getSortFieldForQuery(sortBy);
      query += `
        RETURN c as n
        ORDER BY ${sortField} ${sortDirection.toUpperCase()}
      `;

      // Add pagination
      if (limit) {
        query += ` SKIP $offset LIMIT $limit`;
      } else if (offset > 0) {
        query += ` SKIP $offset`;
      }

      this.logger.debug(`Executing getAllCategories query: ${query}`);

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
   * Helper method to map sort field names to database fields
   */
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

  async getCategoryStats(categoryId: string): Promise<any> {
    if (!categoryId || categoryId.trim() === '') {
      throw new BadRequestException('Category ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $categoryId})
        
        // Count nodes using this category
        OPTIONAL MATCH (content)-[:CATEGORIZED_AS]->(c)
        WHERE content:StatementNode OR content:AnswerNode OR 
              content:OpenQuestionNode OR content:QuantityNode
        
        // Count child categories
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
        
        // Count words composing this category
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

      // Convert Neo4j integers to JavaScript numbers
      Object.keys(stats).forEach((key) => {
        stats[key] = this.toNumber(stats[key]);
      });

      return stats;
    } catch (error) {
      this.logger.error(
        `Error getting category stats: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('get category stats', error);
    }
  }

  async getCategoriesForNode(nodeId: string): Promise<any[]> {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        // Find the node (could be any type)
        MATCH (node)
        WHERE node.id = $nodeId
        
        // Get all categories this node is categorized under
        MATCH (node)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
        // Get parent hierarchy for each category
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

      // Convert Neo4j integers to JavaScript numbers
      categories.forEach((cat) => {
        cat.inclusionNetVotes = this.toNumber(cat.inclusionNetVotes);
      });

      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting categories for node: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.standardError('get categories for node', error);
    }
  }

  // VISIBILITY MANAGEMENT METHODS

  async setVisibilityStatus(id: string, isVisible: boolean) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID cannot be empty');
    }

    try {
      this.logger.log(`Setting visibility for category ${id} to ${isVisible}`);

      const result = await this.neo4jService.write(
        `
        MATCH (c:CategoryNode {id: $id})
        SET c.visibilityStatus = $isVisible, c.updatedAt = datetime()
        RETURN c
        `,
        { id, isVisible },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      return result.records[0].get('c').properties;
    } catch (error) {
      this.logger.error(
        `Error setting visibility for category: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.standardError('set visibility status for category', error);
    }
  }

  async getVisibilityStatus(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Category ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $id})
        RETURN c.visibilityStatus as visibilityStatus
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      const visibilityStatus = result.records[0].get('visibilityStatus');
      return visibilityStatus !== null && visibilityStatus !== undefined
        ? visibilityStatus
        : true;
    } catch (error) {
      this.logger.error(
        `Error getting visibility status: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('get visibility status for category', error);
    }
  }

  // DISCOVERY AND HIERARCHY METHODS

  async getCategoryHierarchy(rootId?: string): Promise<any[]> {
    try {
      let query = `
        // Get root categories (no parents) or specific root
        MATCH (root:CategoryNode)
        WHERE root.inclusionNetVotes >= 0 // Include approved categories
      `;

      const params: any = {};
      if (rootId) {
        query += ` AND root.id = $rootId`;
        params.rootId = rootId;
      } else {
        query += ` AND NOT EXISTS((parent:CategoryNode)-[:PARENT_OF]->(root))`;
      }

      query += `
        // Get the full hierarchy tree
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
        hierarchy.children.forEach((child) => {
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

  async getApprovedCategories(): Promise<CategoryData[]> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode)
        WHERE c.inclusionNetVotes > 0 AND (c.visibilityStatus = true OR c.visibilityStatus IS NULL)
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

  // ✅ INHERITED FROM BaseNodeSchema (No need to implement):
  // - findById() -> replaces getCategory() for basic retrieval
  // - update() -> replaces updateCategory() for simple updates
  // - delete() -> replaces deleteCategory()
  // - voteInclusion() -> replaces voteCategoryInclusion()
  // - getVoteStatus() -> replaces getCategoryVoteStatus()
  // - removeVote() -> replaces removeCategoryVote()
  // - getVotes() -> replaces getCategoryVotes()
  // - Standard validation, error handling, Neo4j utilities

  // ❌ REMOVED METHODS (replaced by inherited BaseNodeSchema methods):
  // - voteCategoryInclusion() -> use voteInclusion()
  // - getCategoryVoteStatus() -> use getVoteStatus()
  // - removeCategoryVote() -> use removeVote()
  // - getCategoryVotes() -> use getVotes()

  // ✅ ENHANCED METHODS PRESERVED:
  // - createCategory(): Complex creation with word composition and hierarchy validation
  // - getCategory(): Enhanced retrieval with words, hierarchy, and content stats
  // - getCategoryStats(): Statistics for category usage and relationships
  // - getCategoriesForNode(): Find all categories for any node type
  // - setVisibilityStatus() / getVisibilityStatus(): Category visibility management
  // - getCategoryHierarchy(): Hierarchical category tree retrieval
  // - getApprovedCategories(): Discovery method for approved categories
  // - checkCategories(): Utility method for category counting
}
