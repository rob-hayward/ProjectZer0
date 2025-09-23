// src/neo4j/schemas/base/taggable-categorizable.schema.ts

import { Injectable } from '@nestjs/common';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { Neo4jQueryBuilder } from '../utils/query-builder.util';
import { NodeValidators } from '../utils/validators.util';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import { Record } from 'neo4j-driver';

/**
 * Extended base node data interface for nodes that support tagging and categorization
 */
export interface TaggableCategorizableNodeData extends BaseNodeData {
  keywords?: KeywordWithFrequency[];
  categories?: Array<{
    id: string;
    name: string;
    description?: string;
    inclusionNetVotes?: number;
  }>;
  relatedNodes?: Array<{
    id: string;
    sharedWord?: string;
    strength?: number;
  }>;
}

/**
 * Input data structure for creating taggable/categorizable nodes
 */
export interface TaggableCreateData {
  id: string;
  createdBy: string;
  publicCredit: boolean;
  categoryIds?: string[];
  keywords?: KeywordWithFrequency[];
  parentId?: string;
  parentType?: string;
  parentRelationship?: string;
  nodeProperties: { [key: string]: any };
}

/**
 * Input data structure for updating taggable/categorizable nodes
 */
export interface TaggableUpdateData {
  categoryIds?: string[];
  keywords?: KeywordWithFrequency[];
  [key: string]: any;
}

/**
 * Filter options for graph queries
 */
export interface GraphFilters {
  // Keyword filters
  keywords?: {
    mode: 'any' | 'all' | 'exact';
    values: string[];
  };

  // Category filters
  categories?: {
    mode: 'any' | 'all' | 'exact';
    values: string[];
  };

  // User filters
  user?: {
    mode: 'created' | 'interacted';
    userId: string;
  };

  // Voting threshold
  minInclusionVotes?: number;

  // Sorting
  sortBy?: 'inclusionNetVotes' | 'createdAt' | 'totalVotes';
  sortDirection?: 'ASC' | 'DESC';

  // Pagination
  limit?: number;
  offset?: number;

  // Include special nodes
  includeWordNodes?: boolean;
  includeCategoryNodes?: boolean;
}

/**
 * Graph node structure for D3 visualization
 */
export interface GraphNode {
  id: string;
  type: string; // Node label
  data: any; // Full node data
  metadata: {
    inclusionVotes: number;
    totalVotes: number;
    hasDiscussion: boolean;
    createdAt: string;
  };
}

/**
 * Graph edge structure for D3 visualization
 */
export interface GraphEdge {
  source: string;
  target: string;
  type: 'SHARED_TAG' | 'SHARED_CATEGORY' | 'PARENT_CHILD';
  weight: number;
  metadata?: {
    sharedWord?: string;
    categoryId?: string;
    categoryName?: string;
  };
}

/**
 * Abstract base schema for nodes that support both keyword tagging and categorization.
 * Extends BaseNodeSchema to provide standardized implementation for:
 * - Keyword/tagging relationships (TAGGED, SHARED_TAG)
 * - Category relationships (CATEGORIZED_AS, SHARED_CATEGORY)
 * - Complex creation and update queries with these relationships
 * - Graph visualization queries
 *
 * Used by: StatementSchema, OpenQuestionSchema, AnswerSchema, QuantitySchema, EvidenceSchema
 */
@Injectable()
export abstract class TaggableCategorizableNodeSchema<
  T extends TaggableCategorizableNodeData = TaggableCategorizableNodeData,
