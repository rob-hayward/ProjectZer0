// src/nodes/universal/universal-graph.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { int } from 'neo4j-driver';

export interface UniversalNodeData {
  id: string;
  type: 'openquestion' | 'statement'; // | 'quantity';
  content: string;
  participant_count: number;
  created_at: string;
  updated_at?: string;
  created_by: string;
  public_credit: boolean;

  // Type-specific metadata
  metadata: {
    keywords: Array<{ word: string; frequency: number }>;

    // For binary voting nodes (openquestion, statement)
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
    answer_count?: number;
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

    // For statements - related statements and parent question
    relatedStatements?: Array<{
      nodeId: string;
      statement: string;
      sharedWord?: string;
      strength?: number;
      relationshipType: 'shared_keyword' | 'direct';
    }>;

    parentQuestion?: {
      nodeId: string;
      questionText: string;
      relationshipType: 'answers';
    };

    // Discussion data
    discussionId?: string;
    initialComment?: string;
  };
}

export interface ConsolidatedKeywordMetadata {
  sharedWords: string[];
  totalStrength: number;
  relationCount: number;
  primaryKeyword: string;
  strengthsByKeyword: { [keyword: string]: number };
  averageStrength: number;
}

export interface UniversalRelationshipData {
  id: string;
  source: string; // source node id
  target: string; // target node id
  type: 'shared_keyword' | 'related_to' | 'answers'; // | 'responds_to';
  metadata?: {
    keyword?: string; // for backward compatibility - will be primaryKeyword
    strength?: number; // for backward compatibility - will be totalStrength
    created_at?: string; // when the relationship was created

    // NEW: Consolidated keyword metadata
    consolidatedKeywords?: ConsolidatedKeywordMetadata;
  };
}

export interface UniversalGraphOptions {
  node_types?: Array<'openquestion' | 'statement'>; // | 'quantity'>;
  limit?: number;
  offset?: number;
  sort_by?: 'netVotes' | 'chronological' | 'participants';
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  user_id?: string;
  include_relationships?: boolean;
  relationship_types?: Array<'shared_keyword' | 'related_to' | 'answers'>; // | 'responds_to'>;
  // User context for fetching user-specific data
  requesting_user_id?: string;
}

export interface UniversalGraphResponse {
  nodes: UniversalNodeData[];
  relationships: UniversalRelationshipData[];
  total_count: number;
  has_more: boolean;
  performance_metrics?: {
    node_count: number;
    relationship_count: number;
    relationship_density: number;
    consolidation_ratio: number; // How much we reduced relationships
  };
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
      // Set defaults - now supporting both openquestion and statement
      const {
        node_types = ['openquestion', 'statement'],
        limit = 200,
        offset = 0,
        sort_by = 'netVotes',
        sort_direction = 'desc',
        keywords = [],
        user_id,
        include_relationships = true,
        relationship_types = ['shared_keyword', 'related_to', 'answers'],
        requesting_user_id,
      } = options;

      this.logger.debug(
        `Getting universal nodes with options: ${JSON.stringify(options)}`,
      );

      // Build and execute queries for each node type
      const allNodes: UniversalNodeData[] = [];

