// src/nodes/universal/universal-graph.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { int } from 'neo4j-driver';

export interface UniversalNodeData {
  id: string;
  type: 'openquestion'; // | 'statement' | 'quantity';
  content: string;
  participant_count: number;
  created_at: string;
  updated_at?: string;
  created_by: string;
  public_credit: boolean;

  // Type-specific metadata
  metadata: {
    keywords: Array<{ word: string; frequency: number }>;

    // For binary voting nodes (openquestion)
    votes: {
      positive: number;
      negative: number;
      net: number;
    };

    // User-specific data
    userVoteStatus?: {
      status: 'agree' | 'disagree' | null;
    };

    userVisibilityPreference?: {
      isVisible: boolean;
      source: string;
      timestamp: number;
    };

    // For open questions
    answer_count: number;
    answers?: Array<{
      id: string;
      statement: string;
      createdBy: string;
      createdAt: string;
      publicCredit: boolean;
      positiveVotes: number;
      negativeVotes: number;
      netVotes: number;
    }>;

    // Enhanced relationship data
    relatedQuestions?: Array<{
      nodeId: string;
      questionText: string;
      sharedWord?: string;
      strength?: number;
      relationshipType: 'shared_keyword' | 'direct';
    }>;

    // Discussion data
    discussionId?: string;
  };
}

export interface UniversalRelationshipData {
  id: string;
  source: string; // source node id
  target: string; // target node id
  type: 'shared_keyword' | 'related_to'; // | 'answers' | 'responds_to';
  metadata?: {
    keyword?: string; // for shared_keyword type
    strength?: number; // relationship strength (0-1)
    created_at?: string; // when the relationship was created
  };
}