> extends BaseNodeSchema<T> {
  /**
   * Maximum number of categories allowed per node (can be overridden by subclasses)
   */
  protected readonly maxCategories: number = 3;

  /**
   * Whether to validate that keywords exist and have passed inclusion threshold
   */
  protected readonly validateKeywordInclusion: boolean = true;

  /**
   * Build the complete creation query including categories and keywords
   */
  protected buildTaggableCreateQuery(nodeData: TaggableCreateData): {
    query: string;
    params: { [key: string]: any };
  } {
    const queryParts: string[] = [];
    const params: { [key: string]: any } = {
      id: nodeData.id,
      createdBy: nodeData.createdBy,
      publicCredit: nodeData.publicCredit,
      ...nodeData.nodeProperties,
    };

    // 1. Validate parent if needed
    if (nodeData.parentId && nodeData.parentType) {
      queryParts.push(`
        MATCH (parent:${nodeData.parentType} {id: $parentId})
        WHERE parent.inclusionNetVotes > 0
      `);
      params.parentId = nodeData.parentId;
    }

    // 2. Create the main node with voting fields
    queryParts.push(
      Neo4jQueryBuilder.createNodeWithVoting(
        this.nodeLabel,
        Object.keys(nodeData.nodeProperties),
        this.supportsContentVoting(),
      ),
    );

    // 3. Create parent relationship if specified
    if (nodeData.parentId && nodeData.parentRelationship) {
      queryParts.push(`
        CREATE (n)-[:${nodeData.parentRelationship}]->(parent)
      `);
    }

    // 4. Attach categories if provided
    if (nodeData.categoryIds && nodeData.categoryIds.length > 0) {
      queryParts.push(Neo4jQueryBuilder.attachCategories(this.maxCategories));

      // Create SHARED_CATEGORY relationships for efficient graph queries
      queryParts.push(Neo4jQueryBuilder.createSharedCategories(this.nodeLabel));

      params.categoryIds = nodeData.categoryIds;
    }

    // 5. Attach keywords if provided
    if (nodeData.keywords && nodeData.keywords.length > 0) {
      queryParts.push(
        Neo4jQueryBuilder.attachKeywords(this.validateKeywordInclusion),
      );
      queryParts.push(Neo4jQueryBuilder.createSharedTags(this.nodeLabel));
      params.keywords = nodeData.keywords;
    }

    // 6. Create user relationship for tracking
    queryParts.push(`
      WITH n, $createdBy as userId
      MATCH (u:User {sub: userId})
      CREATE (u)-[:CREATED {
        createdAt: datetime(),
        type: '${this.getNodeTypeName().toLowerCase()}'
      }]->(n)
    `);

    queryParts.push('RETURN n');

    return {
      query: queryParts.join('\n'),
      params,
    };
  }

  /**
   * Build the complete update query including categories and keywords
   */
  protected buildTaggableUpdateQuery(
    id: string,
    updateData: TaggableUpdateData,
  ): { query: string; params: { [key: string]: any } } {
    const queryParts: string[] = [];
    const params: { [key: string]: any } = { id };

    // Extract simple properties (not categories or keywords)
    const simpleProperties = Object.fromEntries(
      Object.entries(updateData).filter(
        ([key]) => key !== 'categoryIds' && key !== 'keywords' && key !== 'id',
      ),
    );

    // 1. Update basic properties
    queryParts.push(`
      MATCH (n:${this.nodeLabel} {${this.idField}: $id})
      SET n += $updateProperties, n.updatedAt = datetime()
    `);
    params.updateProperties = simpleProperties;

    // 2. Handle category updates
    if (updateData.categoryIds !== undefined) {
      queryParts.push(
        Neo4jQueryBuilder.deleteRelationships([
          'CATEGORIZED_AS',
          'SHARED_CATEGORY',
        ]),
      );

      if (updateData.categoryIds.length > 0) {
        queryParts.push(Neo4jQueryBuilder.attachCategories(this.maxCategories));

        // Re-create SHARED_CATEGORY relationships
        queryParts.push(
          Neo4jQueryBuilder.createSharedCategories(this.nodeLabel),
        );

        params.categoryIds = updateData.categoryIds;
      }
    }

    // 3. Handle keyword updates
    if (updateData.keywords !== undefined) {
      queryParts.push(
        Neo4jQueryBuilder.deleteRelationships(['TAGGED', 'SHARED_TAG']),
      );

      if (updateData.keywords.length > 0) {
        queryParts.push(
          Neo4jQueryBuilder.attachKeywords(this.validateKeywordInclusion),
        );
        queryParts.push(Neo4jQueryBuilder.createSharedTags(this.nodeLabel));
        params.keywords = updateData.keywords;
      }
    }

    queryParts.push('WITH n RETURN n');

    return {
      query: queryParts.join('\n'),
      params,
    };
  }

  /**
   * Enhanced retrieval query that includes categories and keywords
   */
  protected buildTaggableRetrievalQuery(id: string): {
    query: string;
    params: { [key: string]: any };
  } {
    const query = `
      MATCH (n:${this.nodeLabel} {${this.idField}: $id})
      
      // Get discussion
      OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      
      // Get categories
      OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode)
      
      // Get keywords
      OPTIONAL MATCH (n)-[t:TAGGED]->(w:WordNode)
      
      // Get related nodes through shared tags
      OPTIONAL MATCH (n)-[st:SHARED_TAG]->(related)
      WHERE labels(related) = labels(n)
      
      RETURN n,
        d.id as discussionId,
        collect(DISTINCT {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          inclusionNetVotes: cat.inclusionNetVotes
        }) as categories,
        collect(DISTINCT {
          word: w.word,
          frequency: t.frequency,
          source: t.source
        }) as keywords,
        collect(DISTINCT {
          id: related.id,
          sharedWord: st.word,
          strength: st.strength
        }) as relatedNodes
    `;

    return {
      query,
      params: { id },
    };
  }

  /**
   * Standard validation for nodes with categories and keywords
   */
  protected validateTaggableCreation(data: {
    id?: string;
    createdBy?: string;
    categoryIds?: string[];
    keywords?: KeywordWithFrequency[];
    mainText?: string;
    mainTextFieldName?: string;
    maxTextLength?: number;
  }): void {
    // Use centralized validators
    NodeValidators.validateNodeCreation({
      id: data.id,
      createdBy: data.createdBy,
      categoryIds: data.categoryIds,
      maxCategories: this.maxCategories,
      text: data.mainText,
      textFieldName: data.mainTextFieldName,
      maxTextLength: data.maxTextLength,
    });
  }

  /**
   * Override the base mapNodeFromRecord to include categories and keywords
   */
  protected mapTaggableNodeFromRecord(
    record: Record,
    includeRelatedData: boolean = true,
  ): T {
    // Get the base mapping from the subclass
    const baseNode = this.mapNodeFromRecord(record);

    if (includeRelatedData && record.get) {
      // Try to get additional taggable/categorizable data if available
      try {
        const categories = record.get('categories');
        const keywords = record.get('keywords');
        const relatedNodes = record.get('relatedNodes');
        const discussionId = record.get('discussionId');

        return {
          ...baseNode,
          discussionId: discussionId || baseNode.discussionId,
          categories: categories
            ? categories.filter((c: any) => c && c.id)
            : [],
          keywords: keywords ? keywords.filter((k: any) => k && k.word) : [],
          relatedNodes: relatedNodes
            ? relatedNodes.filter((r: any) => r && r.id)
            : [],
        };
      } catch {
        // If the additional fields aren't available, just return the base node
        return baseNode;
      }
    }

    return baseNode;
  }

  /**
   * Get nodes that share categories with the given node
   */
  async getRelatedNodesByCategories(
    nodeId: string,
    limit: number = 10,
  ): Promise<Array<{ node: T; sharedCategoryCount: number }>> {
    try {
      this.validateId(nodeId);

      const result = await this.neo4jService.read(
        `
        MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})-[:CATEGORIZED_AS]->(cat:CategoryNode)
        MATCH (related:${this.nodeLabel})-[:CATEGORIZED_AS]->(cat)
        WHERE related.${this.idField} <> $nodeId
        
        WITH related, COUNT(DISTINCT cat) as sharedCategoryCount
        
        RETURN related as n, sharedCategoryCount
        ORDER BY sharedCategoryCount DESC, related.inclusionNetVotes DESC
        LIMIT $limit
        `,
        { nodeId, limit },
      );

      return result.records.map((record) => ({
        node: this.mapNodeFromRecord(record),
        sharedCategoryCount: this.toNumber(record.get('sharedCategoryCount')),
      }));
    } catch (error) {
      this.logger.error(
        `Error getting related nodes by categories: ${error.message}`,
      );
      throw this.standardError('get related nodes by categories', error);
    }
  }

  /**
   * Get nodes that share keywords with the given node
   */
  async getRelatedNodesByKeywords(
    nodeId: string,
    limit: number = 10,
  ): Promise<
    Array<{ node: T; sharedKeywords: string[]; totalStrength: number }>
  > {
    try {
      this.validateId(nodeId);

      const result = await this.neo4jService.read(
        `
        MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})-[st:SHARED_TAG]->(related:${this.nodeLabel})
        
        WITH related, 
             collect(DISTINCT st.word) as sharedKeywords,
             SUM(st.strength) as totalStrength
        
        RETURN related as n, sharedKeywords, totalStrength
        ORDER BY totalStrength DESC, SIZE(sharedKeywords) DESC
        LIMIT $limit
        `,
        { nodeId, limit },
      );

      return result.records.map((record) => ({
        node: this.mapNodeFromRecord(record),
        sharedKeywords: record.get('sharedKeywords'),
        totalStrength: this.toNumber(record.get('totalStrength')),
      }));
    } catch (error) {
      this.logger.error(
        `Error getting related nodes by keywords: ${error.message}`,
      );
      throw this.standardError('get related nodes by keywords', error);
    }
  }

  /**
   * Get nodes for graph visualization with comprehensive filters
   * This is the main method for retrieving nodes for D3 graph display
   */
  async getNodesForGraphWithFilters(
    filters: GraphFilters = {},
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    try {
      const { query, params } = this.buildGraphFilterQuery(filters);
      const result = await this.neo4jService.read(query, params);

      const nodes: GraphNode[] = [];
      const edges: Map<string, GraphEdge> = new Map();
      const nodeIds: Set<string> = new Set();

      // Process results
      result.records.forEach((record) => {
        const node = record.get('n');
        const nodeId = node.properties[this.idField];

        // Add main node
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          nodes.push({
            id: nodeId,
            type: this.nodeLabel,
            data: this.mapNodeFromRecord(record),
            metadata: {
              inclusionVotes: this.toNumber(node.properties.inclusionNetVotes),
              totalVotes:
                this.toNumber(node.properties.inclusionPositiveVotes || 0) +
                this.toNumber(node.properties.inclusionNegativeVotes || 0),
              hasDiscussion: record.get('hasDiscussion') || false,
              createdAt: node.properties.createdAt,
            },
          });
        }

        // Process shared tag relationships
        const sharedTagNodes = record.get('sharedTagNodes') || [];
        sharedTagNodes.forEach((related: any) => {
          if (related && nodeIds.has(related.properties[this.idField])) {
            const edgeKey = `${nodeId}-ST-${related.properties[this.idField]}`;
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, {
                source: nodeId,
                target: related.properties[this.idField],
                type: 'SHARED_TAG',
                weight: record.get('tagStrength') || 1,
              });
            }
          }
        });

        // Process shared category relationships
        const sharedCategoryNodes = record.get('sharedCategoryNodes') || [];
        sharedCategoryNodes.forEach((related: any) => {
          if (related && nodeIds.has(related.properties[this.idField])) {
            const edgeKey = `${nodeId}-SC-${related.properties[this.idField]}`;
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, {
                source: nodeId,
                target: related.properties[this.idField],
                type: 'SHARED_CATEGORY',
                weight: record.get('categoryStrength') || 1,
              });
            }
          }
        });
      });

      return {
        nodes,
        edges: Array.from(edges.values()),
      };
    } catch (error) {
      this.logger.error(
        `Error getting graph nodes with filters: ${error.message}`,
      );
      throw this.standardError('get graph nodes', error);
    }
  }

  /**
   * Build comprehensive filter query for graph visualization
   */
  protected buildGraphFilterQuery(filters: GraphFilters): {
    query: string;
    params: { [key: string]: any };
  } {
    const queryParts: string[] = [];
    const params: { [key: string]: any } = {};

    // Start with main node match
    queryParts.push(`MATCH (n:${this.nodeLabel})`);

    // Add user filter if specified
    if (filters.user) {
      if (filters.user.mode === 'created') {
        queryParts.push(`MATCH (u:User {sub: $userId})-[:CREATED]->(n)`);
        params.userId = filters.user.userId;
      }
      // Note: 'interacted' mode would require tracking relationships we'll add later
    }

    // Build WHERE conditions
    const whereConditions: string[] = [];

    // Minimum inclusion votes filter
    if (filters.minInclusionVotes !== undefined) {
      whereConditions.push(`n.inclusionNetVotes >= $minVotes`);
      params.minVotes = filters.minInclusionVotes;
    }

    // Keyword filters
    if (filters.keywords) {
      const keywordQuery = this.buildKeywordFilterQuery(filters.keywords);
      queryParts.push(keywordQuery.query);
      Object.assign(params, keywordQuery.params);
    }

    // Category filters
    if (filters.categories) {
      const categoryQuery = this.buildCategoryFilterQuery(filters.categories);
      queryParts.push(categoryQuery.query);
      Object.assign(params, categoryQuery.params);
    }

    if (whereConditions.length > 0) {
      queryParts.push(`WHERE ${whereConditions.join(' AND ')}`);
    }

    // Get related nodes for edge building
    queryParts.push(`
      OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      OPTIONAL MATCH (n)-[st:SHARED_TAG]->(stNode:${this.nodeLabel})
      OPTIONAL MATCH (n)-[sc:SHARED_CATEGORY]->(scNode:${this.nodeLabel})
      
      WITH n, d.id IS NOT NULL as hasDiscussion,
           collect(DISTINCT stNode) as sharedTagNodes,
           collect(DISTINCT scNode) as sharedCategoryNodes,
           AVG(st.strength) as tagStrength,
           AVG(sc.strength) as categoryStrength
    `);

    // Sorting
    const sortField = filters.sortBy || 'inclusionNetVotes';
    const sortDirection = filters.sortDirection || 'DESC';

    if (sortField === 'totalVotes') {
      queryParts.push(`
        ORDER BY (n.inclusionPositiveVotes + n.inclusionNegativeVotes) ${sortDirection}
      `);
    } else {
      queryParts.push(`ORDER BY n.${sortField} ${sortDirection}`);
    }

    // Pagination
    if (filters.offset !== undefined) {
      queryParts.push(`SKIP $offset`);
      params.offset = filters.offset;
    }

    if (filters.limit !== undefined) {
      queryParts.push(`LIMIT $limit`);
      params.limit = filters.limit;
    }

    queryParts.push(`
      RETURN n, hasDiscussion, sharedTagNodes, sharedCategoryNodes,
             tagStrength, categoryStrength
    `);

    return {
      query: queryParts.join('\n'),
      params,
    };
  }

  /**
   * Build keyword filter subquery
   */
  private buildKeywordFilterQuery(keywordFilter: {
    mode: 'any' | 'all' | 'exact';
    values: string[];
  }): { query: string; params: { [key: string]: any } } {
    const params: { [key: string]: any } = {
      keywords: keywordFilter.values,
    };

    let query = '';

    switch (keywordFilter.mode) {
      case 'any':
        // Match nodes with at least one keyword
        query = `
          WITH n
          MATCH (n)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
          WITH n, COUNT(DISTINCT w) as matchCount
          WHERE matchCount > 0
        `;
        break;

      case 'all':
        // Match nodes with all keywords
        query = `
          WITH n
          MATCH (n)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
          WITH n, collect(DISTINCT w.word) as nodeKeywords
          WHERE SIZE(nodeKeywords) = SIZE($keywords)
        `;
        break;

      case 'exact':
        // Match nodes with exactly these keywords (no more, no less)
        query = `
          WITH n
          MATCH (n)-[:TAGGED]->(w:WordNode)
          WITH n, collect(DISTINCT w.word) as allNodeKeywords
          WHERE SIZE(allNodeKeywords) = SIZE($keywords)
            AND ALL(kw IN allNodeKeywords WHERE kw IN $keywords)
        `;
        break;
    }

    return { query, params };
  }

  /**
   * Build category filter subquery
   */
  private buildCategoryFilterQuery(categoryFilter: {
    mode: 'any' | 'all' | 'exact';
    values: string[];
  }): { query: string; params: { [key: string]: any } } {
    const params: { [key: string]: any } = {
      categoryIds: categoryFilter.values,
    };

    let query = '';

    switch (categoryFilter.mode) {
      case 'any':
        // Match nodes with at least one category
        query = `
          WITH n
          MATCH (n)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categoryIds
          WITH n, COUNT(DISTINCT c) as matchCount
          WHERE matchCount > 0
        `;
        break;

      case 'all':
        // Match nodes with all categories
        query = `
          WITH n
          MATCH (n)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categoryIds
          WITH n, collect(DISTINCT c.id) as nodeCategories
          WHERE SIZE(nodeCategories) = SIZE($categoryIds)
        `;
        break;

      case 'exact':
        // Match nodes with exactly these categories
        query = `
          WITH n
          MATCH (n)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WITH n, collect(DISTINCT c.id) as allNodeCategories
          WHERE SIZE(allNodeCategories) = SIZE($categoryIds)
            AND ALL(cat IN allNodeCategories WHERE cat IN $categoryIds)
        `;
        break;
    }

    return { query, params };
  }

  /**
   * Get special nodes (Word and Category) that match the filters
   * Used to include these nodes in the graph visualization
   */
  async getSpecialNodesForGraph(filters: GraphFilters): Promise<GraphNode[]> {
    try {
      const nodes: GraphNode[] = [];
      const params: { [key: string]: any } = {};

      // Get Word nodes if keywords are specified and includeWordNodes is true
      if (filters.keywords && filters.includeWordNodes) {
        const wordQuery = `
          MATCH (w:WordNode)
          WHERE w.word IN $keywords
            AND w.inclusionNetVotes >= $minVotes
          OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(d:DiscussionNode)
          RETURN w as n, d.id IS NOT NULL as hasDiscussion, 'WordNode' as nodeType
        `;

        params.keywords = filters.keywords.values;
        params.minVotes = filters.minInclusionVotes || 0;

        const wordResult = await this.neo4jService.read(wordQuery, params);

        wordResult.records.forEach((record) => {
          const node = record.get('n');
          nodes.push({
            id: node.properties.word, // Word nodes use 'word' as ID
            type: 'WordNode',
            data: node.properties,
            metadata: {
              inclusionVotes: this.toNumber(node.properties.inclusionNetVotes),
              totalVotes:
                this.toNumber(node.properties.inclusionPositiveVotes || 0) +
                this.toNumber(node.properties.inclusionNegativeVotes || 0),
              hasDiscussion: record.get('hasDiscussion'),
              createdAt: node.properties.createdAt,
            },
          });
        });
      }

      // Continue from where it was cut off...

      // Get Category nodes if categories are specified and includeCategoryNodes is true
      if (filters.categories && filters.includeCategoryNodes) {
        const categoryQuery = `
          MATCH (c:CategoryNode)
          WHERE c.id IN $categoryIds
            AND c.inclusionNetVotes >= $minVotes
          OPTIONAL MATCH (c)-[:HAS_DISCUSSION]->(d:DiscussionNode)
          OPTIONAL MATCH (c)-[:TAGGED]->(w:WordNode)
          RETURN c as n, d.id IS NOT NULL as hasDiscussion, 
                 collect(DISTINCT w.word) as keywords, 'CategoryNode' as nodeType
        `;

        params.categoryIds = filters.categories.values;
        params.minVotes = filters.minInclusionVotes || 0;

        const categoryResult = await this.neo4jService.read(
          categoryQuery,
          params,
        );

        categoryResult.records.forEach((record) => {
          const node = record.get('n');
          nodes.push({
            id: node.properties.id,
            type: 'CategoryNode',
            data: {
              ...node.properties,
              keywords: record.get('keywords'),
            },
            metadata: {
              inclusionVotes: this.toNumber(node.properties.inclusionNetVotes),
              totalVotes:
                this.toNumber(node.properties.inclusionPositiveVotes || 0) +
                this.toNumber(node.properties.inclusionNegativeVotes || 0),
              hasDiscussion: record.get('hasDiscussion'),
              createdAt: node.properties.createdAt,
            },
          });
        });
      }

      return nodes;
    } catch (error) {
      this.logger.error(`Error getting special nodes: ${error.message}`);
      throw this.standardError('get special nodes', error);
    }
  }

  /**
   * Get bulk nodes with their relationships for efficient graph building
   * Used when you already have node IDs and need their full data
   */
  async getBulkNodesWithRelationships(
    nodeIds: string[],
    includeRelationships: boolean = true,
  ): Promise<Map<string, GraphNode>> {
    try {
      if (nodeIds.length === 0) {
        return new Map();
      }

      const query = `
        MATCH (n:${this.nodeLabel})
        WHERE n.${this.idField} IN $nodeIds
        OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        ${
          includeRelationships
            ? `
          OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode)
          OPTIONAL MATCH (n)-[t:TAGGED]->(w:WordNode)
          OPTIONAL MATCH (n)-[st:SHARED_TAG]->(stNode:${this.nodeLabel})
            WHERE stNode.${this.idField} IN $nodeIds
          OPTIONAL MATCH (n)-[sc:SHARED_CATEGORY]->(scNode:${this.nodeLabel})
            WHERE scNode.${this.idField} IN $nodeIds
        `
            : ''
        }
        
        RETURN n, 
               d.id IS NOT NULL as hasDiscussion,
               ${
                 includeRelationships
                   ? `
                 collect(DISTINCT cat.name) as categories,
                 collect(DISTINCT w.word) as keywords,
                 collect(DISTINCT {
                   nodeId: stNode.${this.idField},
                   strength: st.strength,
                   word: st.word
                 }) as sharedTagConnections,
                 collect(DISTINCT {
                   nodeId: scNode.${this.idField},
                   strength: sc.strength,
                   categoryId: sc.categoryId
                 }) as sharedCategoryConnections
               `
                   : ''
               }
      `;

      const result = await this.neo4jService.read(query, { nodeIds });
      const nodeMap = new Map<string, GraphNode>();

      result.records.forEach((record) => {
        const node = record.get('n');
        const nodeId = node.properties[this.idField];

        nodeMap.set(nodeId, {
          id: nodeId,
          type: this.nodeLabel,
          data: this.mapNodeFromRecord(record),
          metadata: {
            inclusionVotes: this.toNumber(node.properties.inclusionNetVotes),
            totalVotes:
              this.toNumber(node.properties.inclusionPositiveVotes || 0) +
              this.toNumber(node.properties.inclusionNegativeVotes || 0),
            hasDiscussion: record.get('hasDiscussion'),
            createdAt: node.properties.createdAt,
          },
        });
      });

      return nodeMap;
    } catch (error) {
      this.logger.error(`Error getting bulk nodes: ${error.message}`);
      throw this.standardError('get bulk nodes', error);
    }
  }
}