      // Get OpenQuestion nodes if requested
      if (node_types.includes('openquestion')) {
        const openQuestionNodes = await this.getOpenQuestionNodes({
          keywords,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...openQuestionNodes);
      }

      // Get Statement nodes if requested
      if (node_types.includes('statement')) {
        const statementNodes = await this.getStatementNodes({
          keywords,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...statementNodes);
      }

      // Sort combined results if we have multiple node types
      if (node_types.length > 1) {
        this.sortCombinedNodes(allNodes, sort_by, sort_direction);

        // Apply pagination to combined results
        const paginatedNodes = allNodes.slice(offset, offset + limit);
        allNodes.length = 0;
        allNodes.push(...paginatedNodes);
      }

      // Enhancement: Fetch user-specific data (vote status and visibility preferences)
      let enhancedNodes = allNodes;
      if (requesting_user_id && allNodes.length > 0) {
        enhancedNodes = await this.enhanceNodesWithUserData(
          allNodes,
          requesting_user_id,
        );
      }

      // Get node IDs for relationship query
      const nodeIds = enhancedNodes.map((n) => n.id);

      // Fetch relationships if requested
      const relationships = include_relationships
        ? await this.getUniversalRelationships(
            nodeIds,
            relationship_types,
            node_types,
          )
        : [];

      this.logger.debug(
        `Found ${relationships.length} relationships for ${enhancedNodes.length} nodes`,
      );

      // Calculate performance metrics
      const performance_metrics = {
        node_count: enhancedNodes.length,
        relationship_count: relationships.length,
        relationship_density:
          enhancedNodes.length > 0
            ? parseFloat(
                (relationships.length / enhancedNodes.length).toFixed(2),
              )
            : 0,
        consolidation_ratio: this.calculateConsolidationRatio(relationships),
      };

      // Get total count for pagination
      const total_count = await this.getTotalCount(node_types, {
        keywords,
        user_id,
      });
      const has_more = offset + enhancedNodes.length < total_count;

      this.logger.log(
        `Universal graph performance: ${performance_metrics.node_count} nodes, ${performance_metrics.relationship_count} relationships (density: ${performance_metrics.relationship_density}, consolidation: ${performance_metrics.consolidation_ratio}x)`,
      );

      return {
        nodes: enhancedNodes,
        relationships,
        total_count,
        has_more,
        performance_metrics,
      };
    } catch (error) {
      this.logger.error(
        `Error getting universal nodes: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get universal nodes: ${error.message}`);
    }
  }

  /**
   * Calculate how much we consolidated relationships
   * This helps track the optimization impact
   */
  private calculateConsolidationRatio(
    relationships: UniversalRelationshipData[],
  ): number {
    let originalCount = 0;
    let consolidatedCount = 0;

    relationships.forEach((rel) => {
      if (rel.type === 'shared_keyword' && rel.metadata?.consolidatedKeywords) {
        // This was a consolidated relationship
        originalCount += rel.metadata.consolidatedKeywords.relationCount;
        consolidatedCount += 1;
      } else {
        // This was not consolidated (direct relationship, etc.)
        originalCount += 1;
        consolidatedCount += 1;
      }
    });

    return originalCount > 0
      ? parseFloat((originalCount / consolidatedCount).toFixed(2))
      : 1.0;
  }

  private async getOpenQuestionNodes(
    params: any,
  ): Promise<UniversalNodeData[]> {
    const query = this.buildOpenQuestionQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformOpenQuestionResults(result.records);
  }

  private async getStatementNodes(params: any): Promise<UniversalNodeData[]> {
    const query = this.buildStatementQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformStatementResults(result.records);
  }

  // Fixed Statement Query in universal-graph.service.ts

