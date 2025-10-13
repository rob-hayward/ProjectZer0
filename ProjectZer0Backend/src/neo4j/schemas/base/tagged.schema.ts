// src/neo4j/schemas/base/tagged.schema.ts

import { Injectable } from '@nestjs/common';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { Neo4jQueryBuilder } from '../utils/query-builder.util';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';

/**
 * Extended base node data interface for nodes that support tagging
 */
export interface TaggedNodeData extends BaseNodeData {
  keywords?: KeywordWithFrequency[];
  relatedNodes?: Array<{
    id: string;
    sharedWord?: string;
    strength?: number;
  }>;
}

/**
 * Input data structure for creating tagged nodes
 */
export interface TaggedCreateData {
  id: string;
  createdBy: string;
  publicCredit: boolean;
  keywords?: KeywordWithFrequency[];
  parentId?: string;
  parentType?: string;
  parentRelationship?: string;
  nodeProperties: { [key: string]: any };
}

/**
 * Input data structure for updating tagged nodes
 */
export interface TaggedUpdateData {
  keywords?: KeywordWithFrequency[];
  [key: string]: any;
}

/**
 * Graph edge structure for tag relationships
 */
export interface TagEdge {
  source: string;
  target: string;
  type: 'SHARED_TAG';
  weight: number;
  metadata?: {
    sharedWord?: string;
  };
}

/**
 * Abstract base schema for nodes that support keyword tagging.
 * Provides standardized implementation for:
 * - Keyword/tagging relationships (TAGGED, SHARED_TAG)
 * - Tag-based discovery and similarity
 *
 * Used by: WordSchema (self-tagging), and as base for CategorizedSchema
 */
@Injectable()
export abstract class TaggedNodeSchema<
  T extends TaggedNodeData = TaggedNodeData,