export interface UniversalGraphOptions {
  node_types?: Array<'openquestion'>; // | 'statement' | 'quantity'>;
  limit?: number;
  offset?: number;
  sort_by?: 'netVotes' | 'chronological' | 'participants';
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  user_id?: string;
  include_relationships?: boolean;
  relationship_types?: Array<'shared_keyword' | 'related_to'>; // | 'answers' | 'responds_to'>;
  // User context for fetching user-specific data
  requesting_user_id?: string;
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

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
    private readonly visibilityService: VisibilityService,
  ) {}

  async getUniversalNodes(
    options: UniversalGraphOptions,
  ): Promise<UniversalGraphResponse> {
    try {
      // Set defaults - only supporting openquestion for now
      const {
        node_types = ['openquestion'],
        limit = 200,
        offset = 0,
        sort_by = 'netVotes',
        sort_direction = 'desc',
        keywords = [],
        user_id,
        include_relationships = true,
        relationship_types = ['shared_keyword', 'related_to'],
        requesting_user_id,
      } = options;

      // Validate that only openquestion is requested for now
      if (node_types.some((type) => type !== 'openquestion')) {
        throw new Error('Only openquestion node type is currently supported');
      }

      this.logger.debug(
        `Getting universal nodes with options: ${JSON.stringify(options)}`,
      );

      // Build the main query for OpenQuestion nodes only
      const query = this.buildOpenQuestionQuery({
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
      let nodes = this.transformOpenQuestionResults(result.records);

      // Enhancement: Fetch user-specific data (vote status and visibility preferences)
      if (requesting_user_id && nodes.length > 0) {
        nodes = await this.enhanceNodesWithUserData(nodes, requesting_user_id);
      }

      // Get node IDs for relationship query
      const nodeIds = nodes.map((n) => n.id);

      // Fetch relationships if requested
      const relationships = include_relationships
        ? await this.getOpenQuestionRelationships(nodeIds, relationship_types)
        : [];

      this.logger.debug(
        `Found ${relationships.length} relationships for ${nodes.length} nodes`,
      );

      // Get total count for pagination
      const countResult = await this.neo4jService.read(
        this.buildOpenQuestionCountQuery({
          keywords,
          user_id,
        }),
        {
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

  // Enhanced method to fetch user-specific data for all nodes
  private async enhanceNodesWithUserData(
    nodes: UniversalNodeData[],
    userId: string,
  ): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug(
        `Enhancing ${nodes.length} nodes with user data for user ${userId}`,
      );

      const nodeIds = nodes.map((node) => node.id);

      // Batch fetch vote statuses for all nodes
      const voteStatuses = await this.batchGetVoteStatuses(nodeIds, userId);

      // Batch fetch visibility preferences for all nodes
      const visibilityPreferences = await this.batchGetVisibilityPreferences(
        nodeIds,
        userId,
      );

      // Enhance each node with user-specific data
      const enhancedNodes = nodes.map((node) => {
        const enhanced = { ...node };

        // Add user vote status if available
        const userVoteStatus = voteStatuses[node.id];
        if (userVoteStatus !== undefined) {
          enhanced.metadata.userVoteStatus = {
            status: userVoteStatus,
          };
        }

        // Add user visibility preference if available
        const visibilityPreference = visibilityPreferences[node.id];
        if (visibilityPreference !== undefined) {
          enhanced.metadata.userVisibilityPreference = visibilityPreference;
        }

        return enhanced;
      });

      this.logger.debug(`Successfully enhanced nodes with user-specific data`);
      return enhancedNodes;
    } catch (error) {
      this.logger.error(
        `Error enhancing nodes with user data: ${error.message}`,
      );
      return nodes; // Return original nodes if enhancement fails
    }
  }

  // Batch fetch vote statuses for multiple nodes
  private async batchGetVoteStatuses(
    nodeIds: string[],
    userId: string,
  ): Promise<Record<string, 'agree' | 'disagree' | null>> {
    try {
      if (nodeIds.length === 0) return {};

      const query = `
        MATCH (oq:OpenQuestionNode)
        WHERE oq.id IN $nodeIds
        OPTIONAL MATCH (u:User {sub: $userId})-[v:VOTED_ON]->(oq)
        RETURN oq.id as nodeId, v.status as voteStatus
      `;

      const result = await this.neo4jService.read(query, { nodeIds, userId });

      const voteStatuses: Record<string, 'agree' | 'disagree' | null> = {};
      result.records.forEach((record) => {
        const nodeId = record.get('nodeId');
        const voteStatus = record.get('voteStatus');
        voteStatuses[nodeId] = voteStatus as 'agree' | 'disagree' | null;
      });

      this.logger.debug(
        `Fetched vote statuses for ${Object.keys(voteStatuses).length} nodes`,
      );
      return voteStatuses;
    } catch (error) {
      this.logger.error(`Error batch fetching vote statuses: ${error.message}`);
      return {};
    }
  }

  // Batch fetch visibility preferences for multiple nodes
  private async batchGetVisibilityPreferences(
    nodeIds: string[],
    userId: string,
  ): Promise<Record<string, any>> {
    try {
      if (nodeIds.length === 0) return {};

      // Use the visibility service to get all preferences for the user
      const allPreferences =
        await this.visibilityService.getUserVisibilityPreferences(userId);

      // Filter to only include preferences for the requested nodes
      // IMPORTANT: Only include nodes that have explicit user overrides
      const relevantPreferences: Record<string, any> = {};
      nodeIds.forEach((nodeId) => {
        if (allPreferences[nodeId] !== undefined) {
          // Only include if user has explicitly set a preference (not community default)
          relevantPreferences[nodeId] = {
            isVisible: allPreferences[nodeId],
            source: 'user',
            timestamp: Date.now(), // We could store this in the backend if needed
          };
        }
      });

      this.logger.debug(
        `Fetched visibility preferences for ${Object.keys(relevantPreferences).length} nodes with user overrides`,
      );
      return relevantPreferences;
    } catch (error) {
      this.logger.error(
        `Error batch fetching visibility preferences: ${error.message}`,
      );
      return {};
    }
  }

  private async getOpenQuestionRelationships(
    nodeIds: string[],
    relationshipTypes: Array<'shared_keyword' | 'related_to'>,
  ): Promise<UniversalRelationshipData[]> {
    if (nodeIds.length === 0) return [];

    try {
      const relationships: UniversalRelationshipData[] = [];

      // Fetch shared keyword relationships if requested
      if (relationshipTypes.includes('shared_keyword')) {
        const sharedKeywordQuery = `
          MATCH (oq1:OpenQuestionNode)-[:TAGGED]->(w:WordNode)<-[:TAGGED]-(oq2:OpenQuestionNode)
          WHERE oq1.id IN $nodeIds AND oq2.id IN $nodeIds AND oq1.id < oq2.id
          RETURN DISTINCT {
            source: oq1.id,
            target: oq2.id,
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
      if (relationshipTypes.includes('related_to')) {
        const directRelQuery = `
          MATCH (oq1:OpenQuestionNode)-[r:RELATED_TO]-(oq2:OpenQuestionNode)
          WHERE oq1.id IN $nodeIds AND oq2.id IN $nodeIds
          AND id(oq1) < id(oq2)
          RETURN DISTINCT {
            source: oq1.id,
            target: oq2.id,
            type: 'related_to',
            created_at: CASE WHEN r.createdAt IS NOT NULL THEN toString(r.createdAt) ELSE null END
          } as rel
        `;

        const directRelResult = await this.neo4jService.read(directRelQuery, {
          nodeIds,
        });

        // Process direct relationships
        directRelResult.records.forEach((record) => {
          const rel = record.get('rel');
          relationships.push({
            id: `related-to-${rel.source}-${rel.target}`,
            source: rel.source,
            target: rel.target,
            type: 'related_to',
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

  private buildOpenQuestionQuery(params: any): { query: string; params: any } {
    const { keywords, user_id, sort_by, sort_direction, limit, offset } =
      params;

    let query = `
      MATCH (oq:OpenQuestionNode)
      WHERE (oq.visibilityStatus <> false OR oq.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      query += `
        AND EXISTS {
          MATCH (oq)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
    }

    // Add user filter if specified
    if (user_id) {
      query += `
        AND oq.createdBy = $user_id
      `;
    }

    // Get keywords for each question
    query += `
      OPTIONAL MATCH (oq)-[t:TAGGED]->(w:WordNode)
      WITH oq, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
    `;

    // Get vote data and related questions
    query += `
      // Get vote counts
      OPTIONAL MATCH (oq)<-[pv:VOTED_ON {status: 'agree'}]-()
      WITH oq, keywords, count(DISTINCT pv) as positiveVotes
      
      OPTIONAL MATCH (oq)<-[nv:VOTED_ON {status: 'disagree'}]-()
      WITH oq, keywords, positiveVotes, count(DISTINCT nv) as negativeVotes
      
      // Get answer count
      OPTIONAL MATCH (s:StatementNode)-[:ANSWERS]->(oq)
      WITH oq, keywords, positiveVotes, negativeVotes, count(DISTINCT s) as answerCount
      
      // Get related questions data
      OPTIONAL MATCH (oq)-[st:SHARED_TAG]->(related:OpenQuestionNode)
      WHERE related.visibilityStatus <> false OR related.visibilityStatus IS NULL
      OPTIONAL MATCH (oq)-[:RELATED_TO]-(directRelated:OpenQuestionNode)
      WHERE directRelated.visibilityStatus <> false OR directRelated.visibilityStatus IS NULL
      
      WITH oq, keywords, positiveVotes, negativeVotes, answerCount,
           collect(DISTINCT {
             nodeId: related.id,
             questionText: related.questionText,
             sharedWord: st.word,
             strength: st.strength,
             relationshipType: 'shared_keyword'
           }) as sharedRelated,
           collect(DISTINCT {
             nodeId: directRelated.id,
             questionText: directRelated.questionText,
             relationshipType: 'direct'
           }) as directlyRelated
      
      // Get discussion ID
      OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH oq, keywords, positiveVotes, negativeVotes, answerCount, 
           sharedRelated, directlyRelated, d.id as discussionId,
           positiveVotes + negativeVotes as participantCount
    `;

    // Add sorting
    if (sort_by === 'netVotes') {
      query += ` ORDER BY (positiveVotes - negativeVotes) ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'chronological') {
      query += ` ORDER BY oq.createdAt ${sort_direction.toUpperCase()}`;
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
        id: oq.id,
        type: 'openquestion',
        content: oq.questionText,
        participant_count: participantCount,
        created_at: toString(oq.createdAt),
        updated_at: toString(oq.updatedAt),
        created_by: oq.createdBy,
        public_credit: oq.publicCredit,
        keywords: keywords,
        positive_votes: positiveVotes,
        negative_votes: negativeVotes,
        answer_count: answerCount,
        related_questions: sharedRelated + directlyRelated,
        discussion_id: discussionId
      } as nodeData
    `;

    return {
      query,
      params: {
        keywords,
        user_id,
        offset: int(offset).toNumber(),
        limit: int(limit).toNumber(),
      },
    };
  }

  private buildOpenQuestionCountQuery(filters: any): string {
    const { keywords, user_id } = filters;

    let query = `
      MATCH (oq:OpenQuestionNode)
      WHERE (oq.visibilityStatus <> false OR oq.visibilityStatus IS NULL)
    `;

    if (keywords && keywords.length > 0) {
      query += `
        AND EXISTS {
          MATCH (oq)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
    }

    if (user_id) {
      query += ` AND oq.createdBy = $user_id`;
    }

    query += ` RETURN count(oq) as total`;

    return query;
  }

  private transformOpenQuestionResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      // Build the metadata object
      const metadata: any = {
        keywords: data.keywords || [],
        votes: {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        },
        answer_count: this.toNumber(data.answer_count || 0),
        relatedQuestions: data.related_questions || [],
        discussionId: data.discussion_id,
      };

      return {
        id: data.id,
        type: 'openquestion',
        content: data.content,
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