  private buildStatementQuery(params: any): { query: string; params: any } {
    const { keywords, user_id, sort_by, sort_direction, limit, offset } =
      params;

    let query = `
      MATCH (s:StatementNode)
      WHERE (s.visibilityStatus <> false OR s.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      query += `
        AND EXISTS {
          MATCH (s)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
    }

    // Add user filter if specified
    if (user_id) {
      query += `
        AND s.createdBy = $user_id
      `;
    }

    // FIXED: Restructured query to prevent duplicates
    query += `
      // Get basic statement data first
      WITH s
      
      // Get keywords
      OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
      WITH s, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
      
      // Get vote counts
      OPTIONAL MATCH (s)<-[pv:VOTED_ON {status: 'agree'}]-()
      WITH s, keywords, count(DISTINCT pv) as positiveVotes
      
      OPTIONAL MATCH (s)<-[nv:VOTED_ON {status: 'disagree'}]-()
      WITH s, keywords, positiveVotes, count(DISTINCT nv) as negativeVotes
      
      // Get parent question (if statement answers a question)
      OPTIONAL MATCH (s)-[:ANSWERS]->(oq:OpenQuestionNode)
      WITH s, keywords, positiveVotes, negativeVotes, 
           CASE WHEN oq IS NOT NULL THEN {
             nodeId: oq.id,
             questionText: oq.questionText,
             relationshipType: 'answers'
           } ELSE null END as parentQuestion,
           positiveVotes + negativeVotes as participantCount
      
      // Get related statements via shared keywords (separate query to avoid cartesian product)
      OPTIONAL MATCH (s)-[st:SHARED_TAG]->(related:StatementNode)
      WHERE related.visibilityStatus <> false OR related.visibilityStatus IS NULL
      WITH s, keywords, positiveVotes, negativeVotes, parentQuestion, participantCount,
           collect(DISTINCT CASE WHEN related IS NOT NULL THEN {
             nodeId: related.id,
             statement: related.statement,
             sharedWord: st.word,
             strength: st.strength,
             relationshipType: 'shared_keyword'
           } ELSE null END) as sharedRelated
      
      // Get directly related statements (separate aggregation)
      OPTIONAL MATCH (s)-[:RELATED_TO]-(directRelated:StatementNode)
      WHERE directRelated.visibilityStatus <> false OR directRelated.visibilityStatus IS NULL
      WITH s, keywords, positiveVotes, negativeVotes, parentQuestion, participantCount, sharedRelated,
           collect(DISTINCT CASE WHEN directRelated IS NOT NULL THEN {
             nodeId: directRelated.id,
             statement: directRelated.statement,
             relationshipType: 'direct'
           } ELSE null END) as directlyRelated
      
      // Get discussion ID
      OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH s, keywords, positiveVotes, negativeVotes, parentQuestion, participantCount,
           sharedRelated, directlyRelated, d.id as discussionId
    `;

    // Add sorting
    if (sort_by === 'netVotes') {
      query += ` ORDER BY (positiveVotes - negativeVotes) ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'chronological') {
      query += ` ORDER BY s.createdAt ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'participants') {
      query += ` ORDER BY participantCount ${sort_direction.toUpperCase()}`;
    }

    // Add pagination
    query += `
      SKIP toInteger($offset)
      LIMIT toInteger($limit)
    `;

    // FIXED: Clean return statement with proper null filtering
    query += `
      RETURN {
        id: s.id,
        type: 'statement',
        content: s.statement,
        participant_count: participantCount,
        created_at: toString(s.createdAt),
        updated_at: toString(s.updatedAt),
        created_by: s.createdBy,
        public_credit: s.publicCredit,
        keywords: keywords,
        positive_votes: positiveVotes,
        negative_votes: negativeVotes,
        initial_comment: s.initialComment,
        parent_question: parentQuestion,
        related_statements: [rel in (sharedRelated + directlyRelated) WHERE rel IS NOT NULL],
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

  private transformStatementResults(records: any[]): UniversalNodeData[] {
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
        relatedStatements: data.related_statements || [],
        discussionId: data.discussion_id,
        initialComment: data.initial_comment,
      };

      // Add parent question if exists
      if (data.parent_question) {
        metadata.parentQuestion = data.parent_question;
      }

      return {
        id: data.id,
        type: 'statement',
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

  private sortCombinedNodes(
    nodes: UniversalNodeData[],
    sort_by: string,
    sort_direction: string,
  ): void {
    nodes.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sort_by) {
        case 'netVotes':
          aValue = a.metadata.votes.net;
          bValue = b.metadata.votes.net;
          break;
        case 'chronological':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'participants':
          aValue = a.participant_count;
          bValue = b.participant_count;
          break;
        default:
          return 0;
      }

      if (sort_direction === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
  }

  private async getTotalCount(
    node_types: Array<'openquestion' | 'statement'>,
    filters: any,
  ): Promise<number> {
    let total = 0;

    if (node_types.includes('openquestion')) {
      const openQuestionQuery = this.buildOpenQuestionCountQuery(filters);
      const result = await this.neo4jService.read(openQuestionQuery, filters);
      total += this.toNumber(result.records[0]?.get('total') || 0);
    }

    if (node_types.includes('statement')) {
      const statementQuery = this.buildStatementCountQuery(filters);
      const result = await this.neo4jService.read(statementQuery, filters);
      total += this.toNumber(result.records[0]?.get('total') || 0);
    }

    return total;
  }

  private buildStatementCountQuery(filters: any): string {
    const { keywords, user_id } = filters;

    let query = `
      MATCH (s:StatementNode)
      WHERE (s.visibilityStatus <> false OR s.visibilityStatus IS NULL)
    `;

    if (keywords && keywords.length > 0) {
      query += `
        AND EXISTS {
          MATCH (s)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
    }

    if (user_id) {
      query += ` AND s.createdBy = $user_id`;
    }

    query += ` RETURN count(s) as total`;

    return query;
  }

