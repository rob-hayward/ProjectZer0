// src/neo4j/schemas/base/categorized.schema.ts
// (renamed from taggable-categorizable.schema.ts)

import { Injectable } from '@nestjs/common';
import {
  TaggedNodeSchema,
  TaggedNodeData,
  TaggedCreateData,
  TaggedUpdateData,
} from './tagged.schema';
import { Neo4jQueryBuilder } from '../utils/query-builder.util';

/**
 * Extended node data interface for nodes that support both tagging AND categorization
 * Note: CategorizedNodeData always extends TaggedNodeData since categorized nodes must be taggable
 */
export interface CategorizedNodeData extends TaggedNodeData {
  categories?: Array<{
    id: string;
    name: string;
    description?: string;
    inclusionNetVotes?: number;
  }>;
}

/**
 * Input data structure for creating categorized nodes
 * Extends tagged node creation with category support
 */
export interface CategorizedCreateData extends TaggedCreateData {
  categoryIds?: string[];
}

/**
 * Input data structure for updating categorized nodes
 * Extends tagged node updates with category support
 */
export interface CategorizedUpdateData extends TaggedUpdateData {
  categoryIds?: string[];
}

/**
 * Filter options for graph queries (includes both tag and category filters)
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
 * Graph edge structure for D3 visualization (includes both tag and category edges)
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
 * Abstract base schema for nodes that support BOTH keyword tagging AND categorization.
 * Extends TaggedNodeSchema to add category functionality on top of tagging.
 *
 * IMPORTANT: All categorized nodes are also taggable (categories require keywords).
 *
 * Provides standardized implementation for:
 * - All tagging functionality (inherited from TaggedNodeSchema)
 * - Category relationships (CATEGORIZED_AS, SHARED_CATEGORY)
 * - Complex creation and update queries with both tags and categories
 * - Graph visualization queries combining both relationship types
 *
 * Used by: StatementSchema, OpenQuestionSchema, AnswerSchema, QuantitySchema,
 *          EvidenceSchema, CategorySchema (self-categorizing)
 */
@Injectable()
export abstract class CategorizedNodeSchema<
  T extends CategorizedNodeData = CategorizedNodeData,
