// src/nodes/universal/universal-graph.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { CategoryService } from '../category/category.service';
import { int } from 'neo4j-driver';

export interface UniversalNodeData {
  id: string;
  type: 'openquestion' | 'statement' | 'answer' | 'quantity' | 'category';
  content: string;
  participant_count: number;
  created_at: string;
  updated_at?: string;
  created_by: string;
  public_credit: boolean;

  // Type-specific metadata
  metadata: {
    keywords: Array<{ word: string; frequency: number }>;

    // For voting nodes (all except WordNode, DefinitionNode, etc.)
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

    // Categories associated with this node
    categories?: Array<{
      id: string;
      name: string;
      description?: string;
    }>;

    // For open questions
    answer_count?: number;
    answers?: Array<{
      id: string;
      answerText: string;
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
      relationshipType: 'shared_keyword' | 'direct' | 'shared_category';
    }>;

    // For statements - related statements and parent question
    relatedStatements?: Array<{
      nodeId: string;
      statement: string;
      sharedWord?: string;
      strength?: number;
      relationshipType: 'shared_keyword' | 'direct' | 'shared_category';
    }>;

    parentQuestion?: {
      nodeId: string;
      questionText: string;
      relationshipType: 'answers';
    };

    // For answers
    parentQuestionData?: {
      nodeId: string;
      questionText: string;
    };

    // For quantities
    unitCategory?: {
      id: string;
      name: string;
    };
    defaultUnit?: {
      id: string;
      name: string;
    };
    responseCount?: number;

    // For categories
    composedWords?: Array<{
      id: string;
      word: string;
    }>;
    parentCategory?: {
      id: string;
      name: string;
    };
    childCategories?: Array<{
      id: string;
      name: string;
    }>;
    usageCount?: number;

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
  type:
    | 'shared_keyword'
    | 'related_to'
    | 'answers'
    | 'shared_category'
    | 'categorized_as';
  metadata?: {
    keyword?: string; // for backward compatibility - will be primaryKeyword
    strength?: number; // for backward compatibility - will be totalStrength
    created_at?: string; // when the relationship was created

    // NEW: Consolidated keyword metadata
    consolidatedKeywords?: ConsolidatedKeywordMetadata;

    // NEW: Category-based relationship metadata
    categoryData?: {
      categoryId: string;
      categoryName: string;
      sharedCategories?: string[]; // For shared category relationships
    };
  };
}

export interface UniversalGraphOptions {
  // Node Type Filtering - ENHANCED with new node types
  node_types?: Array<
    'openquestion' | 'statement' | 'answer' | 'quantity' | 'category'
  >;
  includeNodeTypes?: boolean; // true = include specified types, false = exclude them

  // Category Filtering - NEW
  categories?: string[]; // Category IDs to filter by
  includeCategoriesFilter?: boolean; // true = include nodes with these categories, false = exclude

  // Existing filtering options
  limit?: number;
  offset?: number;
  sort_by?: 'netVotes' | 'chronological' | 'participants' | 'category_overlap';
  sort_direction?: 'asc' | 'desc';
  keywords?: string[];
  includeKeywordsFilter?: boolean; // true = include nodes with these keywords, false = exclude
  user_id?: string;
  include_relationships?: boolean;
  relationship_types?: Array<
    | 'shared_keyword'
    | 'related_to'
    | 'answers'
    | 'shared_category'
    | 'categorized_as'
  >;

  // User context for fetching user-specific data
  requesting_user_id?: string;

  // Discovery options - NEW
  minCategoryOverlap?: number; // Minimum number of shared categories for relationships
  includeCategorizationData?: boolean; // Include category metadata for nodes
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
    category_filtered_count?: number; // How many nodes were filtered by categories
  };
}

@Injectable()
export class UniversalGraphService {
  private readonly logger = new Logger(UniversalGraphService.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
    private readonly visibilityService: VisibilityService,
    private readonly categoryService: CategoryService, // NEW: CategoryService injection
  ) {}