  // Enhanced method to fetch user-specific data for all nodes (both types)
  private async enhanceNodesWithUserData(
    nodes: UniversalNodeData[],
    userId: string,
  ): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug(
        `Enhancing ${nodes.length} nodes with user data for user ${userId}`,
      );

      const nodeIds = nodes.map((node) => node.id);

      // Batch fetch vote statuses for all nodes (both OpenQuestion and Statement)
      const voteStatuses = await this.batchGetVoteStatuses(
        nodeIds,
        userId,
        nodes,
      );

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

  // Updated batch fetch vote statuses for multiple node types
  private async batchGetVoteStatuses(
    nodeIds: string[],
    userId: string,
    nodes: UniversalNodeData[],
  ): Promise<Record<string, 'agree' | 'disagree' | null>> {
    try {
      if (nodeIds.length === 0) return {};

      // Group nodes by type
      const nodesByType = new Map<string, string[]>();
      nodes.forEach((node) => {
        const typeNodes = nodesByType.get(node.type) || [];
        typeNodes.push(node.id);
        nodesByType.set(node.type, typeNodes);
      });

      const voteStatuses: Record<string, 'agree' | 'disagree' | null> = {};

      // Fetch vote statuses for OpenQuestion nodes
      if (nodesByType.has('openquestion')) {
        const openQuestionIds = nodesByType.get('openquestion')!;
        const query = `
          MATCH (oq:OpenQuestionNode)
          WHERE oq.id IN $nodeIds
          OPTIONAL MATCH (u:User {sub: $userId})-[v:VOTED_ON]->(oq)
          RETURN oq.id as nodeId, v.status as voteStatus
        `;
        const result = await this.neo4jService.read(query, {
          nodeIds: openQuestionIds,
          userId,
        });
        result.records.forEach((record) => {
          const nodeId = record.get('nodeId');
          const voteStatus = record.get('voteStatus');
          voteStatuses[nodeId] = voteStatus as 'agree' | 'disagree' | null;
        });
      }

      // Fetch vote statuses for Statement nodes
      if (nodesByType.has('statement')) {
        const statementIds = nodesByType.get('statement')!;
        const query = `
          MATCH (s:StatementNode)
          WHERE s.id IN $nodeIds
          OPTIONAL MATCH (u:User {sub: $userId})-[v:VOTED_ON]->(s)
          RETURN s.id as nodeId, v.status as voteStatus
        `;
        const result = await this.neo4jService.read(query, {
          nodeIds: statementIds,
          userId,
        });
        result.records.forEach((record) => {
          const nodeId = record.get('nodeId');
          const voteStatus = record.get('voteStatus');
          voteStatuses[nodeId] = voteStatus as 'agree' | 'disagree' | null;
        });
      }

      this.logger.debug(
        `Fetched vote statuses for ${Object.keys(voteStatuses).length} nodes`,
      );
      return voteStatuses;
    } catch (error) {
      this.logger.error(`Error batch fetching vote statuses: ${error.message}`);
      return {};
    }
  }

  // Batch fetch visibility preferences for multiple nodes (same as before)
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