> extends BaseNodeSchema<T> {
  /**
   * Whether to validate that keywords exist and have passed inclusion threshold
   * Can be overridden by subclasses (e.g., WordSchema might set to false for self-tagging)
   */
  protected readonly validateKeywordInclusion: boolean = true;

  /**
   * Attach keywords to a node by creating TAGGED relationships
   * @param nodeId The ID of the node to tag
   * @param keywords Array of keywords with frequencies
   */
  protected async attachKeywords(
    nodeId: string,
    keywords: KeywordWithFrequency[],
  ): Promise<void> {
    if (!keywords || keywords.length === 0) {
      return;
    }

    const query = this.validateKeywordInclusion
      ? `
        MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        WHERE w.inclusionNetVotes > 0
        CREATE (n)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
      `
      : `
        MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        CREATE (n)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
      `;

    await this.neo4jService.write(query, { nodeId, keywords });
  }

  /**
   * Create SHARED_TAG relationships for content discovery
   * @param nodeId The ID of the node to connect
   * @param nodeLabel Optional label to restrict connections to same type
   */
  protected async createSharedTagRelationships(
    nodeId: string,
    nodeLabel?: string,
  ): Promise<void> {
    const query = `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[t:TAGGED]->(w:WordNode)
      ${Neo4jQueryBuilder.createSharedTags(nodeLabel)}
    `;

    await this.neo4jService.write(query, { nodeId });
  }

  /**
   * Get keywords associated with a node
   * @param nodeId The ID of the node
   * @returns Array of keywords with their frequencies
   */
  async getKeywords(nodeId: string): Promise<KeywordWithFrequency[]> {
    this.validateId(nodeId);

    const result = await this.neo4jService.read(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[t:TAGGED]->(w:WordNode)
      RETURN w.word as word, t.frequency as frequency, t.source as source
      ORDER BY t.frequency DESC
      `,
      { nodeId },
    );

    return result.records.map((record) => ({
      word: record.get('word'),
      frequency: this.toNumber(record.get('frequency')),
      source: record.get('source'),
    }));
  }

  /**
   * Find nodes that share tags with the given node
   * @param nodeId The ID of the node
   * @param limit Maximum number of related nodes to return
   * @returns Array of related nodes with shared tag information
   */
  async findRelatedByTags(
    nodeId: string,
    limit: number = 10,
  ): Promise<
    Array<{ nodeId: string; sharedWords: string[]; strength: number }>
  > {
    this.validateId(nodeId);

    const result = await this.neo4jService.read(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[st:SHARED_TAG]->(related)
      WHERE related.inclusionNetVotes > 0
      WITH related, collect(st.word) as sharedWords, sum(st.strength) as totalStrength
      ORDER BY totalStrength DESC
      LIMIT $limit
      RETURN related.${this.idField} as nodeId, sharedWords, totalStrength as strength
      `,
      { nodeId, limit },
    );

    return result.records.map((record) => ({
      nodeId: record.get('nodeId'),
      sharedWords: record.get('sharedWords'),
      strength: this.toNumber(record.get('strength')),
    }));
  }

  /**
   * Update keywords for a node (replaces existing keywords)
   * @param nodeId The ID of the node to update
   * @param keywords New set of keywords
   */
  async updateKeywords(
    nodeId: string,
    keywords: KeywordWithFrequency[],
  ): Promise<void> {
    this.validateId(nodeId);

    // Delete existing tag relationships
    await this.neo4jService.write(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[t:TAGGED]->()
      DELETE t
      `,
      { nodeId },
    );

    // Delete existing shared tag relationships
    await this.neo4jService.write(
      `
      MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})
      MATCH (n)-[st:SHARED_TAG]-()
      DELETE st
      `,
      { nodeId },
    );

    // Create new tag relationships
    if (keywords && keywords.length > 0) {
      await this.attachKeywords(nodeId, keywords);
      await this.createSharedTagRelationships(nodeId, this.nodeLabel);
    }
  }

  /**
   * Build a query that includes keyword processing in node creation
   * Used by subclasses in their create methods
   */
  protected buildTaggedCreateQuery(data: TaggedCreateData): {
    cypher: string;
    params: { [key: string]: any };
  } {
    const queryParts: string[] = [];
    const params: { [key: string]: any } = {
      id: data.id,
      createdBy: data.createdBy,
      publicCredit: data.publicCredit,
      ...data.nodeProperties,
    };

    // 1. Validate parent if needed
    if (data.parentId && data.parentType) {
      queryParts.push(`
        MATCH (parent:${data.parentType} {id: $parentId})
        WHERE parent.inclusionNetVotes > 0
      `);
      params.parentId = data.parentId;
    }

    // 2. Create the main node with voting fields
    queryParts.push(
      Neo4jQueryBuilder.createNodeWithVoting(
        this.nodeLabel,
        Object.keys(data.nodeProperties),
        this.supportsContentVoting(),
      ),
    );

    // 3. Create parent relationship if specified
    if (data.parentId && data.parentRelationship) {
      queryParts.push(`
        CREATE (n)-[:${data.parentRelationship}]->(parent)
      `);
    }

    // 4. Attach keywords if provided
    if (data.keywords && data.keywords.length > 0) {
      queryParts.push(
        Neo4jQueryBuilder.attachKeywords(this.validateKeywordInclusion),
      );
      queryParts.push(Neo4jQueryBuilder.createSharedTags(this.nodeLabel));
      params.keywords = data.keywords;
    }

    // 5. Return the created node
    queryParts.push('RETURN n');

    return {
      cypher: queryParts.join('\n'),
      params,
    };
  }

  // In src/neo4j/schemas/base/tagged.schema.ts

  /**
   * Find all nodes of this type with keyword-based filtering
   * This is the base implementation for tag-based queries
   * CategorizedNodeSchema will override this to add category filtering
   */
  async findAll(options?: {
    // Inclusion filter
    minInclusionVotes?: number;

    // Keyword filtering (tags only)
    keywords?: string[];
    keywordMode?: 'any' | 'all';

    // User filtering
    createdBy?: string;

    // Sorting
    sortBy?: 'inclusionNetVotes' | 'contentNetVotes' | 'createdAt';
    sortDirection?: 'ASC' | 'DESC';

    // Pagination
    limit?: number;
    offset?: number;

    // Data fetching
    includeKeywords?: boolean;
    includeDiscussion?: boolean;
  }): Promise<T[]> {
    const {
      minInclusionVotes = -5,
      keywords = [],
      keywordMode = 'any',
      createdBy,
      sortBy = 'inclusionNetVotes',
      sortDirection = 'DESC',
      limit = 1000,
      offset = 0,
      includeKeywords = true,
      includeDiscussion = true,
    } = options || {};

    // Build WHERE clauses
    const whereConditions: string[] = [];
    const params: any = {};

    // Inclusion votes filter
    whereConditions.push('n.inclusionNetVotes >= $minInclusionVotes');
    params.minInclusionVotes = minInclusionVotes;

    // Keyword filter (only tags, no categories)
    if (keywords.length > 0) {
      const keywordCondition =
        keywordMode === 'all'
          ? 'ALL(keyword IN $keywords WHERE EXISTS((n)-[:TAGGED]->(:WordNode {word: keyword})))'
          : 'ANY(keyword IN $keywords WHERE EXISTS((n)-[:TAGGED]->(:WordNode {word: keyword})))';
      whereConditions.push(keywordCondition);
      params.keywords = keywords;
    }

    // User filter
    if (createdBy) {
      whereConditions.push('n.createdBy = $createdBy');
      params.createdBy = createdBy;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Build query - NO category logic here
    const query = `
    MATCH (n:${this.nodeLabel})
    ${whereClause}
    ${includeDiscussion ? 'OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(disc:DiscussionNode)' : ''}
    ${includeKeywords ? 'OPTIONAL MATCH (n)-[t:TAGGED]->(w:WordNode)' : ''}
    RETURN n,
           ${includeDiscussion ? 'disc.id as discussionId' : 'null as discussionId'},
           ${includeKeywords ? 'collect(DISTINCT {word: w.word, frequency: t.frequency, source: t.source}) as keywords' : '[] as keywords'}
    ORDER BY n.${sortBy} ${sortDirection}
    SKIP $offset
    LIMIT $limit
  `;

    // Convert pagination parameters to Neo4j integers
    const pagination = this.neo4jService.paginationParams(offset, limit);
    params.offset = pagination.offset;
    params.limit = pagination.limit;

    try {
      const result = await this.neo4jService.read(query, params);

      return result.records.map((record) => {
        const nodeData = this.mapNodeFromRecord(record);

        if (includeDiscussion) {
          nodeData.discussionId = record.get('discussionId');
        }

        if (includeKeywords) {
          const keywordsData = record.get('keywords');
          nodeData.keywords = keywordsData.filter((k: any) => k.word);
        }

        return nodeData;
      });
    } catch (error) {
      this.logger.error(
        `Error in findAll for ${this.nodeLabel}: ${error.message}`,
      );
      throw this.standardError('findAll', error);
    }
  }
}