  async getUniversalNodes(
    options: UniversalGraphOptions,
  ): Promise<UniversalGraphResponse> {
    try {
      // Set defaults - now supporting all content node types
      const {
        node_types = ['openquestion', 'statement'], // Keep backward compatibility as default
        includeNodeTypes = true,
        categories = [],
        includeCategoriesFilter = true,
        limit = 200,
        offset = 0,
        sort_by = 'netVotes',
        sort_direction = 'desc',
        keywords = [],
        includeKeywordsFilter = true,
        user_id,
        include_relationships = true,
        relationship_types = [
          'shared_keyword',
          'related_to',
          'answers',
          'shared_category',
        ],
        requesting_user_id,
        minCategoryOverlap = 1,
        includeCategorizationData = false,
      } = options;

      this.logger.debug(
        `Getting universal nodes with enhanced options: ${JSON.stringify(options)}`,
      );

      // Build and execute queries for each node type
      const allNodes: UniversalNodeData[] = [];

      // Determine which node types to process based on include/exclude logic
      const allPossibleTypes = [
        'openquestion',
        'statement',
        'answer',
        'quantity',
        'category',
      ];
      const effectiveNodeTypes = this.determineEffectiveNodeTypes(
        node_types,
        includeNodeTypes,
        allPossibleTypes,
      );

      // Get OpenQuestion nodes if requested
      if (effectiveNodeTypes.includes('openquestion')) {
        const openQuestionNodes = await this.getOpenQuestionNodes({
          keywords,
          includeKeywordsFilter,
          categories,
          includeCategoriesFilter,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...openQuestionNodes);
      }

      // Get Statement nodes if requested
      if (effectiveNodeTypes.includes('statement')) {
        const statementNodes = await this.getStatementNodes({
          keywords,
          includeKeywordsFilter,
          categories,
          includeCategoriesFilter,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...statementNodes);
      }

      // Get Answer nodes if requested - NEW
      if (effectiveNodeTypes.includes('answer')) {
        const answerNodes = await this.getAnswerNodes({
          keywords,
          includeKeywordsFilter,
          categories,
          includeCategoriesFilter,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...answerNodes);
      }

      // Get Quantity nodes if requested - NEW
      if (effectiveNodeTypes.includes('quantity')) {
        const quantityNodes = await this.getQuantityNodes({
          keywords,
          includeKeywordsFilter,
          categories,
          includeCategoriesFilter,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...quantityNodes);
      }

      // Get Category nodes if requested - NEW
      if (effectiveNodeTypes.includes('category')) {
        const categoryNodes = await this.getCategoryNodes({
          keywords,
          includeKeywordsFilter,
          user_id,
          sort_by,
          sort_direction,
          limit,
          offset,
        });
        allNodes.push(...categoryNodes);
      }

      // Apply category overlap sorting if requested
      if (sort_by === 'category_overlap') {
        await this.applyCategoryOverlapSorting(
          allNodes,
          categories,
          sort_direction,
        );
      }

      // Sort combined results if we have multiple node types
      if (effectiveNodeTypes.length > 1 && sort_by !== 'category_overlap') {
        this.sortCombinedNodes(allNodes, sort_by, sort_direction);
      }

      // Apply pagination to combined results
      const totalCount = allNodes.length;
      const paginatedNodes = allNodes.slice(offset, offset + limit);

      // Enhancement: Fetch user-specific data and category data if requested
      let enhancedNodes = paginatedNodes;
      if (requesting_user_id && paginatedNodes.length > 0) {
        enhancedNodes = await this.enhanceNodesWithUserData(
          paginatedNodes,
          requesting_user_id,
        );
      }

      if (includeCategorizationData && enhancedNodes.length > 0) {
        enhancedNodes = await this.enhanceNodesWithCategoryData(enhancedNodes);
      }

      // Get node IDs for relationship query
      const nodeIds = enhancedNodes.map((n) => n.id);

      // Fetch relationships if requested (now supports category relationships)
      const relationships = include_relationships
        ? await this.getRelationships(
            nodeIds,
            effectiveNodeTypes,
            relationship_types,
            minCategoryOverlap,
          )
        : [];

      // Calculate performance metrics
      const performance_metrics = {
        node_count: enhancedNodes.length,
        relationship_count: relationships.length,
        relationship_density:
          enhancedNodes.length > 0
            ? relationships.length /
              ((enhancedNodes.length * (enhancedNodes.length - 1)) / 2)
            : 0,
        consolidation_ratio: this.calculateConsolidationRatio(relationships),
        category_filtered_count: categories.length > 0 ? totalCount : undefined,
      };

      return {
        nodes: enhancedNodes,
        relationships,
        total_count: totalCount,
        has_more: offset + limit < totalCount,
        performance_metrics,
      };
    } catch (error) {
      this.logger.error(
        `Error in getUniversalNodes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // NEW: Helper to determine effective node types based on include/exclude logic
  private determineEffectiveNodeTypes(
    specifiedTypes: string[],
    includeNodeTypes: boolean,
    allPossibleTypes: string[],
  ): string[] {
    if (includeNodeTypes) {
      // Include only the specified types
      return specifiedTypes;
    } else {
      // Exclude the specified types, include all others
      return allPossibleTypes.filter((type) => !specifiedTypes.includes(type));
    }
  }

  // ENHANCED: Support category filtering
  private async getOpenQuestionNodes(
    params: any,
  ): Promise<UniversalNodeData[]> {
    const query = this.buildOpenQuestionQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformOpenQuestionResults(result.records);
  }

  // ENHANCED: Support category filtering
  private async getStatementNodes(params: any): Promise<UniversalNodeData[]> {
    const query = this.buildStatementQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformStatementResults(result.records);
  }

  // NEW: Answer node support
  private async getAnswerNodes(params: any): Promise<UniversalNodeData[]> {
    const query = this.buildAnswerQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformAnswerResults(result.records);
  }

  // NEW: Quantity node support
  private async getQuantityNodes(params: any): Promise<UniversalNodeData[]> {
    const query = this.buildQuantityQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformQuantityResults(result.records);
  }

  // NEW: Category node support
  private async getCategoryNodes(params: any): Promise<UniversalNodeData[]> {
    const query = this.buildCategoryQuery(params);
    const result = await this.neo4jService.read(query.query, query.params);
    return this.transformCategoryResults(result.records);
  }

  // ENHANCED: Category filtering support for OpenQuestion nodes
  private buildOpenQuestionQuery(params: any): { query: string; params: any } {
    const {
      keywords,
      includeKeywordsFilter,
      categories,
      includeCategoriesFilter,
      user_id,
      sort_by,
      sort_direction,
      limit,
      offset,
    } = params;

    let query = `
      MATCH (oq:OpenQuestionNode)
      WHERE (oq.visibilityStatus <> false OR oq.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      const keywordCondition = `
        EXISTS {
          MATCH (oq)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
      query += includeKeywordsFilter
        ? ` AND ${keywordCondition}`
        : ` AND NOT ${keywordCondition}`;
    }

    // NEW: Add category filter if specified
    if (categories && categories.length > 0) {
      const categoryCondition = `
        EXISTS {
          MATCH (oq)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categories AND c.inclusionNetVotes > 0
        }
      `;
      query += includeCategoriesFilter
        ? ` AND ${categoryCondition}`
        : ` AND NOT ${categoryCondition}`;
    }

    // Add user filter if specified
    if (user_id) {
      query += ` AND oq.createdBy = $user_id`;
    }

    // Continue with existing query structure for data aggregation
    query += `
      // Get basic question data first
      WITH oq
      
      // Get keywords
      OPTIONAL MATCH (oq)-[t:TAGGED]->(w:WordNode)
      WITH oq, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
      
      // Get vote counts (inclusion only for OpenQuestions)
      OPTIONAL MATCH (oq)<-[pv:VOTED_ON {status: 'agree', kind: 'INCLUSION'}]-()
      WITH oq, keywords, count(DISTINCT pv) as positiveVotes
      
      OPTIONAL MATCH (oq)<-[nv:VOTED_ON {status: 'disagree', kind: 'INCLUSION'}]-()
      WITH oq, keywords, positiveVotes, count(DISTINCT nv) as negativeVotes
      
      // Get discussion ID
      OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH oq, keywords, positiveVotes, negativeVotes, d.id as discussionId
      
      // Get answer count
      OPTIONAL MATCH (a:AnswerNode)-[:ANSWERS]->(oq)
      WITH oq, keywords, positiveVotes, negativeVotes, discussionId, count(a) as answerCount
    `;

    // Add sorting
    this.addSortingToQuery(query, sort_by, sort_direction, 'oq');

    // Add pagination
    query += ` SKIP $offset LIMIT $limit`;

    query += `
      RETURN {
        id: oq.id,
        type: 'openquestion',
        content: oq.questionText,
        participant_count: positiveVotes + negativeVotes,
        created_at: toString(oq.createdAt),
        updated_at: toString(oq.updatedAt),
        created_by: oq.createdBy,
        public_credit: oq.publicCredit,
        keywords: keywords,
        positive_votes: positiveVotes,
        negative_votes: negativeVotes,
        initial_comment: oq.initialComment,
        answer_count: answerCount,
        discussion_id: discussionId
      } as nodeData
    `;

    return {
      query,
      params: {
        keywords,
        categories,
        user_id,
        offset: int(offset).toNumber(),
        limit: int(limit).toNumber(),
      },
    };
  }

  // ENHANCED: Category filtering support for Statement nodes
  private buildStatementQuery(params: any): { query: string; params: any } {
    const {
      keywords,
      includeKeywordsFilter,
      categories,
      includeCategoriesFilter,
      user_id,
      sort_by,
      sort_direction,
      limit,
      offset,
    } = params;

    let query = `
      MATCH (s:StatementNode)
      WHERE (s.visibilityStatus <> false OR s.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      const keywordCondition = `
        EXISTS {
          MATCH (s)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
      query += includeKeywordsFilter
        ? ` AND ${keywordCondition}`
        : ` AND NOT ${keywordCondition}`;
    }

    // NEW: Add category filter if specified
    if (categories && categories.length > 0) {
      const categoryCondition = `
        EXISTS {
          MATCH (s)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categories AND c.inclusionNetVotes > 0
        }
      `;
      query += includeCategoriesFilter
        ? ` AND ${categoryCondition}`
        : ` AND NOT ${categoryCondition}`;
    }

    // Add user filter if specified
    if (user_id) {
      query += ` AND s.createdBy = $user_id`;
    }

    // Continue with existing query structure for data aggregation
    query += `
      // Get basic statement data first
      WITH s
      
      // Get keywords
      OPTIONAL MATCH (s)-[t:TAGGED]->(w:WordNode)
      WITH s, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
      
      // Get inclusion vote counts
      OPTIONAL MATCH (s)<-[pv:VOTED_ON {status: 'agree', kind: 'INCLUSION'}]-()
      WITH s, keywords, count(DISTINCT pv) as positiveVotes
      
      OPTIONAL MATCH (s)<-[nv:VOTED_ON {status: 'disagree', kind: 'INCLUSION'}]-()
      WITH s, keywords, positiveVotes, count(DISTINCT nv) as negativeVotes
      
      // Get content vote counts (for statements that have passed inclusion)
      OPTIONAL MATCH (s)<-[cpv:VOTED_ON {status: 'agree', kind: 'CONTENT'}]-()
      WITH s, keywords, positiveVotes, negativeVotes, count(DISTINCT cpv) as contentPositiveVotes
      
      OPTIONAL MATCH (s)<-[cnv:VOTED_ON {status: 'disagree', kind: 'CONTENT'}]-()
      WITH s, keywords, positiveVotes, negativeVotes, contentPositiveVotes, count(DISTINCT cnv) as contentNegativeVotes
      
      // Get parent question (if statement answers a question)
      OPTIONAL MATCH (s)-[:ANSWERS]->(oq:OpenQuestionNode)
      WITH s, keywords, positiveVotes, negativeVotes, contentPositiveVotes, contentNegativeVotes,
           CASE WHEN oq IS NOT NULL THEN {
             nodeId: oq.id,
             questionText: oq.questionText,
             relationshipType: 'answers'
           } ELSE null END as parentQuestion
      
      // Get discussion ID
      OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH s, keywords, positiveVotes, negativeVotes, contentPositiveVotes, contentNegativeVotes,
           parentQuestion, d.id as discussionId
    `;

    // Add sorting
    this.addSortingToQuery(query, sort_by, sort_direction, 's');

    // Add pagination
    query += ` SKIP $offset LIMIT $limit`;

    query += `
      RETURN {
        id: s.id,
        type: 'statement',
        content: s.statement,
        participant_count: positiveVotes + negativeVotes + contentPositiveVotes + contentNegativeVotes,
        created_at: toString(s.createdAt),
        updated_at: toString(s.updatedAt),
        created_by: s.createdBy,
        public_credit: s.publicCredit,
        keywords: keywords,
        positive_votes: CASE 
          WHEN s.inclusionNetVotes > 0 THEN contentPositiveVotes
          ELSE positiveVotes
        END,
        negative_votes: CASE 
          WHEN s.inclusionNetVotes > 0 THEN contentNegativeVotes
          ELSE negativeVotes
        END,
        initial_comment: s.initialComment,
        parent_question: parentQuestion,
        discussion_id: discussionId
      } as nodeData
    `;

    return {
      query,
      params: {
        keywords,
        categories,
        user_id,
        offset: int(offset).toNumber(),
        limit: int(limit).toNumber(),
      },
    };
  }

  // NEW: Build query for Answer nodes
  private buildAnswerQuery(params: any): { query: string; params: any } {
    const {
      keywords,
      includeKeywordsFilter,
      categories,
      includeCategoriesFilter,
      user_id,
      sort_by,
      sort_direction,
      limit,
      offset,
    } = params;

    let query = `
      MATCH (a:AnswerNode)
      WHERE (a.visibilityStatus <> false OR a.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      const keywordCondition = `
        EXISTS {
          MATCH (a)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
      query += includeKeywordsFilter
        ? ` AND ${keywordCondition}`
        : ` AND NOT ${keywordCondition}`;
    }

    // Add category filter if specified
    if (categories && categories.length > 0) {
      const categoryCondition = `
        EXISTS {
          MATCH (a)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categories AND c.inclusionNetVotes > 0
        }
      `;
      query += includeCategoriesFilter
        ? ` AND ${categoryCondition}`
        : ` AND NOT ${categoryCondition}`;
    }

    // Add user filter if specified
    if (user_id) {
      query += ` AND a.createdBy = $user_id`;
    }

    query += `
      // Get basic answer data
      WITH a
      
      // Get keywords
      OPTIONAL MATCH (a)-[t:TAGGED]->(w:WordNode)
      WITH a, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
      
      // Get vote counts (both inclusion and content for answers)
      OPTIONAL MATCH (a)<-[ipv:VOTED_ON {status: 'agree', kind: 'INCLUSION'}]-()
      WITH a, keywords, count(DISTINCT ipv) as inclusionPositiveVotes
      
      OPTIONAL MATCH (a)<-[inv:VOTED_ON {status: 'disagree', kind: 'INCLUSION'}]-()
      WITH a, keywords, inclusionPositiveVotes, count(DISTINCT inv) as inclusionNegativeVotes
      
      OPTIONAL MATCH (a)<-[cpv:VOTED_ON {status: 'agree', kind: 'CONTENT'}]-()
      WITH a, keywords, inclusionPositiveVotes, inclusionNegativeVotes, count(DISTINCT cpv) as contentPositiveVotes
      
      OPTIONAL MATCH (a)<-[cnv:VOTED_ON {status: 'disagree', kind: 'CONTENT'}]-()
      WITH a, keywords, inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, count(DISTINCT cnv) as contentNegativeVotes
      
      // Get parent question
      OPTIONAL MATCH (a)-[:ANSWERS]->(oq:OpenQuestionNode)
      WITH a, keywords, inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, contentNegativeVotes,
           CASE WHEN oq IS NOT NULL THEN {
             nodeId: oq.id,
             questionText: oq.questionText
           } ELSE null END as parentQuestion
      
      // Get discussion ID
      OPTIONAL MATCH (a)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH a, keywords, inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, contentNegativeVotes,
           parentQuestion, d.id as discussionId
    `;

    // Add sorting
    this.addSortingToQuery(query, sort_by, sort_direction, 'a');

    // Add pagination
    query += ` SKIP $offset LIMIT $limit`;

    query += `
      RETURN {
        id: a.id,
        type: 'answer',
        content: a.answerText,
        participant_count: inclusionPositiveVotes + inclusionNegativeVotes + contentPositiveVotes + contentNegativeVotes,
        created_at: toString(a.createdAt),
        updated_at: toString(a.updatedAt),
        created_by: a.createdBy,
        public_credit: a.publicCredit,
        keywords: keywords,
        positive_votes: CASE 
          WHEN a.inclusionNetVotes > 0 THEN contentPositiveVotes
          ELSE inclusionPositiveVotes
        END,
        negative_votes: CASE 
          WHEN a.inclusionNetVotes > 0 THEN contentNegativeVotes
          ELSE inclusionNegativeVotes
        END,
        parent_question: parentQuestion,
        discussion_id: discussionId
      } as nodeData
    `;

    return {
      query,
      params: {
        keywords,
        categories,
        user_id,
        offset: int(offset).toNumber(),
        limit: int(limit).toNumber(),
      },
    };
  }

  // NEW: Build query for Quantity nodes
  private buildQuantityQuery(params: any): { query: string; params: any } {
    const {
      keywords,
      includeKeywordsFilter,
      categories,
      includeCategoriesFilter,
      user_id,
      sort_by,
      sort_direction,
      limit,
      offset,
    } = params;

    let query = `
      MATCH (q:QuantityNode)
      WHERE (q.visibilityStatus <> false OR q.visibilityStatus IS NULL)
    `;

    // Add keyword filter if specified
    if (keywords && keywords.length > 0) {
      const keywordCondition = `
        EXISTS {
          MATCH (q)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }
      `;
      query += includeKeywordsFilter
        ? ` AND ${keywordCondition}`
        : ` AND NOT ${keywordCondition}`;
    }

    // Add category filter if specified
    if (categories && categories.length > 0) {
      const categoryCondition = `
        EXISTS {
          MATCH (q)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categories AND c.inclusionNetVotes > 0
        }
      `;
      query += includeCategoriesFilter
        ? ` AND ${categoryCondition}`
        : ` AND NOT ${categoryCondition}`;
    }

    // Add user filter if specified
    if (user_id) {
      query += ` AND q.createdBy = $user_id`;
    }

    query += `
      // Get basic quantity data
      WITH q
      
      // Get keywords
      OPTIONAL MATCH (q)-[t:TAGGED]->(w:WordNode)
      WITH q, collect(DISTINCT {word: w.word, frequency: t.frequency}) as keywords
      
      // Get vote counts (both inclusion and content for quantities)
      OPTIONAL MATCH (q)<-[ipv:VOTED_ON {status: 'agree', kind: 'INCLUSION'}]-()
      WITH q, keywords, count(DISTINCT ipv) as inclusionPositiveVotes
      
      OPTIONAL MATCH (q)<-[inv:VOTED_ON {status: 'disagree', kind: 'INCLUSION'}]-()
      WITH q, keywords, inclusionPositiveVotes, count(DISTINCT inv) as inclusionNegativeVotes
      
      OPTIONAL MATCH (q)<-[cpv:VOTED_ON {status: 'agree', kind: 'CONTENT'}]-()
      WITH q, keywords, inclusionPositiveVotes, inclusionNegativeVotes, count(DISTINCT cpv) as contentPositiveVotes
      
      OPTIONAL MATCH (q)<-[cnv:VOTED_ON {status: 'disagree', kind: 'CONTENT'}]-()
      WITH q, keywords, inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, count(DISTINCT cnv) as contentNegativeVotes
      
      // Get discussion ID
      OPTIONAL MATCH (q)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH q, keywords, inclusionPositiveVotes, inclusionNegativeVotes, contentPositiveVotes, contentNegativeVotes,
           d.id as discussionId
    `;

    // Add sorting
    this.addSortingToQuery(query, sort_by, sort_direction, 'q');

    // Add pagination
    query += ` SKIP $offset LIMIT $limit`;

    query += `
      RETURN {
        id: q.id,
        type: 'quantity',
        content: q.question,
        participant_count: inclusionPositiveVotes + inclusionNegativeVotes + contentPositiveVotes + contentNegativeVotes,
        created_at: toString(q.createdAt),
        updated_at: toString(q.updatedAt),
        created_by: q.createdBy,
        public_credit: q.publicCredit,
        keywords: keywords,
        positive_votes: CASE 
          WHEN q.inclusionNetVotes > 0 THEN contentPositiveVotes
          ELSE inclusionPositiveVotes
        END,
        negative_votes: CASE 
          WHEN q.inclusionNetVotes > 0 THEN contentNegativeVotes
          ELSE inclusionNegativeVotes
        END,
        unit_category_id: q.unitCategoryId,
        default_unit_id: q.defaultUnitId,
        response_count: q.responseCount,
        discussion_id: discussionId
      } as nodeData
    `;

    return {
      query,
      params: {
        keywords,
        categories,
        user_id,
        offset: int(offset).toNumber(),
        limit: int(limit).toNumber(),
      },
    };
  }

  // NEW: Build query for Category nodes
  private buildCategoryQuery(params: any): { query: string; params: any } {
    const {
      keywords,
      includeKeywordsFilter,
      user_id,
      sort_by,
      sort_direction,
      limit,
      offset,
    } = params;

    let query = `
      MATCH (c:CategoryNode)
      WHERE (c.visibilityStatus <> false OR c.visibilityStatus IS NULL)
      AND c.inclusionNetVotes > 0
    `;

    // Add keyword filter if specified (search in category name and composed words)
    if (keywords && keywords.length > 0) {
      const keywordCondition = `
        (c.name IN $keywords OR EXISTS {
          MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
          WHERE w.word IN $keywords
        })
      `;
      query += includeKeywordsFilter
        ? ` AND ${keywordCondition}`
        : ` AND NOT ${keywordCondition}`;
    }

    // Add user filter if specified
    if (user_id) {
      query += ` AND c.createdBy = $user_id`;
    }

    query += `
      // Get basic category data
      WITH c
      
      // Get composed words
      OPTIONAL MATCH (c)-[:COMPOSED_OF]->(w:WordNode)
      WITH c, collect(DISTINCT {id: w.id, word: w.word}) as composedWords
      
      // Get vote counts (inclusion only for categories)
      OPTIONAL MATCH (c)<-[pv:VOTED_ON {status: 'agree', kind: 'INCLUSION'}]-()
      WITH c, composedWords, count(DISTINCT pv) as positiveVotes
      
      OPTIONAL MATCH (c)<-[nv:VOTED_ON {status: 'disagree', kind: 'INCLUSION'}]-()
      WITH c, composedWords, positiveVotes, count(DISTINCT nv) as negativeVotes
      
      // Get parent category
      OPTIONAL MATCH (parent:CategoryNode)-[:PARENT_OF]->(c)
      WITH c, composedWords, positiveVotes, negativeVotes,
           CASE WHEN parent IS NOT NULL THEN {
             id: parent.id,
             name: parent.name
           } ELSE null END as parentCategory
      
      // Get child categories
      OPTIONAL MATCH (c)-[:PARENT_OF]->(child:CategoryNode)
      WITH c, composedWords, positiveVotes, negativeVotes, parentCategory,
           collect(DISTINCT {id: child.id, name: child.name}) as childCategories
      
      // Get usage count (nodes categorized under this category)
      OPTIONAL MATCH (n)-[:CATEGORIZED_AS]->(c)
      WHERE n:WordNode OR n:DefinitionNode OR n:OpenQuestionNode OR 
            n:AnswerNode OR n:StatementNode OR n:QuantityNode
      WITH c, composedWords, positiveVotes, negativeVotes, parentCategory, childCategories,
           count(DISTINCT n) as usageCount
      
      // Get discussion ID
      OPTIONAL MATCH (c)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      WITH c, composedWords, positiveVotes, negativeVotes, parentCategory, childCategories,
           usageCount, d.id as discussionId
    `;

    // Add sorting
    this.addSortingToQuery(query, sort_by, sort_direction, 'c');

    // Add pagination
    query += ` SKIP $offset LIMIT $limit`;

    query += `
      RETURN {
        id: c.id,
        type: 'category',
        content: c.name,
        participant_count: positiveVotes + negativeVotes,
        created_at: toString(c.createdAt),
        updated_at: toString(c.updatedAt),
        created_by: c.createdBy,
        public_credit: c.publicCredit,
        keywords: [],
        positive_votes: positiveVotes,
        negative_votes: negativeVotes,
        description: c.description,
        composed_words: composedWords,
        parent_category: parentCategory,
        child_categories: childCategories,
        usage_count: usageCount,
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

  // NEW: Helper method to add sorting to queries
  private addSortingToQuery(
    query: string,
    sort_by: string,
    sort_direction: string,
    nodeAlias: string,
  ): void {
    if (sort_by === 'netVotes') {
      query += ` ORDER BY (${nodeAlias}.inclusionNetVotes + ${nodeAlias}.contentNetVotes) ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'chronological') {
      query += ` ORDER BY ${nodeAlias}.createdAt ${sort_direction.toUpperCase()}`;
    } else if (sort_by === 'participants') {
      query += ` ORDER BY (positiveVotes + negativeVotes) ${sort_direction.toUpperCase()}`;
    }
  }

  // NEW: Transform Answer results
  private transformAnswerResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      const metadata: any = {
        keywords: data.keywords || [],
        votes: {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        },
        discussionId: data.discussion_id,
      };

      // Add parent question if exists
      if (data.parent_question) {
        metadata.parentQuestionData = data.parent_question;
      }

      return {
        id: data.id,
        type: 'answer',
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

  // NEW: Transform Quantity results
  private transformQuantityResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      const metadata: any = {
        keywords: data.keywords || [],
        votes: {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        },
        discussionId: data.discussion_id,
        responseCount: this.toNumber(data.response_count || 0),
      };

      // Add unit information if available
      if (data.unit_category_id) {
        metadata.unitCategory = { id: data.unit_category_id, name: 'Unknown' }; // Would need unit service to get name
      }
      if (data.default_unit_id) {
        metadata.defaultUnit = { id: data.default_unit_id, name: 'Unknown' }; // Would need unit service to get name
      }

      return {
        id: data.id,
        type: 'quantity',
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

  // NEW: Transform Category results
  private transformCategoryResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      const metadata: any = {
        keywords: data.keywords || [],
        votes: {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        },
        discussionId: data.discussion_id,
        composedWords: data.composed_words || [],
        usageCount: this.toNumber(data.usage_count || 0),
      };

      // Add parent category if exists
      if (data.parent_category) {
        metadata.parentCategory = data.parent_category;
      }

      // Add child categories if exist
      if (data.child_categories && data.child_categories.length > 0) {
        metadata.childCategories = data.child_categories;
      }

      return {
        id: data.id,
        type: 'category',
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

  // ENHANCED: Transform OpenQuestion results (keeping existing logic but adding category support)
  private transformOpenQuestionResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      const metadata: any = {
        keywords: data.keywords || [],
        votes: {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        },
        discussionId: data.discussion_id,
        initialComment: data.initial_comment,
        answer_count: this.toNumber(data.answer_count || 0),
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

  // ENHANCED: Transform Statement results (keeping existing logic but adding category support)
  private transformStatementResults(records: any[]): UniversalNodeData[] {
    return records.map((record) => {
      const data = record.get('nodeData');

      const metadata: any = {
        keywords: data.keywords || [],
        votes: {
          positive: this.toNumber(data.positive_votes || 0),
          negative: this.toNumber(data.negative_votes || 0),
          net:
            this.toNumber(data.positive_votes || 0) -
            this.toNumber(data.negative_votes || 0),
        },
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

  // NEW: Apply category overlap sorting
  private async applyCategoryOverlapSorting(
    nodes: UniversalNodeData[],
    categories: string[],
    sortDirection: string,
  ): Promise<void> {
    if (categories.length === 0) {
      // If no categories specified, just sort by creation time
      nodes.sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      });
      return;
    }

    // Get category overlap scores for each node
    for (const node of nodes) {
      if (node.type === 'category') {
        // Categories don't have category overlap with themselves
        (node as any).categoryOverlapScore = 0;
        continue;
      }

      const overlapScore = await this.getCategoryOverlapScore(
        node.id,
        categories,
      );
      (node as any).categoryOverlapScore = overlapScore;
    }

    // Sort by category overlap score
    nodes.sort((a, b) => {
      const aScore = (a as any).categoryOverlapScore || 0;
      const bScore = (b as any).categoryOverlapScore || 0;

      if (aScore !== bScore) {
        return sortDirection === 'asc' ? aScore - bScore : bScore - aScore;
      }

      // Secondary sort by creation time
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime; // Always newest first for secondary sort
    });

    // Clean up temporary property
    for (const node of nodes) {
      delete (node as any).categoryOverlapScore;
    }
  }

  // NEW: Get category overlap score for a node
  private async getCategoryOverlapScore(
    nodeId: string,
    categories: string[],
  ): Promise<number> {
    if (categories.length === 0) return 0;

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (n {id: $nodeId})-[:CATEGORIZED_AS]->(c:CategoryNode)
        WHERE c.id IN $categories
        RETURN count(DISTINCT c) as overlapCount
        `,
        { nodeId, categories },
      );

      return result.records.length > 0
        ? this.toNumber(result.records[0].get('overlapCount'))
        : 0;
    } catch (error) {
      this.logger.warn(
        `Error calculating category overlap for node ${nodeId}: ${error.message}`,
      );
      return 0;
    }
  }

  // NEW: Enhance nodes with category data
  private async enhanceNodesWithCategoryData(
    nodes: UniversalNodeData[],
  ): Promise<UniversalNodeData[]> {
    if (nodes.length === 0) return nodes;

    try {
      // Get all node IDs (excluding categories which don't have categories)
      const nodeIds = nodes
        .filter((node) => node.type !== 'category')
        .map((node) => node.id);

      if (nodeIds.length === 0) return nodes;

      // Batch fetch category data for all nodes
      const result = await this.neo4jService.read(
        `
        MATCH (n)-[:CATEGORIZED_AS]->(c:CategoryNode)
        WHERE n.id IN $nodeIds AND c.inclusionNetVotes > 0
        RETURN n.id as nodeId, collect({
          id: c.id,
          name: c.name,
          description: c.description
        }) as categories
        `,
        { nodeIds },
      );

      // Create a map of node ID to categories
      const categoryMap = new Map<string, any[]>();
      result.records.forEach((record) => {
        const nodeId = record.get('nodeId');
        const categories = record.get('categories');
        categoryMap.set(nodeId, categories);
      });

      // Enhance each node with its category data
      return nodes.map((node) => {
        if (node.type === 'category') return node; // Categories don't have categories

        const categories = categoryMap.get(node.id) || [];
        return {
          ...node,
          metadata: {
            ...node.metadata,
            categories,
          },
        };
      });
    } catch (error) {
      this.logger.error(
        `Error enhancing nodes with category data: ${error.message}`,
      );
      return nodes; // Return original nodes if enhancement fails
    }
  }

  // ENHANCED: Get relationships with category support
  private async getRelationships(
    nodeIds: string[],
    nodeTypes: string[],
    relationshipTypes: string[],
    minCategoryOverlap: number,
  ): Promise<UniversalRelationshipData[]> {
    const relationships: UniversalRelationshipData[] = [];

    if (nodeIds.length === 0) return relationships;

    // Add shared keyword relationships (existing functionality)
    if (relationshipTypes.includes('shared_keyword')) {
      await this.addSharedKeywordRelationships(
        relationships,
        nodeIds,
        nodeTypes,
      );
    }

    // Add direct relationships (existing functionality)
    if (relationshipTypes.includes('related_to')) {
      await this.addDirectRelationships(relationships, nodeIds, nodeTypes);
    }

    // Add answer relationships (existing functionality)
    if (relationshipTypes.includes('answers')) {
      await this.addAnswerRelationships(relationships, nodeIds, nodeTypes);
    }

    // NEW: Add shared category relationships
    if (relationshipTypes.includes('shared_category')) {
      await this.addSharedCategoryRelationships(
        relationships,
        nodeIds,
        nodeTypes,
        minCategoryOverlap,
      );
    }

    // NEW: Add categorization relationships
    if (relationshipTypes.includes('categorized_as')) {
      await this.addCategorizationRelationships(
        relationships,
        nodeIds,
        nodeTypes,
      );
    }

    this.logger.debug(`Built ${relationships.length} relationships`);
    return relationships;
  }

  // NEW: Add shared category relationships
  private async addSharedCategoryRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: string[],
    minCategoryOverlap: number,
  ): Promise<void> {
    try {
      const sharedCategoryQuery = `
        MATCH (n1)-[:CATEGORIZED_AS]->(c:CategoryNode)<-[:CATEGORIZED_AS]-(n2)
        WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds
        AND c.inclusionNetVotes > 0
        AND id(n1) < id(n2)
        WITH n1, n2, collect(DISTINCT {id: c.id, name: c.name}) as sharedCategories
        WHERE size(sharedCategories) >= $minCategoryOverlap
        RETURN {
          source: n1.id,
          target: n2.id,
          sharedCategories: sharedCategories,
          overlapCount: size(sharedCategories)
        } as rel
      `;

      const result = await this.neo4jService.read(sharedCategoryQuery, {
        nodeIds,
        minCategoryOverlap,
      });

      result.records.forEach((record) => {
        const relData = record.get('rel');
        relationships.push({
          id: `shared_category_${relData.source}_${relData.target}`,
          source: relData.source,
          target: relData.target,
          type: 'shared_category',
          metadata: {
            categoryData: {
              categoryId: relData.sharedCategories[0]?.id || '',
              categoryName: relData.sharedCategories[0]?.name || '',
              sharedCategories: relData.sharedCategories.map((c: any) => c.id),
            },
            strength: relData.overlapCount,
          },
        });
      });

      this.logger.debug(
        `Added ${result.records.length} shared category relationships`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding shared category relationships: ${error.message}`,
      );
    }
  }

  // NEW: Add categorization relationships (node -> category)
  private async addCategorizationRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: string[],
  ): Promise<void> {
    try {
      // Only add if category nodes are included in the graph
      if (!nodeTypes.includes('category')) {
        return;
      }

      const categorizationQuery = `
        MATCH (n)-[:CATEGORIZED_AS]->(c:CategoryNode)
        WHERE n.id IN $nodeIds AND c.id IN $nodeIds
        AND c.inclusionNetVotes > 0
        RETURN {
          source: n.id,
          target: c.id,
          categoryName: c.name
        } as rel
      `;

      const result = await this.neo4jService.read(categorizationQuery, {
        nodeIds,
      });

      result.records.forEach((record) => {
        const relData = record.get('rel');
        relationships.push({
          id: `categorized_as_${relData.source}_${relData.target}`,
          source: relData.source,
          target: relData.target,
          type: 'categorized_as',
          metadata: {
            categoryData: {
              categoryId: relData.target,
              categoryName: relData.categoryName,
            },
          },
        });
      });

      this.logger.debug(
        `Added ${result.records.length} categorization relationships`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding categorization relationships: ${error.message}`,
      );
    }
  }

  // Keeping existing methods but enhancing them...

  // ENHANCED: Existing method with category support consideration
  private async addSharedKeywordRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: string[],
  ): Promise<void> {
    // Implementation would go here - keeping as placeholder for now
    // since this requires integrating with existing shared keyword logic
    this.logger.debug(
      `Adding shared keyword relationships for ${nodeIds.length} nodes of types: ${nodeTypes.join(', ')}`,
    );
    // TODO: Implement full shared keyword relationship logic
  }

  // ENHANCED: Existing method
  private async addDirectRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: string[],
  ): Promise<void> {
    // Implementation would go here - keeping as placeholder for now
    this.logger.debug(
      `Adding direct relationships for ${nodeIds.length} nodes of types: ${nodeTypes.join(', ')}`,
    );
    // TODO: Implement full direct relationship logic
  }

  // ENHANCED: Existing method
  private async addAnswerRelationships(
    relationships: UniversalRelationshipData[],
    nodeIds: string[],
    nodeTypes: string[],
  ): Promise<void> {
    // Implementation would go here - keeping as placeholder for now
    this.logger.debug(
      `Adding answer relationships for ${nodeIds.length} nodes of types: ${nodeTypes.join(', ')}`,
    );
    // TODO: Implement full answer relationship logic
  }

  // Existing utility methods...
  private calculateConsolidationRatio(
    relationships: UniversalRelationshipData[],
  ): number {
    // Keep existing consolidation ratio calculation
    // For now, return 1.0 as placeholder but use the parameter to avoid ESLint warning
    this.logger.debug(
      `Calculating consolidation ratio for ${relationships.length} relationships`,
    );
    return 1.0;
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
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sort_direction === 'asc' ? comparison : -comparison;
    });
  }

  private async enhanceNodesWithUserData(
    nodes: UniversalNodeData[],
    requesting_user_id: string,
  ): Promise<UniversalNodeData[]> {
    // Implementation would go here - keeping as placeholder for now
    this.logger.debug(
      `Enhancing ${nodes.length} nodes with user data for user: ${requesting_user_id}`,
    );
    // TODO: Implement full user data enhancement logic
    return nodes;
  }

  private toNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (value && typeof value.toNumber === 'function') return value.toNumber();
    return parseInt(value) || 0;
  }
}