  private async getUniversalRelationships(
    nodeIds: string[],
    relationshipTypes: Array<'shared_keyword' | 'related_to' | 'answers'>,
    nodeTypes: Array<'openquestion' | 'statement'>,
  ): Promise<UniversalRelationshipData[]> {
    if (nodeIds.length === 0) return [];

    try {
      const relationships: UniversalRelationshipData[] = [];

      // Fetch shared keyword relationships if requested
      if (relationshipTypes.includes('shared_keyword')) {
        await this.addConsolidatedSharedKeywordRelationships(
          relationships,
          nodeIds,
          nodeTypes,
        );
      }

      // Fetch direct relationships if requested
      if (relationshipTypes.includes('related_to')) {
        await this.addDirectRelationships(relationships, nodeIds, nodeTypes);
      }

      // Fetch answer relationships if requested
      if (relationshipTypes.includes('answers')) {
        await this.addAnswerRelationships(relationships, nodeIds, nodeTypes);
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

  /**
   * OPTIMIZED: Consolidated shared keyword relationships
   * This is the core optimization that reduces relationship count by ~70%
   */
  private async addConsolidatedSharedKeywordRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: Array<'openquestion' | 'statement'>,
  ): Promise<void> {
    // OpenQuestion to OpenQuestion shared keywords
    if (nodeTypes.includes('openquestion')) {
      const oqSharedQuery = `
        MATCH (oq1:OpenQuestionNode)-[t1:TAGGED]->(w:WordNode)<-[t2:TAGGED]-(oq2:OpenQuestionNode)
        WHERE oq1.id IN $nodeIds AND oq2.id IN $nodeIds AND oq1.id < oq2.id
        RETURN DISTINCT oq1.id as source, oq2.id as target, 
               w.word as keyword,
               t1.frequency as sourceFreq,
               t2.frequency as targetFreq,
               'shared_keyword' as type
      `;

      const oqResult = await this.neo4jService.read(oqSharedQuery, { nodeIds });
      this.processConsolidatedSharedKeywordResults(
        oqResult.records,
        relationships,
      );
    }

    // Statement to Statement shared keywords
    if (nodeTypes.includes('statement')) {
      const stSharedQuery = `
        MATCH (s1:StatementNode)-[t1:TAGGED]->(w:WordNode)<-[t2:TAGGED]-(s2:StatementNode)
        WHERE s1.id IN $nodeIds AND s2.id IN $nodeIds AND s1.id < s2.id
        RETURN DISTINCT s1.id as source, s2.id as target,
               w.word as keyword,
               t1.frequency as sourceFreq,
               t2.frequency as targetFreq,
               'shared_keyword' as type
      `;

      const stResult = await this.neo4jService.read(stSharedQuery, { nodeIds });
      this.processConsolidatedSharedKeywordResults(
        stResult.records,
        relationships,
      );
    }

    // OpenQuestion to Statement shared keywords (cross-type)
    if (nodeTypes.includes('openquestion') && nodeTypes.includes('statement')) {
      const crossSharedQuery = `
        MATCH (oq:OpenQuestionNode)-[t1:TAGGED]->(w:WordNode)<-[t2:TAGGED]-(s:StatementNode)
        WHERE oq.id IN $nodeIds AND s.id IN $nodeIds
        RETURN DISTINCT oq.id as source, s.id as target,
               w.word as keyword,
               t1.frequency as sourceFreq,
               t2.frequency as targetFreq,
               'shared_keyword' as type
      `;

      const crossResult = await this.neo4jService.read(crossSharedQuery, {
        nodeIds,
      });
      this.processConsolidatedSharedKeywordResults(
        crossResult.records,
        relationships,
      );
    }
  }

  /**
   * CORE OPTIMIZATION: Process and consolidate shared keyword relationships
   * Groups all shared keywords between node pairs into single relationship objects
   */
  private processConsolidatedSharedKeywordResults(
    records: any[],
    relationships: UniversalRelationshipData[],
  ): void {
    // Group relationships by node pairs
    const consolidationMap = new Map<
      string,
      {
        source: string;
        target: string;
        keywords: Array<{
          word: string;
          sourceFreq: number;
          targetFreq: number;
          strength: number;
        }>;
      }
    >();

    // Process each shared keyword relationship
    records.forEach((record) => {
      const source = record.get('source');
      const target = record.get('target');
      const keyword = record.get('keyword');
      const sourceFreq = this.toNumber(record.get('sourceFreq') || 0);
      const targetFreq = this.toNumber(record.get('targetFreq') || 0);

      // Calculate strength as product of frequencies (like the original backend logic)
      const strength = sourceFreq * targetFreq;

      const pairKey = `${source}-${target}`;

      if (consolidationMap.has(pairKey)) {
        // Add to existing pair
        consolidationMap.get(pairKey)!.keywords.push({
          word: keyword,
          sourceFreq,
          targetFreq,
          strength,
        });
      } else {
        // Create new pair
        consolidationMap.set(pairKey, {
          source,
          target,
          keywords: [
            {
              word: keyword,
              sourceFreq,
              targetFreq,
              strength,
            },
          ],
        });
      }
    });

    // Convert consolidated data to relationship objects
    consolidationMap.forEach((consolidatedData, pairKey) => {
      const { source, target, keywords } = consolidatedData;

      // Calculate consolidated metadata
      const totalStrength = keywords.reduce((sum, k) => sum + k.strength, 0);
      const averageStrength = totalStrength / keywords.length;

      // Sort keywords by strength to identify primary keyword
      const sortedKeywords = keywords.sort((a, b) => b.strength - a.strength);
      const primaryKeyword = sortedKeywords[0].word;

      // Build strengthsByKeyword object
      const strengthsByKeyword: { [keyword: string]: number } = {};
      keywords.forEach((k) => {
        strengthsByKeyword[k.word] = k.strength;
      });

      // Create consolidated relationship metadata
      const consolidatedKeywords: ConsolidatedKeywordMetadata = {
        sharedWords: keywords.map((k) => k.word),
        totalStrength: parseFloat(totalStrength.toFixed(3)),
        relationCount: keywords.length,
        primaryKeyword,
        strengthsByKeyword,
        averageStrength: parseFloat(averageStrength.toFixed(3)),
      };

      // Create the consolidated relationship
      relationships.push({
        id: `consolidated-${pairKey}`,
        source,
        target,
        type: 'shared_keyword',
        metadata: {
          // Backward compatibility fields
          keyword: primaryKeyword,
          strength: totalStrength,

          // New consolidated data
          consolidatedKeywords,
        },
      });
    });

    this.logger.debug(
      `Consolidated ${records.length} keyword relationships into ${consolidationMap.size} consolidated relationships`,
    );
  }

  private async addDirectRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: Array<'openquestion' | 'statement'>,
  ): Promise<void> {
    // OpenQuestion to OpenQuestion direct relationships
    if (nodeTypes.includes('openquestion')) {
      const oqDirectQuery = `
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

      const oqResult = await this.neo4jService.read(oqDirectQuery, { nodeIds });
      this.processDirectRelationshipResults(oqResult.records, relationships);
    }

    // Statement to Statement direct relationships
    if (nodeTypes.includes('statement')) {
      const stDirectQuery = `
        MATCH (s1:StatementNode)-[r:RELATED_TO]-(s2:StatementNode)
        WHERE s1.id IN $nodeIds AND s2.id IN $nodeIds
        AND id(s1) < id(s2)
        RETURN DISTINCT {
          source: s1.id,
          target: s2.id,
          type: 'related_to',
          created_at: CASE WHEN r.createdAt IS NOT NULL THEN toString(r.createdAt) ELSE null END
        } as rel
      `;

      const stResult = await this.neo4jService.read(stDirectQuery, { nodeIds });
      this.processDirectRelationshipResults(stResult.records, relationships);
    }
  }

  private async addAnswerRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: Array<'openquestion' | 'statement'>,
  ): Promise<void> {
    // Only process if we have both openquestion and statement types
    if (nodeTypes.includes('openquestion') && nodeTypes.includes('statement')) {
      const answerQuery = `
        MATCH (s:StatementNode)-[r:ANSWERS]->(oq:OpenQuestionNode)
        WHERE s.id IN $nodeIds AND oq.id IN $nodeIds
        RETURN DISTINCT {
          source: s.id,
          target: oq.id,
          type: 'answers',
          created_at: CASE WHEN s.createdAt IS NOT NULL THEN toString(s.createdAt) ELSE null END
        } as rel
      `;

      const answerResult = await this.neo4jService.read(answerQuery, {
        nodeIds,
      });

      answerResult.records.forEach((record) => {
        const rel = record.get('rel');
        relationships.push({
          id: `answers-${rel.source}-${rel.target}`,
          source: rel.source,
          target: rel.target,
          type: 'answers',
          metadata: {
            strength: 1.0,
            created_at: rel.created_at,
          },
        });
      });
    }
  }

  private processDirectRelationshipResults(
    records: any[],
    relationships: UniversalRelationshipData[],
  ): void {
    records.forEach((record) => {
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
