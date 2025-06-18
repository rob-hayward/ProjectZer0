// src/nodes/universal/universal-graph.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { int } from 'neo4j-driver';

export interface UniversalNodeData {
  id: string;
  type: 'statement' | 'openquestion' | 'quantity';
  content: string;
  consensus_ratio: number;
  participant_count: number;
  created_at: string;
  updated_at?: string;
  created_by: string;
  public_credit: boolean;

  // Type-specific metadata
  metadata: {
    keywords: Array<{ word: string; frequency: number }>;

    // For binary voting nodes (statement, openquestion)
    votes?: {
      positive: number;
      negative: number;
      net: number;
    };

    // For quantity nodes
    responses?: {
      count: number;
      mean?: number;
      std_dev?: number;
      min?: number;
      max?: number;
    };

    // For open questions
    answer_count?: number;
  };
}

export interface UniversalRelationshipData {
  id: string;
  source: string; // source node id
  target: string; // target node id
  type: 'shared_keyword' | 'answers' | 'responds_to' | 'related_to';
  metadata?: {
    keyword?: string; // for shared_keyword type
    strength?: number; // relationship strength (0-1)
    created_at?: string; // when the relationship was created
  };
}

export interface UniversalGraphOptions {
  node_types?: Array<'statement' | 'openquestion' | 'quantity'>;
  min_consensus?: number;
  max_consensus?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'consensus' | 'chronological' | 'participants';
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  user_id?: string;
  include_relationships?: boolean;
  relationship_types?: Array<
    'shared_keyword' | 'answers' | 'responds_to' | 'related_to'
  >;
}

export interface UniversalGraphResponse {
  nodes: UniversalNodeData[];
  relationships: UniversalRelationshipData[];
  total_count: number;
  has_more: boolean;
}

