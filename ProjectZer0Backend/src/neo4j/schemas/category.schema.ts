// src/neo4j/schemas/category.schema.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import type { VoteStatus, VoteResult } from './vote.schema';

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
export class CategorySchema {
  private readonly logger = new Logger(CategorySchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
  ) {}

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
        
        // Create the category node (inclusion voting only)
        CREATE (c:CategoryNode {
          id: $id,
          name: $name,
          description: $description,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          createdAt: datetime(),
          updatedAt: datetime(),
          // Inclusion voting only (no content voting)
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          visibilityStatus: true
        })
        
        // Create PARENT_OF relationship if parent provided
        WITH c, validWords, parent
        WHERE parent IS NOT NULL
        CREATE (parent)-[:PARENT_OF]->(c)
        
        // Create COMPOSED_OF relationships to words
        WITH c, validWords
        UNWIND validWords as word
        CREATE (c)-[:COMPOSED_OF]->(word)
        
        // Create CREATED relationship for user-created content
        WITH c, $createdBy as userId
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'category'
        }]->(c)
        
        // Create discussion node automatically
        WITH c
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (c)-[:HAS_DISCUSSION]->(d)
        
        // Create initial comment if provided
        WITH c, d, $initialComment as initialComment
        WHERE initialComment IS NOT NULL AND size(initialComment) > 0
        CREATE (comment:CommentNode {
          id: apoc.create.uuid(),
          createdBy: $createdBy,
          commentText: initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          visibilityStatus: true
        })
        CREATE (d)-[:HAS_COMMENT]->(comment)
        
        RETURN c
        `,
        {
          ...categoryData,
          description: categoryData.description || null,
          parentCategoryId: categoryData.parentCategoryId || null,
          initialComment: categoryData.initialComment || null,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create category - some words may not exist or have not passed inclusion threshold',
        );
      }

      const createdCategory = result.records[0].get('c').properties;
      this.logger.log(
        `Successfully created category with ID: ${createdCategory.id}`,
      );
      this.logger.debug(`Created category: ${JSON.stringify(createdCategory)}`);

      return createdCategory;
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

      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  async getCategory(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID cannot be empty');
      }

      this.logger.debug(`Retrieving category with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $id})
        
        // Get composed words
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        
        // Get parent category
        OPTIONAL MATCH (parent:CategoryNode)-[:PARENT_OF]->(c)
        
        // Get child categories
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
        
        // Get discussion
        OPTIONAL MATCH (c)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        // Get nodes categorized under this category
        OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(c)
        WHERE n:WordNode OR n:DefinitionNode OR n:OpenQuestionNode OR 
              n:AnswerNode OR n:StatementNode OR n:QuantityNode
        
        RETURN c,
               collect(DISTINCT {
                 id: w.id,
                 word: w.word,
                 inclusionNetVotes: w.inclusionNetVotes
               }) as composedWords,
               {
                 id: parent.id,
                 name: parent.name,
                 inclusionNetVotes: parent.inclusionNetVotes
               } as parentCategory,
               collect(DISTINCT {
                 id: child.id,
                 name: child.name,
                 inclusionNetVotes: child.inclusionNetVotes
               }) as childCategories,
               d.id as discussionId,
               count(DISTINCT n) as usageCount
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Category not found with ID: ${id}`);
        return null;
      }

      const record = result.records[0];
      const category = record.get('c').properties;
      const composedWords = record
        .get('composedWords')
        .filter((w: any) => w.id);
      const parentCategory = record.get('parentCategory');
      const childCategories = record
        .get('childCategories')
        .filter((c: any) => c.id);
      const discussionId = record.get('discussionId');
      const usageCount = record.get('usageCount');

      // Convert Neo4j integers
      [
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
      ].forEach((prop) => {
        if (category[prop] !== undefined) {
          category[prop] = this.toNumber(category[prop]);
        }
      });

      // Convert integers for related data
      composedWords.forEach((word: any) => {
        if (word.inclusionNetVotes !== undefined) {
          word.inclusionNetVotes = this.toNumber(word.inclusionNetVotes);
        }
      });

      if (parentCategory && parentCategory.id) {
        parentCategory.inclusionNetVotes = this.toNumber(
          parentCategory.inclusionNetVotes,
        );
      }

      childCategories.forEach((child: any) => {
        if (child.inclusionNetVotes !== undefined) {
          child.inclusionNetVotes = this.toNumber(child.inclusionNetVotes);
        }
      });

      const enrichedCategory = {
        ...category,
        composedWords,
        parentCategory: parentCategory.id ? parentCategory : null,
        childCategories,
        discussionId,
        usageCount: this.toNumber(usageCount),
      };

      this.logger.debug(`Retrieved category: ${category.name}`);
      return enrichedCategory;
    } catch (error) {
      this.logger.error(
        `Error retrieving category ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to get category: ${error.message}`);
    }
  }

  async updateCategory(
    id: string,
    updateData: {
      name?: string;
      description?: string;
      publicCredit?: boolean;
    },
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID cannot be empty');
      }

      this.logger.log(`Updating category: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      // Build dynamic update query
      const updateFields: string[] = [];
      const params: any = { id };

      if (updateData.name !== undefined) {
        updateFields.push('c.name = $name');
        params.name = updateData.name;
      }
      if (updateData.description !== undefined) {
        updateFields.push('c.description = $description');
        params.description = updateData.description;
      }
      if (updateData.publicCredit !== undefined) {
        updateFields.push('c.publicCredit = $publicCredit');
        params.publicCredit = updateData.publicCredit;
      }

      if (updateFields.length === 0) {
        throw new BadRequestException('No valid fields provided for update');
      }

      // Always update the updatedAt timestamp
      updateFields.push('c.updatedAt = datetime()');

      const query = `
        MATCH (c:CategoryNode {id: $id})
        SET ${updateFields.join(', ')}
        RETURN c
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      const updatedCategory = result.records[0].get('c').properties;

      // Convert Neo4j integers
      [
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
      ].forEach((prop) => {
        if (updatedCategory[prop] !== undefined) {
          updatedCategory[prop] = this.toNumber(updatedCategory[prop]);
        }
      });

      this.logger.log(`Successfully updated category: ${id}`);
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
      throw new Error(`Failed to update category: ${error.message}`);
    }
  }

  async deleteCategory(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID cannot be empty');
      }

      this.logger.log(`Deleting category: ${id}`);

      const result = await this.neo4jService.write(
        `
        MATCH (c:CategoryNode {id: $id})
        
        // Remove all relationships and associated discussion/comments
        OPTIONAL MATCH (c)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(comment:CommentNode)
        DETACH DELETE comment, d, c
        
        RETURN count(*) as deletedCount
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      this.logger.log(`Successfully deleted category: ${id}`);
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
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  // Category-specific methods

  /**
   * Get categories that are available for categorization (passed inclusion)
   */
  async getApprovedCategories(
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created' | 'votes' | 'usage';
      sortDirection?: 'asc' | 'desc';
      parentId?: string; // Filter by parent category
    } = {},
  ): Promise<any[]> {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'name',
        sortDirection = 'asc',
        parentId,
      } = options;

      this.logger.debug(
        `Getting approved categories with options: ${JSON.stringify(options)}`,
      );

      let query = `
        MATCH (c:CategoryNode)
        WHERE c.inclusionNetVotes > 0 
        AND (c.visibilityStatus <> false OR c.visibilityStatus IS NULL)
      `;

      // Add parent filter if specified
      if (parentId) {
        query += `
          AND EXISTS {
            MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c)
          }
        `;
      }

      // Get composed words and usage count
      query += `
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(c)
        
        WITH c, 
             collect(DISTINCT {id: w.id, word: w.word}) as composedWords,
             count(DISTINCT n) as usageCount
      `;

      // Add sorting
      if (sortBy === 'name') {
        query += ` ORDER BY c.name ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'created') {
        query += ` ORDER BY c.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'votes') {
        query += ` ORDER BY c.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'usage') {
        query += ` ORDER BY usageCount ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      if (limit !== null) {
        query += ` SKIP $offset LIMIT $limit`;
      }

      query += `
        RETURN {
          id: c.id,
          name: c.name,
          description: c.description,
          createdBy: c.createdBy,
          publicCredit: c.publicCredit,
          createdAt: c.createdAt,
          inclusionNetVotes: c.inclusionNetVotes,
          composedWords: composedWords,
          usageCount: usageCount
        } as category
      `;

      const result = await this.neo4jService.read(query, {
        offset,
        limit,
        parentId,
      });
      const categories = result.records.map((record) => {
        const category = record.get('category');
        // Convert Neo4j integers
        ['inclusionNetVotes', 'usageCount'].forEach((prop) => {
          if (category[prop] !== undefined) {
            category[prop] = this.toNumber(category[prop]);
          }
        });
        return category;
      });

      this.logger.debug(`Retrieved ${categories.length} approved categories`);
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting approved categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get approved categories: ${error.message}`);
    }
  }

  /**
   * Get nodes that are categorized under the given category
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
      const {
        nodeTypes,
        limit = 10,
        offset = 0,
        sortBy = 'created',
        sortDirection = 'desc',
      } = options;

      this.logger.debug(
        `Getting nodes using category ${categoryId} with options: ${JSON.stringify(options)}`,
      );

      let query = `
        MATCH (c:CategoryNode {id: $categoryId})
        MATCH (n)-[:CATEGORIZED_AS]->(c)
        WHERE (n.visibilityStatus <> false OR n.visibilityStatus IS NULL)
      `;

      // Add node type filter if specified
      if (nodeTypes && nodeTypes.length > 0) {
        const nodeLabels = nodeTypes
          .map((type) => {
            switch (type) {
              case 'statement':
                return 'StatementNode';
              case 'answer':
                return 'AnswerNode';
              case 'openquestion':
                return 'OpenQuestionNode';
              case 'quantity':
                return 'QuantityNode';
              default:
                return null;
            }
          })
          .filter(Boolean);

        if (nodeLabels.length > 0) {
          query += ` AND (${nodeLabels.map((label) => `n:${label}`).join(' OR ')})`;
        }
      }

      // Add sorting
      if (sortBy === 'created') {
        query += ` ORDER BY n.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'votes') {
        query += ` ORDER BY n.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'type') {
        query += ` ORDER BY labels(n)[0] ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      query += ` SKIP $offset LIMIT $limit`;

      query += `
        RETURN {
          id: n.id,
          type: labels(n)[0],
          content: CASE 
            WHEN n:StatementNode THEN n.statement
            WHEN n:AnswerNode THEN n.answerText
            WHEN n:OpenQuestionNode THEN n.questionText
            WHEN n:QuantityNode THEN n.question
            ELSE null
          END,
          createdBy: n.createdBy,
          publicCredit: n.publicCredit,
          createdAt: n.createdAt,
          inclusionNetVotes: n.inclusionNetVotes,
          contentNetVotes: COALESCE(n.contentNetVotes, 0)
        } as node
      `;

      const result = await this.neo4jService.read(query, {
        categoryId,
        offset,
        limit,
      });

      const nodes = result.records.map((record) => {
        const node = record.get('node');
        // Convert Neo4j integers
        ['inclusionNetVotes', 'contentNetVotes'].forEach((prop) => {
          if (node[prop] !== undefined) {
            node[prop] = this.toNumber(node[prop]);
          }
        });
        return node;
      });

      this.logger.debug(
        `Retrieved ${nodes.length} nodes using category ${categoryId}`,
      );
      return nodes;
    } catch (error) {
      this.logger.error(
        `Error getting nodes using category ${categoryId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get nodes using category: ${error.message}`);
    }
  }

  /**
   * Get all categories in the system
   */
  async getAllCategories(
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created' | 'votes';
      sortDirection?: 'asc' | 'desc';
      onlyApproved?: boolean;
    } = {},
  ) {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'name',
        sortDirection = 'asc',
        onlyApproved = false,
      } = options;

      this.logger.debug(
        `Getting all categories with options: ${JSON.stringify(options)}`,
      );

      let query = `
        MATCH (c:CategoryNode)
        WHERE c.visibilityStatus <> false OR c.visibilityStatus IS NULL
      `;

      // Add approval filter if requested
      if (onlyApproved) {
        query += ` AND c.inclusionNetVotes > 0`;
      }

      // Get composed words
      query += `
        OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
        
        WITH c, collect(DISTINCT {
          id: w.id,
          word: w.word
        }) as composedWords
      `;

      // Add sorting
      if (sortBy === 'name') {
        query += ` ORDER BY c.name ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'created') {
        query += ` ORDER BY c.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'votes') {
        query += ` ORDER BY c.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      if (limit !== null) {
        query += ` SKIP $offset LIMIT $limit`;
      }

      query += `
        RETURN {
          id: c.id,
          name: c.name,
          description: c.description,
          createdBy: c.createdBy,
          publicCredit: c.publicCredit,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          inclusionPositiveVotes: c.inclusionPositiveVotes,
          inclusionNegativeVotes: c.inclusionNegativeVotes,
          inclusionNetVotes: c.inclusionNetVotes,
          composedWords: composedWords
        } as category
      `;

      const result = await this.neo4jService.read(query, { offset, limit });
      const categories = result.records.map((record) => {
        const category = record.get('category');
        // Convert Neo4j integers
        [
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
        ].forEach((prop) => {
          if (category[prop] !== undefined) {
            category[prop] = this.toNumber(category[prop]);
          }
        });
        return category;
      });

      this.logger.debug(`Retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting all categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  /**
   * Get the hierarchical path for a category (from root to current)
   */
  async getCategoryPath(categoryId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting category path for ${categoryId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (c:CategoryNode {id: $categoryId})
        OPTIONAL MATCH path = (root:CategoryNode)-[:PARENT_OF*]->(c)
        WHERE NOT EXISTS((other:CategoryNode)-[:PARENT_OF]->(root))
        
        WITH c, path, 
             CASE WHEN path IS NOT NULL 
                  THEN nodes(path)
                  ELSE [c] 
             END as pathNodes
        
        RETURN [node IN pathNodes | {
          id: node.id,
          name: node.name,
          inclusionNetVotes: node.inclusionNetVotes
        }] as categoryPath
        `,
        { categoryId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const path = result.records[0].get('categoryPath');
      this.logger.debug(`Retrieved category path with ${path.length} levels`);
      return path;
    } catch (error) {
      this.logger.error(
        `Error getting category path: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get category path: ${error.message}`);
    }
  }

  /**
   * Get statistics for a category (usage, child count, etc.)
   */
  async getCategoryStats(categoryId: string) {
    try {
      if (!categoryId || categoryId.trim() === '') {
        throw new BadRequestException('Category ID cannot be empty');
      }

      this.logger.debug(`Getting stats for category: ${categoryId}`);

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
        return {
          contentCount: 0,
          childCount: 0,
          wordCount: 0,
          inclusionNetVotes: 0,
        };
      }

      const stats = result.records[0].get('stats');

      // Convert Neo4j integers
      ['contentCount', 'childCount', 'wordCount', 'inclusionNetVotes'].forEach(
        (prop) => {
          if (stats[prop] !== undefined) {
            stats[prop] = this.toNumber(stats[prop]);
          }
        },
      );

      this.logger.debug(`Retrieved stats for category ${categoryId}`);
      return stats;
    } catch (error) {
      this.logger.error(
        `Error getting category stats: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get category stats: ${error.message}`);
    }
  }

  // Voting methods (inclusion only)

  async voteCategoryInclusion(id: string, sub: string, isPositive: boolean) {
    try {
      this.logger.log(
        `Processing inclusion vote on category ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );
      return await this.voteSchema.vote(
        'CategoryNode',
        { id },
        sub,
        isPositive,
        'INCLUSION',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on category ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on category: ${error.message}`);
    }
  }

  async getCategoryVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      this.logger.debug(
        `Getting vote status for category ${id} by user ${sub}`,
      );
      return await this.voteSchema.getVoteStatus('CategoryNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error getting vote status for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get category vote status: ${error.message}`);
    }
  }

  async removeCategoryVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' = 'INCLUSION',
  ) {
    try {
      this.logger.log(
        `Removing ${kind} vote from category ${id} by user ${sub}`,
      );
      return await this.voteSchema.removeVote(
        'CategoryNode',
        { id },
        sub,
        kind,
      );
    } catch (error) {
      this.logger.error(
        `Error removing vote from category ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove category vote: ${error.message}`);
    }
  }

  async getCategoryVotes(id: string): Promise<VoteResult | null> {
    try {
      this.logger.debug(`Getting votes for category ${id}`);

      const voteStatus = await this.voteSchema.getVoteStatus(
        'CategoryNode',
        { id },
        '',
      );
      if (!voteStatus) {
        return null;
      }

      return {
        inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
        inclusionNetVotes: voteStatus.inclusionNetVotes,
        // Categories don't have content voting
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };
    } catch (error) {
      this.logger.error(
        `Error getting votes for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get category votes: ${error.message}`);
    }
  }

  // Visibility methods

  async setVisibilityStatus(id: string, isVisible: boolean) {
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
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated visibility for category: ${id}`);
      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for category ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to set category visibility: ${error.message}`);
    }
  }

  async getVisibilityStatus(id: string): Promise<boolean> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Category ID cannot be empty');
      }

      this.logger.debug(`Getting visibility status for category: ${id}`);

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

      const visibilityStatus =
        result.records[0].get('visibilityStatus') !== false ? true : false;
      this.logger.debug(
        `Visibility status for category ${id}: ${visibilityStatus}`,
      );

      return visibilityStatus;
    } catch (error) {
      this.logger.error(
        `Error getting visibility status for category ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to get visibility status: ${error.message}`);
    }
  }

  // NEW: DISCOVERY METHODS - Following established patterns

  /**
   * Get related content that shares categories with the given category
   * For categories, this finds content categorized AS this category plus sibling category content
   */
  async getRelatedContentBySharedCategories(
    categoryId: string,
    options: {
      nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
      limit?: number;
      offset?: number;
      sortBy?:
        | 'category_overlap'
        | 'created'
        | 'inclusion_votes'
        | 'content_votes';
      sortDirection?: 'asc' | 'desc';
      minCategoryOverlap?: number;
    } = {},
  ): Promise<any[]> {
    try {
      const {
        nodeTypes,
        limit = 10,
        offset = 0,
        sortBy = 'category_overlap',
        sortDirection = 'desc',
        minCategoryOverlap = 1,
      } = options;

      this.logger.debug(
        `Getting related content by shared categories for category ${categoryId}`,
      );

      // For categories, we find nodes that are categorized under this category
      // Plus nodes categorized under sibling categories (same parent)

      let query = `
        MATCH (current:CategoryNode {id: $categoryId})
        
        // Find nodes directly categorized under this category
        MATCH (related)-[:CATEGORIZED_AS]->(current)
        WHERE (related.visibilityStatus <> false OR related.visibilityStatus IS NULL)
      `;

      // Add node type filter if specified
      if (nodeTypes && nodeTypes.length > 0) {
        const nodeLabels = nodeTypes
          .map((type) => {
            switch (type) {
              case 'statement':
                return 'StatementNode';
              case 'answer':
                return 'AnswerNode';
              case 'openquestion':
                return 'OpenQuestionNode';
              case 'quantity':
                return 'QuantityNode';
              default:
                return null;
            }
          })
          .filter(Boolean);

        if (nodeLabels.length > 0) {
          query += ` AND (${nodeLabels.map((label) => `related:${label}`).join(' OR ')})`;
        }
      } else {
        query += ` AND (related:StatementNode OR related:AnswerNode OR related:OpenQuestionNode OR related:QuantityNode)`;
      }

      // Also find content from sibling categories
      query += `
        
        // Add content from sibling categories (same parent)
        OPTIONAL MATCH (parent:CategoryNode)-[:PARENT_OF]->(current)
        OPTIONAL MATCH (parent)-[:PARENT_OF]->(sibling:CategoryNode)
        WHERE sibling.id <> current.id
        OPTIONAL MATCH (siblingContent)-[:CATEGORIZED_AS]->(sibling)
        WHERE (siblingContent.visibilityStatus <> false OR siblingContent.visibilityStatus IS NULL)
      `;

      // Apply same node type filter for sibling content
      if (nodeTypes && nodeTypes.length > 0) {
        const nodeLabels = nodeTypes
          .map((type) => {
            switch (type) {
              case 'statement':
                return 'StatementNode';
              case 'answer':
                return 'AnswerNode';
              case 'openquestion':
                return 'OpenQuestionNode';
              case 'quantity':
                return 'QuantityNode';
              default:
                return null;
            }
          })
          .filter(Boolean);

        if (nodeLabels.length > 0) {
          query += ` AND (${nodeLabels.map((label) => `siblingContent:${label}`).join(' OR ')})`;
        }
      } else {
        query += ` AND (siblingContent:StatementNode OR siblingContent:AnswerNode OR siblingContent:OpenQuestionNode OR siblingContent:QuantityNode)`;
      }

      // Combine direct and sibling content
      query += `
        
        WITH current, 
             collect(DISTINCT related) + collect(DISTINCT siblingContent) as allRelated
        
        UNWIND allRelated as finalRelated
        WHERE finalRelated IS NOT NULL
      `;

      // Calculate category overlap and shared categories
      query += `
        
        // Calculate how many categories this content shares with our target category
        OPTIONAL MATCH (finalRelated)-[:CATEGORIZED_AS]->(sharedCat:CategoryNode)
        WITH finalRelated, current,
             count(DISTINCT sharedCat) as categoryOverlap,
             collect(DISTINCT sharedCat.name) as sharedCategories
        WHERE categoryOverlap >= $minCategoryOverlap
      `;

      // Add sorting
      if (sortBy === 'category_overlap') {
        query += ` ORDER BY categoryOverlap ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'created') {
        query += ` ORDER BY finalRelated.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'inclusion_votes') {
        query += ` ORDER BY finalRelated.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'content_votes') {
        query += ` ORDER BY COALESCE(finalRelated.contentNetVotes, 0) ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      query += ` SKIP $offset LIMIT $limit`;

      // Return structured data
      query += `
        RETURN {
          id: finalRelated.id,
          type: labels(finalRelated)[0],
          content: CASE 
            WHEN finalRelated:StatementNode THEN finalRelated.statement
            WHEN finalRelated:AnswerNode THEN finalRelated.answerText  
            WHEN finalRelated:OpenQuestionNode THEN finalRelated.questionText
            WHEN finalRelated:QuantityNode THEN finalRelated.question
            ELSE null
          END,
          createdBy: finalRelated.createdBy,
          publicCredit: finalRelated.publicCredit,
          createdAt: finalRelated.createdAt,
          inclusionNetVotes: finalRelated.inclusionNetVotes,
          contentNetVotes: COALESCE(finalRelated.contentNetVotes, 0),
          categoryOverlap: categoryOverlap,
          sharedCategories: sharedCategories
        } as relatedNode
      `;

      const result = await this.neo4jService.read(query, {
        categoryId,
        offset,
        limit,
        minCategoryOverlap,
      });

      const relatedNodes = result.records.map((record) => {
        const node = record.get('relatedNode');
        // Convert Neo4j integers
        ['inclusionNetVotes', 'contentNetVotes', 'categoryOverlap'].forEach(
          (prop) => {
            if (node[prop] !== undefined) {
              node[prop] = this.toNumber(node[prop]);
            }
          },
        );
        return node;
      });

      this.logger.debug(
        `Found ${relatedNodes.length} related nodes by shared categories for category ${categoryId}`,
      );
      return relatedNodes;
    } catch (error) {
      this.logger.error(
        `Error getting related content by shared categories for category ${categoryId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get related content: ${error.message}`);
    }
  }

  /**
   * Get all categories associated with a specific node
   * This is the reverse lookup - given any node ID, find what categories it belongs to
   */
  async getNodeCategories(nodeId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting categories for node ${nodeId}`);

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

      const categories = result.records[0].get('categories');

      // Convert Neo4j integers
      categories.forEach((category) => {
        if (category.inclusionNetVotes !== undefined) {
          category.inclusionNetVotes = this.toNumber(
            category.inclusionNetVotes,
          );
        }
      });

      this.logger.debug(
        `Retrieved ${categories.length} categories for node ${nodeId}`,
      );
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting node categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get node categories: ${error.message}`);
    }
  }

  /**
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'object' && value !== null) {
      if ('low' in value && typeof value.low === 'number') {
        return Number(value.low);
      } else if ('valueOf' in value && typeof value.valueOf === 'function') {
        return Number(value.valueOf());
      }
    }

    return Number(value);
  }
}