> extends TaggedNodeSchema<T> {
  /**
   * Maximum number of categories allowed per node (can be overridden by subclasses)
   */
  protected readonly maxCategories: number = 3;

  /**
   * Attach categories to a node by creating CATEGORIZED_AS relationships
   * @param nodeId The ID of the node to categorize
   * @param categoryIds Array of category IDs
   */
  protected async attachCategories(
    nodeId: string,
    categoryIds: string[],
  ): Promise<void> {
    if (!categoryIds || categoryIds.length === 0) {
      return;
    }

    if (categoryIds.length > this.maxCategories) {
      throw new Error(`Node can have maximum ${this.maxCategories} categories`);
    }

    const query = `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      UNWIND $categoryIds as categoryId
      MATCH (cat:CategoryNode {id: categoryId})
      WHERE cat.inclusionNetVotes > 0
      CREATE (n)-[:CATEGORIZED_AS {
        createdAt: datetime()
      }]->(cat)
    `;

    await this.neo4jService.write(query, { nodeId, categoryIds });
  }

  /**
   * Create SHARED_CATEGORY relationships for content discovery
   * @param nodeId The ID of the node to connect
   * @param nodeLabel Optional label to restrict connections to same type
   */
  protected async createSharedCategoryRelationships(
    nodeId: string,
    nodeLabel?: string,
  ): Promise<void> {
    const query = `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode)
      ${Neo4jQueryBuilder.createSharedCategories(nodeLabel)}
    `;

    await this.neo4jService.write(query, { nodeId });
  }

  /**
   * Get categories associated with a node
   * @param nodeId The ID of the node
   * @returns Array of categories
   */
  async getCategories(
    nodeId: string,
  ): Promise<Array<{ id: string; name: string; description?: string }>> {
    this.validateId(nodeId);

    const result = await this.neo4jService.read(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode)
      WHERE cat.inclusionNetVotes > 0
      RETURN cat.id as id, cat.name as name, cat.description as description
      ORDER BY cat.inclusionNetVotes DESC
      `,
      { nodeId },
    );

    return result.records.map((record) => ({
      id: record.get('id'),
      name: record.get('name'),
      description: record.get('description'),
    }));
  }

  /**
   * Find nodes that share categories with the given node
   * @param nodeId The ID of the node
   * @param limit Maximum number of related nodes to return
   * @returns Array of related nodes with shared category information
   */
  async findRelatedByCategories(
    nodeId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      nodeId: string;
      sharedCategories: Array<{ id: string; name: string }>;
      strength: number;
    }>
  > {
    this.validateId(nodeId);

    const result = await this.neo4jService.read(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[sc:SHARED_CATEGORY]->(related)
      WHERE related.inclusionNetVotes > 0
      WITH related, 
           collect(DISTINCT {id: sc.categoryId, name: sc.categoryName}) as sharedCategories,
           sum(sc.strength) as totalStrength
      ORDER BY totalStrength DESC
      LIMIT $limit
      RETURN related.${this.idField} as nodeId, sharedCategories, totalStrength as strength
      `,
      { nodeId, limit },
    );

    return result.records.map((record) => ({
      nodeId: record.get('nodeId'),
      sharedCategories: record.get('sharedCategories'),
      strength: this.toNumber(record.get('strength')),
    }));
  }

  /**
   * Find nodes related by BOTH tags and categories (combined similarity)
   * @param nodeId The ID of the node
   * @param limit Maximum number of related nodes to return
   * @returns Array of related nodes with combined similarity scores
   */
  async findRelatedByCombined(
    nodeId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      nodeId: string;
      tagStrength: number;
      categoryStrength: number;
      combinedStrength: number;
    }>
  > {
    this.validateId(nodeId);

    const result = await this.neo4jService.read(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      OPTIONAL MATCH (n)-[st:SHARED_TAG]->(related)
      OPTIONAL MATCH (n)-[sc:SHARED_CATEGORY]->(related)
      WHERE related.inclusionNetVotes > 0
      WITH related,
           COALESCE(sum(st.strength), 0) as tagStrength,
           COALESCE(sum(sc.strength), 0) as categoryStrength
      WHERE tagStrength > 0 OR categoryStrength > 0
      WITH related, tagStrength, categoryStrength,
           (tagStrength + categoryStrength * 2) as combinedStrength
      ORDER BY combinedStrength DESC
      LIMIT $limit
      RETURN related.${this.idField} as nodeId, 
             tagStrength, categoryStrength, combinedStrength
      `,
      { nodeId, limit },
    );

    return result.records.map((record) => ({
      nodeId: record.get('nodeId'),
      tagStrength: this.toNumber(record.get('tagStrength')),
      categoryStrength: this.toNumber(record.get('categoryStrength')),
      combinedStrength: this.toNumber(record.get('combinedStrength')),
    }));
  }

  /**
   * Update categories for a node (replaces existing categories)
   * @param nodeId The ID of the node to update
   * @param categoryIds New set of category IDs
   */
  async updateCategories(nodeId: string, categoryIds: string[]): Promise<void> {
    this.validateId(nodeId);

    // Delete existing category relationships
    await this.neo4jService.write(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[c:CATEGORIZED_AS]->()
      DELETE c
      `,
      { nodeId },
    );

    // Delete existing shared category relationships
    await this.neo4jService.write(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[sc:SHARED_CATEGORY]-()
      DELETE sc
      `,
      { nodeId },
    );

    // Create new category relationships
    if (categoryIds && categoryIds.length > 0) {
      await this.attachCategories(nodeId, categoryIds);
      await this.createSharedCategoryRelationships(nodeId, this.nodeLabel);
    }
  }

  /**
   * Build the complete creation query including both categories and keywords
   * Extends the tagged creation query with category support
   */
  protected buildCategorizedCreateQuery(data: CategorizedCreateData): {
    cypher: string;
    params: { [key: string]: any };
  } {
    // Start with the tagged query
    const { cypher: taggedQuery, params } = super.buildTaggedCreateQuery(data);

    // If we have categories, we need to modify the query
    if (data.categoryIds && data.categoryIds.length > 0) {
      // Remove the RETURN statement from tagged query
      const queryWithoutReturn = taggedQuery.replace(/RETURN n$/, '');

      // Add category processing
      const categoryQuery = `
        ${queryWithoutReturn}
        ${Neo4jQueryBuilder.attachCategories(this.maxCategories)}
        ${Neo4jQueryBuilder.createSharedCategories(this.nodeLabel)}
        RETURN n
      `;

      params.categoryIds = data.categoryIds;

      return {
        cypher: categoryQuery,
        params,
      };
    }

    // No categories, just return the tagged query as-is
    return { cypher: taggedQuery, params };
  }

  /**
   * Build a graph query with filters for visualization
   * @param filters Graph filter options
   * @returns Nodes and edges for graph visualization
   */
  async getGraphData(filters: GraphFilters): Promise<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }> {
    // Build filter conditions
    const whereConditions: string[] = [];
    const params: any = {};

    if (filters.minInclusionVotes !== undefined) {
      whereConditions.push('n.inclusionNetVotes >= $minVotes');
      params.minVotes = filters.minInclusionVotes;
    }

    if (filters.keywords?.values && filters.keywords.values.length > 0) {
      const keywordCondition =
        filters.keywords.mode === 'all'
          ? 'ALL(keyword IN $keywords WHERE EXISTS((n)-[:TAGGED]->(:WordNode {word: keyword})))'
          : filters.keywords.mode === 'exact'
            ? 'SIZE([(n)-[:TAGGED]->(w:WordNode) | w.word]) = SIZE($keywords) AND ALL(keyword IN $keywords WHERE EXISTS((n)-[:TAGGED]->(:WordNode {word: keyword})))'
            : 'ANY(keyword IN $keywords WHERE EXISTS((n)-[:TAGGED]->(:WordNode {word: keyword})))';

      whereConditions.push(keywordCondition);
      params.keywords = filters.keywords.values;
    }

    if (filters.categories?.values && filters.categories.values.length > 0) {
      const categoryCondition =
        filters.categories.mode === 'all'
          ? 'ALL(catId IN $categoryIds WHERE EXISTS((n)-[:CATEGORIZED_AS]->(:CategoryNode {id: catId})))'
          : filters.categories.mode === 'exact'
            ? 'SIZE([(n)-[:CATEGORIZED_AS]->(c:CategoryNode) | c.id]) = SIZE($categoryIds) AND ALL(catId IN $categoryIds WHERE EXISTS((n)-[:CATEGORIZED_AS]->(:CategoryNode {id: catId})))'
            : 'ANY(catId IN $categoryIds WHERE EXISTS((n)-[:CATEGORIZED_AS]->(:CategoryNode {id: catId})))';

      whereConditions.push(categoryCondition);
      params.categoryIds = filters.categories.values;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const orderBy = filters.sortBy
      ? `ORDER BY n.${filters.sortBy} ${filters.sortDirection || 'DESC'}`
      : 'ORDER BY n.inclusionNetVotes DESC';

    const limitClause = filters.limit ? `LIMIT $limit` : 'LIMIT 50';

    if (filters.limit) params.limit = filters.limit;

    const skipClause = filters.offset ? `SKIP $offset` : '';

    if (filters.offset) params.offset = filters.offset;

    // Query for nodes and relationships
    const query = `
      MATCH (n:${this.nodeLabel})
      ${whereClause}
      ${orderBy}
      ${skipClause}
      ${limitClause}
      WITH collect(n) as nodes
      UNWIND nodes as n
      OPTIONAL MATCH (n)-[st:SHARED_TAG]->(related)
      WHERE related IN nodes
      OPTIONAL MATCH (n)-[sc:SHARED_CATEGORY]->(related2)
      WHERE related2 IN nodes
      RETURN nodes,
             collect(DISTINCT {source: n.${this.idField}, target: related.${this.idField}, type: 'SHARED_TAG', weight: st.strength, word: st.word}) as tagEdges,
             collect(DISTINCT {source: n.${this.idField}, target: related2.${this.idField}, type: 'SHARED_CATEGORY', weight: sc.strength, categoryId: sc.categoryId, categoryName: sc.categoryName}) as categoryEdges
    `;

    const result = await this.neo4jService.read(query, params);

    if (result.records.length === 0) {
      return { nodes: [], edges: [] };
    }

    const record = result.records[0];
    const nodes = record.get('nodes').map((n: any) => ({
      id: n.properties[this.idField],
      type: this.nodeLabel,
      data: n.properties,
      metadata: {
        inclusionVotes: this.toNumber(n.properties.inclusionNetVotes),
        totalVotes:
          this.toNumber(n.properties.inclusionPositiveVotes) +
          this.toNumber(n.properties.inclusionNegativeVotes),
        hasDiscussion: !!n.properties.discussionId,
        createdAt: n.properties.createdAt,
      },
    }));

    const tagEdges = record
      .get('tagEdges')
      .filter((e: any) => e.target !== null)
      .map((e: any) => ({
        source: e.source,
        target: e.target,
        type: 'SHARED_TAG' as const,
        weight: this.toNumber(e.weight),
        metadata: { sharedWord: e.word },
      }));

    const categoryEdges = record
      .get('categoryEdges')
      .filter((e: any) => e.target !== null)
      .map((e: any) => ({
        source: e.source,
        target: e.target,
        type: 'SHARED_CATEGORY' as const,
        weight: this.toNumber(e.weight),
        metadata: {
          categoryId: e.categoryId,
          categoryName: e.categoryName,
        },
      }));

    return {
      nodes,
      edges: [...tagEdges, ...categoryEdges],
    };
  }
}