@Injectable()
export class UniversalGraphService {
  private readonly logger = new Logger(UniversalGraphService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async getUniversalNodes(
    options: UniversalGraphOptions,
  ): Promise<UniversalGraphResponse> {
    try {
      // Set defaults
      const {
        node_types = ['statement', 'openquestion', 'quantity'],
        min_consensus = 0,
        max_consensus = 1,
        limit = 200,
        offset = 0,
        sort_by = 'consensus',
        sort_direction = 'desc',
        keywords = [],
        user_id,
        include_relationships = true,
        relationship_types = [
          'shared_keyword',
          'answers',
          'responds_to',
          'related_to',
        ],
      } = options;

      this.logger.debug(
        `Getting universal nodes with options: ${JSON.stringify(options)}`,
      );

      // Build the main query
      const query = this.buildUniversalQuery({
        node_types,
        min_consensus,
        max_consensus,
        keywords,
        user_id,
        sort_by,
        sort_direction,
        limit,
        offset,
      });

      // Execute the query
      const result = await this.neo4jService.read(query.query, query.params);

      // Process and transform the results
      const nodes = this.transformResults(result.records);

      // Get node IDs for relationship query
      const nodeIds = nodes.map((n) => n.id);

      // Fetch relationships if requested
      const relationships = include_relationships
        ? await this.getRelationships(nodeIds, relationship_types)
        : [];

      this.logger.debug(
        `Found ${relationships.length} relationships for ${nodes.length} nodes`,
      );

      // Get total count for pagination
      const countResult = await this.neo4jService.read(
        this.buildCountQuery({
          node_types,
          min_consensus,
          max_consensus,
          keywords,
          user_id,
        }),
        {
          node_types,
          min_consensus,
          max_consensus,
          keywords,
          user_id,
        },
      );

      const total_count = this.toNumber(
        countResult.records[0]?.get('total') || 0,
      );
      const has_more = offset + nodes.length < total_count;

      return {
        nodes,
        relationships,
        total_count,
        has_more,
      };
    } catch (error) {
      this.logger.error(
        `Error getting universal nodes: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get universal nodes: ${error.message}`);
    }
  }

  private async getRelationships(
    nodeIds: string[],
    relationshipTypes: Array<
      'shared_keyword' | 'answers' | 'responds_to' | 'related_to'
    >,
  ): Promise<UniversalRelationshipData[]> {
    if (nodeIds.length === 0) return [];

    try {
      const relationships: UniversalRelationshipData[] = [];

      // Fetch shared keyword relationships if requested
      if (relationshipTypes.includes('shared_keyword')) {
        const sharedKeywordQuery = `
          MATCH (n1)-[:TAGGED]->(w:WordNode)<-[:TAGGED]-(n2)
          WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds AND n1.id < n2.id
          AND (n1:StatementNode OR n1:OpenQuestionNode OR n1:QuantityNode)
          AND (n2:StatementNode OR n2:OpenQuestionNode OR n2:QuantityNode)
          RETURN DISTINCT {
            source: n1.id,
            target: n2.id,
            keyword: w.word,
            type: 'shared_keyword'
          } as rel
        `;

        const sharedKeywordResult = await this.neo4jService.read(
          sharedKeywordQuery,
          { nodeIds },
        );

        // Process shared keyword relationships
        const keywordRels = sharedKeywordResult.records.map((record) => {
          const rel = record.get('rel');
          return {
            source: rel.source,
            target: rel.target,
            keyword: rel.keyword,
            type: 'shared_keyword' as const,
          };
        });

        // Group by node pairs and combine keywords
        const keywordMap = new Map<string, any>();
        keywordRels.forEach((rel) => {
          const key = `${rel.source}-${rel.target}`;
          if (keywordMap.has(key)) {
            keywordMap.get(key).keywords.push(rel.keyword);
          } else {
            keywordMap.set(key, {
              source: rel.source,
              target: rel.target,
              keywords: [rel.keyword],
              type: 'shared_keyword',
            });
          }
        });

        // Convert to relationships
        keywordMap.forEach((value, key) => {
          relationships.push({
            id: `shared-keyword-${key}`,
            source: value.source,
            target: value.target,
            type: 'shared_keyword',
            metadata: {
              keyword: value.keywords.join(', '),
              strength: Math.min(1.0, 0.3 + value.keywords.length * 0.1),
            },
          });
        });
      }

      // Fetch direct relationships if requested
      const directRelTypes = relationshipTypes.filter(
        (t) => t !== 'shared_keyword',
      );
      if (directRelTypes.length > 0) {
        const directRelQuery = `
          MATCH (n1)-[r]-(n2)
          WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds
          AND (n1:StatementNode OR n1:OpenQuestionNode OR n1:QuantityNode)
          AND (n2:StatementNode OR n2:OpenQuestionNode OR n2:QuantityNode)
          AND type(r) IN $relTypes
          WITH n1, n2, r, type(r) as relType
          RETURN DISTINCT {
            source: CASE 
              WHEN relType = 'ANSWERS' AND n1:StatementNode THEN n1.id
              WHEN relType = 'RESPONDS_TO' AND n1:StatementNode THEN n1.id
              WHEN id(n1) < id(n2) THEN n1.id
              ELSE n2.id
            END,
            target: CASE 
              WHEN relType = 'ANSWERS' AND n1:StatementNode THEN n2.id
              WHEN relType = 'RESPONDS_TO' AND n1:StatementNode THEN n2.id
              WHEN id(n1) < id(n2) THEN n2.id
              ELSE n1.id
            END,
            type: toLower(relType),
            created_at: CASE WHEN r.createdAt IS NOT NULL THEN toString(r.createdAt) ELSE null END
          } as rel
        `;

        const directRelResult = await this.neo4jService.read(directRelQuery, {
          nodeIds,
          relTypes: directRelTypes.map((t) => t.toUpperCase()),
        });

        // Process direct relationships
        directRelResult.records.forEach((record) => {
          const rel = record.get('rel');
          relationships.push({
            id: `${rel.type}-${rel.source}-${rel.target}`,
            source: rel.source,
            target: rel.target,
            type: rel.type as any,
            metadata: {
              strength: 1.0,
              created_at: rel.created_at,
            },
          });
        });
      }

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error getting relationships: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  private buildUniversalQuery(params: any): { query: string; params: any } {
    const {
      node_types,
      min_consensus,
      max_consensus,
      keywords,
      user_id,
      sort_by,
      sort_direction,
      limit,
      offset,
    } = params;

    // Build node type conditions
    const nodeTypeConditions = node_types
      .map((type) => {
        switch (type) {
          case 'statement':
            return 'n:StatementNode';
          case 'openquestion':
            return 'n:OpenQuestionNode';
          case 'quantity':
            return 'n:QuantityNode';
          default:
            return null;
        }
      })
      .filter(Boolean)
      .join(' OR ');

    let query = `
      MATCH (n)
      WHERE (${nodeTypeConditions})
        AND n.consensus_ratio >= $min_consensus
        AND n.consensus_ratio <= $max_consensus
        AND (n.visibilityStatus <> false OR n.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      query += `
        AND EXISTS {
          MATCH (n)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
    }

    // Add user filter if specified
    if (user_id) {
      query += `
        AND n.createdBy = $user_id
      `;
    }

    // Get keywords for each node
    query += `
      OPTIONAL MATCH (n)-[t:TAGGED]->(w:WordNode)
      WITH n, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
    `;

    // Get type-specific data
    query += `
      // For statements and questions, get vote data
      OPTIONAL MATCH (n)<-[pv:VOTED_ON {status: 'agree'}]-() WHERE n:StatementNode OR n:OpenQuestionNode
      WITH n, keywords, count(DISTINCT pv) as positiveVotes
      
      OPTIONAL MATCH (n)<-[nv:VOTED_ON {status: 'disagree'}]-() WHERE n:StatementNode OR n:OpenQuestionNode
      WITH n, keywords, positiveVotes, count(DISTINCT nv) as negativeVotes
      
      // For open questions, get answer count
      OPTIONAL MATCH (s:StatementNode)-[:ANSWERS]->(n:OpenQuestionNode)
      WITH n, keywords, positiveVotes, negativeVotes, count(DISTINCT s) as answerCount
      
      // Prepare the return data
      WITH n, keywords, positiveVotes, negativeVotes, answerCount,
           CASE
             WHEN n:StatementNode THEN 'statement'
             WHEN n:OpenQuestionNode THEN 'openquestion'
             WHEN n:QuantityNode THEN 'quantity'
           END as nodeType,
           CASE
             WHEN n:StatementNode THEN n.statement
             WHEN n:OpenQuestionNode THEN n.questionText
             WHEN n:QuantityNode THEN n.question
           END as content,
           CASE
             WHEN n:StatementNode OR n:OpenQuestionNode THEN positiveVotes + negativeVotes
             WHEN n:QuantityNode THEN n.responseCount
           END as participantCount
    `;

    // Add sorting
    if (sort_by === 'consensus') {
      query += ` ORDER BY n.consensus_ratio ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'chronological') {
      query += ` ORDER BY n.createdAt ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'participants') {
      query += ` ORDER BY participantCount ${sort_direction.toUpperCase()}`;
    }

    // Add pagination
    query += `
      SKIP toInteger($offset)
      LIMIT toInteger($limit)
    `;

    // Return the constructed data with datetime conversions
    query += `
      RETURN {
        id: n.id,
        type: nodeType,
        content: content,
        consensus_ratio: n.consensus_ratio,
        participant_count: participantCount,
        created_at: toString(n.createdAt),
        updated_at: toString(n.updatedAt),
        created_by: n.createdBy,
        public_credit: n.publicCredit,
        keywords: keywords,
        positive_votes: positiveVotes,
        negative_votes: negativeVotes,
        answer_count: answerCount,
        response_count: CASE WHEN n:QuantityNode THEN n.responseCount ELSE null END,
        mean: CASE WHEN n:QuantityNode THEN n.mean ELSE null END,
        std_dev: CASE WHEN n:QuantityNode THEN n.standardDeviation ELSE null END,
        min: CASE WHEN n:QuantityNode THEN n.min ELSE null END,
        max: CASE WHEN n:QuantityNode THEN n.max ELSE null END
      } as nodeData
    `;

    return {
      query,
      params: {
        node_types,
        min_consensus,
        max_consensus,
        keywords,
        user_id,
        offset: int(offset).toNumber(),
        limit: int(limit).toNumber(),
      },
    };
  }

  private buildCountQuery(filters: any): string {
    const { node_types, keywords, user_id } = filters;

    // Build node type conditions
    const nodeTypeConditions = node_types
      .map((type) => {
        switch (type) {
          case 'statement':
            return 'n:StatementNode';
          case 'openquestion':
            return 'n:OpenQuestionNode';
          case 'quantity':
            return 'n:QuantityNode';
          default:
            return null;
        }
      })
      .filter(Boolean)
      .join(' OR ');

    let query = `
      MATCH (n)
      WHERE (${nodeTypeConditions})
        AND n.consensus_ratio >= $min_consensus
        AND n.consensus_ratio <= $max_consensus
        AND (n.visibilityStatus <> false OR n.visibilityStatus IS NULL)
    `;

    if (keywords && keywords.length > 0) {
      query += `
        AND EXISTS {
          MATCH (n)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
    }

    if (user_id) {
      query += ` AND n.createdBy = $user_id`;
    }

    query += ` RETURN count(n) as total`;

    return query;
  }

  private transformResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      // Build the metadata object
      const metadata: any = {
        keywords: data.keywords || [],
      };

      // Add type-specific metadata
      if (data.type === 'statement' || data.type === 'openquestion') {
        metadata.votes = {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        };
      }

      if (data.type === 'quantity') {
        metadata.responses = {
          count: this.toNumber(data.response_count || 0),
          mean: data.mean ? Number(data.mean) : undefined,
          std_dev: data.std_dev ? Number(data.std_dev) : undefined,
          min: data.min ? Number(data.min) : undefined,
          max: data.max ? Number(data.max) : undefined,
        };
      }

      if (data.type === 'openquestion') {
        metadata.answer_count = this.toNumber(data.answer_count || 0);
      }

      return {
        id: data.id,
        type: data.type,
        content: data.content,
        consensus_ratio: Number(data.consensus_ratio || 0),
        participant_count: this.toNumber(data.participant_count || 0),
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by,
        public_credit: data.public_credit,
        metadata,
      };
    });
  }

  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle Neo4j integer objects
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
