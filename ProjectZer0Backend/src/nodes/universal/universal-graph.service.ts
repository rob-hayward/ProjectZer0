import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../neo4j/neo4j.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { CategoryService } from '../category/category.service';

// ✅ Phase 4.1: Import all 5 content node schemas
import {
  StatementSchema,
  StatementData,
} from '../../neo4j/schemas/statement.schema';
import {
  OpenQuestionSchema,
  OpenQuestionData,
} from '../../neo4j/schemas/openquestion.schema';
import { AnswerSchema, AnswerData } from '../../neo4j/schemas/answer.schema';
import {
  QuantitySchema,
  QuantityData,
} from '../../neo4j/schemas/quantity.schema';
import {
  EvidenceSchema,
  EvidenceData,
} from '../../neo4j/schemas/evidence.schema';

// Types
export interface UniversalNodeData {
  id: string;
  type:
    | 'statement'
    | 'openquestion'
    | 'answer'
    | 'quantity'
    | 'evidence'
    | 'word'
    | 'definition'
    | 'category'
    | 'comment';
  content: string;
  createdBy: string;
  publicCredit: boolean;
  createdAt: string;
  updatedAt: string;

  // Voting data
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  inclusionNetVotes: number;
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  contentNetVotes: number;

  // Additional data
  discussionId: string | null;
  keywords: Array<{ word: string; frequency: number; source?: string }>;
  categories: Array<{ id: string; name: string; description?: string }>;

  // Metadata for relationships and UI
  metadata: {
    // For Answers: parent question info
    parentQuestion?: {
      nodeId: string;
      nodeType: 'openquestion';
      questionText: string;
    };
    // For Evidence: parent node info
    parentNode?: {
      nodeId: string;
      nodeType: string;
      content: string;
    };
    // Evidence-specific
    sourceUrl?: string;
    // User context
    userVoteStatus?: {
      inclusionVote: 'positive' | 'negative' | null;
      contentVote: 'positive' | 'negative' | null;
    };
    userVisibilityPreference?: 'hidden' | 'visible';
  };
}

export interface UniversalRelationshipData {
  id: string;
  source: string;
  target: string;
  type:
    | 'shared_keyword'
    | 'related_to'
    | 'answers'
    | 'evidence_for'
    | 'shared_category'
    | 'categorized_as'
    | 'defines'
    | 'composed_of'
    | 'has_comment'
    | 'has_reply';
  strength: number;
  metadata?: {
    sharedWords?: string[];
    strengthsByKeyword?: Record<string, number>;
    sharedCategories?: Array<{ id: string; name: string }>;
    relationshipType?: string;
  };
}

export interface UniversalGraphOptions {
  // Node type filtering
  node_types?: Array<
    'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'
  >;
  includeNodeTypes?: boolean; // true = include, false = exclude

  // ✅ Phase 4.2: Category filtering with ANY/ALL modes
  categories?: string[];
  includeCategoriesFilter?: boolean; // true = include, false = exclude
  categoryMode?: 'any' | 'all'; // any = at least one, all = must have all

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sort_by?:
    | 'netVotes'
    | 'chronological'
    | 'participants'
    | 'latest_activity'
    | 'inclusion_votes'
    | 'content_votes'
    | 'keyword_relevance';
  sort_direction?: 'asc' | 'desc';

  // ✅ Phase 4.2: Keyword filtering with ANY/ALL modes
  keywords?: string[];
  includeKeywordsFilter?: boolean; // true = include, false = exclude
  keywordMode?: 'any' | 'all'; // any = at least one, all = must have all

  // ✅ Phase 4.2: User filtering with interaction modes
  user_id?: string;
  userFilterMode?: 'all' | 'created' | 'interacted' | 'voted'; // Filter mode for user

  // Relationships
  include_relationships?: boolean;
  relationship_types?: Array<
    | 'shared_keyword'
    | 'related_to'
    | 'answers'
    | 'evidence_for'
    | 'shared_category'
    | 'categorized_as'
  >;

  // User context
  requesting_user_id?: string;

  // Discovery options
  minCategoryOverlap?: number;
  includeCategorizationData?: boolean;
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
    consolidation_ratio: number;
    category_filtered_count?: number;
  };
}

export interface KeywordInfo {
  word: string;
  usageCount: number;
}

export interface CategoryInfo {
  id: string;
  name: string;
  usageCount: number;
}

/**
 * Response format for graph expansion endpoints
 * Used for loading specific node groups onto the graph
 * - Word + Definitions
 * - Category + Composed Words
 * - Discussion + Comments
 */
export interface UniversalGraphExpansionResponse {
  nodes: UniversalNodeData[];
  relationships: UniversalRelationshipData[];
  performance_metrics: {
    node_count: number;
    relationship_count: number;
    relationship_density: number;
  };
}

@Injectable()
export class UniversalGraphService {
  private readonly logger = new Logger(UniversalGraphService.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    // ✅ Phase 4.1: Inject all 5 content node schemas
    private readonly statementSchema: StatementSchema,
    private readonly openQuestionSchema: OpenQuestionSchema,
    private readonly answerSchema: AnswerSchema,
    private readonly quantitySchema: QuantitySchema,
    private readonly evidenceSchema: EvidenceSchema,
    // Existing dependencies
    private readonly voteSchema: VoteSchema,
    private readonly visibilityService: VisibilityService,
    private readonly categoryService: CategoryService,
  ) {}

  /**
   * Main entry point for fetching universal graph data
   * Phase 4.1: Now uses schemas instead of direct Neo4j queries
   * Phase 4.2: Added ANY/ALL mode support for keyword and category filters
   */
  async getUniversalNodes(
    options: UniversalGraphOptions,
  ): Promise<UniversalGraphResponse> {
    try {
      // Set defaults - only content nodes (no Category in default set)
      const {
        node_types = [
          'statement',
          'openquestion',
          'answer',
          'quantity',
          'evidence',
        ], // All content nodes
        includeNodeTypes = true,
        categories = [],
        includeCategoriesFilter = true,
        categoryMode = 'any', // ✅ Phase 4.2: Default to ANY mode
        limit = 200,
        offset = 0,
        sort_by = 'inclusion_votes',
        sort_direction = 'desc',
        keywords = [],
        includeKeywordsFilter = true,
        keywordMode = 'any', // ✅ Phase 4.2: Default to ANY mode
        user_id,
        userFilterMode = 'all', // ✅ Phase 4.2: Default to all (no filtering)
        include_relationships = true,
        relationship_types = [
          'shared_keyword',
          'related_to',
          'answers',
          'shared_category',
        ],
        requesting_user_id,
        minCategoryOverlap = 1,
      } = options;

      this.logger.debug(
        `Getting universal nodes with options: ${JSON.stringify(options)}`,
      );

      // Determine effective node types based on include/exclude logic
      const allPossibleTypes: Array<
        'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence'
      > = ['statement', 'openquestion', 'answer', 'quantity', 'evidence'];

      const effectiveTypes = includeNodeTypes
        ? node_types
        : allPossibleTypes.filter((t) => !node_types.includes(t));

      this.logger.debug(`Effective node types: ${effectiveTypes.join(', ')}`);

      // ✅ Phase 4.1: Fetch nodes using schemas (not direct Neo4j queries)
      const allNodes: UniversalNodeData[] = [];

      // Fetch each node type using its schema
      if (effectiveTypes.includes('statement')) {
        const statements = await this.fetchStatements();
        allNodes.push(...statements);
      }

      if (effectiveTypes.includes('openquestion')) {
        const questions = await this.fetchOpenQuestions();
        allNodes.push(...questions);
      }

      if (effectiveTypes.includes('answer')) {
        const answers = await this.fetchAnswers();
        allNodes.push(...answers);
      }

      if (effectiveTypes.includes('quantity')) {
        const quantities = await this.fetchQuantities();
        allNodes.push(...quantities);
      }

      if (effectiveTypes.includes('evidence')) {
        const evidence = await this.fetchEvidence();
        allNodes.push(...evidence);
      }

      this.logger.debug(
        `Fetched ${allNodes.length} total nodes before filtering`,
      );

      // ✅ Phase 4.2: Apply filters with ANY/ALL mode support
      let filteredNodes = this.applyKeywordFilter(
        allNodes,
        keywords,
        includeKeywordsFilter,
        keywordMode,
      );
      filteredNodes = this.applyCategoryFilter(
        filteredNodes,
        categories,
        includeCategoriesFilter,
        categoryMode,
      );

      // ✅ Phase 4.2: Apply user filter with mode support
      if (user_id) {
        filteredNodes = await this.applyUserFilter(
          filteredNodes,
          user_id,
          userFilterMode,
        );
      }

      this.logger.debug(`${filteredNodes.length} nodes after filtering`);

      // Sort nodes
      const sortedNodes = this.applySorting(
        filteredNodes,
        sort_by,
        sort_direction,
      );

      // Pagination
      const total_count = sortedNodes.length;
      const has_more = offset + limit < total_count;
      const paginatedNodes = sortedNodes.slice(offset, offset + limit);

      // Enrich with user context if requested
      let enrichedNodes = paginatedNodes;
      if (requesting_user_id) {
        enrichedNodes = await this.enrichWithUserContext(
          paginatedNodes,
          requesting_user_id,
        );
      }

      // Get relationships
      let relationships: UniversalRelationshipData[] = [];
      if (include_relationships) {
        const nodeIds = enrichedNodes.map((n) => n.id);
        relationships = await this.getRelationships(
          nodeIds,
          relationship_types,
          minCategoryOverlap,
        );
      }

      // Build response
      return {
        nodes: enrichedNodes,
        relationships,
        total_count,
        has_more,
        performance_metrics: {
          node_count: enrichedNodes.length,
          relationship_count: relationships.length,
          relationship_density:
            enrichedNodes.length > 0
              ? relationships.length / enrichedNodes.length
              : 0,
          consolidation_ratio: 1.0, // Phase 4.2+ will implement
          category_filtered_count: categories.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error in getUniversalNodes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * ✅ Phase 4.1: Fetch Statements using StatementSchema.findAll()
   */
  private async fetchStatements(): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug('Fetching statements using StatementSchema.findAll()');

      const statements = await this.statementSchema.findAll({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000, // Get all, we'll filter/paginate later in service
      });

      this.logger.debug(`Found ${statements.length} statements from schema`);

      return statements.map((stmt) =>
        this.transformStatementToUniversalNode(stmt),
      );
    } catch (error) {
      this.logger.error(`Error fetching statements: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ Phase 4.1: Fetch OpenQuestions using OpenQuestionSchema.findAll()
   */
  private async fetchOpenQuestions(): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug(
        'Fetching open questions using OpenQuestionSchema.findAll()',
      );

      const questions = await this.openQuestionSchema.findAll({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000,
      });

      this.logger.debug(`Found ${questions.length} questions from schema`);

      return questions.map((q) => this.transformOpenQuestionToUniversalNode(q));
    } catch (error) {
      this.logger.error(`Error fetching open questions: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ Phase 4.1: Fetch Answers using AnswerSchema.findAll()
   * Note: Parent question data needs to be fetched separately
   */
  private async fetchAnswers(): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug('Fetching answers using AnswerSchema.findAll()');

      const answers = await this.answerSchema.findAll({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000,
      });

      this.logger.debug(`Found ${answers.length} answers from schema`);

      // Fetch parent question data for each answer
      const answersWithParents = await Promise.all(
        answers.map(async (ans) => {
          try {
            // Get full answer data with parent question
            const fullAnswer = await this.answerSchema.findById(ans.id);
            return fullAnswer || ans;
          } catch (error) {
            this.logger.warn(
              `Could not fetch parent for answer ${ans.id}: ${error.message}`,
            );
            return ans;
          }
        }),
      );

      return answersWithParents.map((ans) =>
        this.transformAnswerToUniversalNode(ans),
      );
    } catch (error) {
      this.logger.error(`Error fetching answers: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ Phase 4.1: Fetch Quantities using QuantitySchema.findAll()
   */
  private async fetchQuantities(): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug('Fetching quantities using QuantitySchema.findAll()');

      const quantities = await this.quantitySchema.findAll({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000,
      });

      this.logger.debug(`Found ${quantities.length} quantities from schema`);

      return quantities.map((qty) =>
        this.transformQuantityToUniversalNode(qty),
      );
    } catch (error) {
      this.logger.error(`Error fetching quantities: ${error.message}`);
      return [];
    }
  }

  /**
   * ✅ Phase 4.1: Fetch Evidence using EvidenceSchema.findAll()
   * Note: Parent node data needs to be fetched separately
   */
  private async fetchEvidence(): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug('Fetching evidence using EvidenceSchema.findAll()');

      const evidenceNodes = await this.evidenceSchema.findAll({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000,
      });

      this.logger.debug(`Found ${evidenceNodes.length} evidence from schema`);

      // Fetch parent node data for each evidence
      const evidenceWithParents = await Promise.all(
        evidenceNodes.map(async (evid) => {
          try {
            // Get full evidence data with parent node
            const fullEvidence = await this.evidenceSchema.findById(evid.id);
            return fullEvidence || evid;
          } catch (error) {
            this.logger.warn(
              `Could not fetch parent for evidence ${evid.id}: ${error.message}`,
            );
            return evid;
          }
        }),
      );

      return evidenceWithParents.map((evid) =>
        this.transformEvidenceToUniversalNode(evid),
      );
    } catch (error) {
      this.logger.error(`Error fetching evidence: ${error.message}`);
      return [];
    }
  }

  /**
   * Transform Statement to UniversalNode format
   */
  private transformStatementToUniversalNode(
    stmt: StatementData,
  ): UniversalNodeData {
    // Safely convert dates - check if Date instance before calling toISOString()
    const createdAt =
      stmt.createdAt instanceof Date
        ? stmt.createdAt.toISOString()
        : new Date().toISOString();
    const updatedAt =
      stmt.updatedAt instanceof Date
        ? stmt.updatedAt.toISOString()
        : new Date().toISOString();

    return {
      id: stmt.id,
      type: 'statement',
      content: stmt.statement,
      createdBy: stmt.createdBy,
      publicCredit: stmt.publicCredit,
      createdAt,
      updatedAt,
      inclusionPositiveVotes: stmt.inclusionPositiveVotes || 0,
      inclusionNegativeVotes: stmt.inclusionNegativeVotes || 0,
      inclusionNetVotes: stmt.inclusionNetVotes || 0,
      contentPositiveVotes: stmt.contentPositiveVotes || 0,
      contentNegativeVotes: stmt.contentNegativeVotes || 0,
      contentNetVotes: stmt.contentNetVotes || 0,
      discussionId: stmt.discussionId || null,
      keywords: stmt.keywords || [],
      categories: stmt.categories || [],
      metadata: {},
    };
  }

  /**
   * Transform OpenQuestion to UniversalNode format
   * Uses content vote fallback to inclusion votes
   */
  private transformOpenQuestionToUniversalNode(
    q: OpenQuestionData,
  ): UniversalNodeData {
    // Safely convert dates - check if Date instance before calling toISOString()
    const createdAt =
      q.createdAt instanceof Date
        ? q.createdAt.toISOString()
        : new Date().toISOString();
    const updatedAt =
      q.updatedAt instanceof Date
        ? q.updatedAt.toISOString()
        : new Date().toISOString();

    return {
      id: q.id,
      type: 'openquestion',
      content: q.questionText,
      createdBy: q.createdBy,
      publicCredit: q.publicCredit,
      createdAt,
      updatedAt,
      inclusionPositiveVotes: q.inclusionPositiveVotes || 0,
      inclusionNegativeVotes: q.inclusionNegativeVotes || 0,
      inclusionNetVotes: q.inclusionNetVotes || 0,
      // OpenQuestion has no content votes - will fall back to inclusion
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: q.inclusionNetVotes || 0, // ✅ Fallback to inclusion
      discussionId: q.discussionId || null,
      keywords: q.keywords || [],
      categories: q.categories || [],
      metadata: {},
    };
  }

  /**
   * Transform Answer to UniversalNode format
   * ALWAYS includes parent question info in metadata
   */
  private transformAnswerToUniversalNode(ans: AnswerData): UniversalNodeData {
    // Safely convert dates - check if Date instance before calling toISOString()
    const createdAt =
      ans.createdAt instanceof Date
        ? ans.createdAt.toISOString()
        : new Date().toISOString();
    const updatedAt =
      ans.updatedAt instanceof Date
        ? ans.updatedAt.toISOString()
        : new Date().toISOString();

    // Note: AnswerData.findById() returns parentQuestionId (string), not parentQuestion (object)
    // Full parent data is fetched via findById() in fetchAnswers()
    let parentQuestion: UniversalNodeData['metadata']['parentQuestion'];

    // If we have full answer data with parent question text (from findById)
    if ((ans as any).parentQuestionText) {
      parentQuestion = {
        nodeId: ans.parentQuestionId,
        nodeType: 'openquestion',
        questionText: (ans as any).parentQuestionText,
      };
    } else if (ans.parentQuestionId) {
      // Fallback: we only have the ID
      parentQuestion = {
        nodeId: ans.parentQuestionId,
        nodeType: 'openquestion',
        questionText: '', // Will be populated by findById in fetchAnswers()
      };
    }

    return {
      id: ans.id,
      type: 'answer',
      content: ans.answerText,
      createdBy: ans.createdBy,
      publicCredit: ans.publicCredit,
      createdAt,
      updatedAt,
      inclusionPositiveVotes: ans.inclusionPositiveVotes || 0,
      inclusionNegativeVotes: ans.inclusionNegativeVotes || 0,
      inclusionNetVotes: ans.inclusionNetVotes || 0,
      contentPositiveVotes: ans.contentPositiveVotes || 0,
      contentNegativeVotes: ans.contentNegativeVotes || 0,
      contentNetVotes: ans.contentNetVotes || 0,
      discussionId: ans.discussionId || null,
      keywords: ans.keywords || [],
      categories: ans.categories || [],
      metadata: {
        parentQuestion, // ✅ Always include parent question
      },
    };
  }

  /**
   * Transform Quantity to UniversalNode format
   * Uses content vote fallback to inclusion votes
   * ✅ FIXED: Uses qty.question (not qty.questionText)
   */
  private transformQuantityToUniversalNode(
    qty: QuantityData,
  ): UniversalNodeData {
    // Safely convert dates - check if Date instance before calling toISOString()
    const createdAt =
      qty.createdAt instanceof Date
        ? qty.createdAt.toISOString()
        : new Date().toISOString();
    const updatedAt =
      qty.updatedAt instanceof Date
        ? qty.updatedAt.toISOString()
        : new Date().toISOString();

    return {
      id: qty.id,
      type: 'quantity',
      content: qty.question, // ✅ FIXED: Changed from qty.questionText to qty.question
      createdBy: qty.createdBy,
      publicCredit: qty.publicCredit,
      createdAt,
      updatedAt,
      inclusionPositiveVotes: qty.inclusionPositiveVotes || 0,
      inclusionNegativeVotes: qty.inclusionNegativeVotes || 0,
      inclusionNetVotes: qty.inclusionNetVotes || 0,
      // Quantity has no content votes - will fall back to inclusion
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: qty.inclusionNetVotes || 0, // ✅ Fallback to inclusion
      discussionId: qty.discussionId || null,
      keywords: qty.keywords || [],
      categories: qty.categories || [],
      metadata: {},
    };
  }

  /**
   * Transform Evidence to UniversalNode format
   * ALWAYS includes parent node info in metadata
   * Uses content vote fallback to inclusion votes
   * ✅ FIXED: Uses evid.url (not evid.sourceUrl)
   */
  private transformEvidenceToUniversalNode(
    evid: EvidenceData,
  ): UniversalNodeData {
    // Safely convert dates - check if Date instance before calling toISOString()
    const createdAt =
      evid.createdAt instanceof Date
        ? evid.createdAt.toISOString()
        : new Date().toISOString();
    const updatedAt =
      evid.updatedAt instanceof Date
        ? evid.updatedAt.toISOString()
        : new Date().toISOString();

    // Build parent node metadata from the evidence schema result
    let parentNode: UniversalNodeData['metadata']['parentNode'];

    if ((evid as any).parentNodeType && (evid as any).parentNodeId) {
      parentNode = {
        nodeId: (evid as any).parentNodeId,
        nodeType: (evid as any).parentNodeType,
        content: (evid as any).parentNodeContent || '',
      };
    }

    return {
      id: evid.id,
      type: 'evidence',
      content: evid.title || evid.url || 'Evidence', // ✅ FIXED: Use evid.url (not evid.sourceUrl)
      createdBy: evid.createdBy,
      publicCredit: evid.publicCredit,
      createdAt,
      updatedAt,
      inclusionPositiveVotes: evid.inclusionPositiveVotes || 0,
      inclusionNegativeVotes: evid.inclusionNegativeVotes || 0,
      inclusionNetVotes: evid.inclusionNetVotes || 0,
      // Evidence has no content votes - will fall back to inclusion
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: evid.inclusionNetVotes || 0, // ✅ Fallback to inclusion
      discussionId: evid.discussionId || null,
      keywords: evid.keywords || [],
      categories: evid.categories || [],
      metadata: {
        sourceUrl: evid.url, // ✅ FIXED: Use evid.url (not evid.sourceUrl)
        parentNode, // ✅ Always include parent node
      },
    };
  }

  /**
   * ✅ Phase 4.2: Apply keyword filtering with ANY/ALL mode support
   *
   * @param nodes - Nodes to filter
   * @param keywords - Keywords to filter by
   * @param include - true = include matching nodes, false = exclude matching nodes
   * @param mode - 'any' = node has at least one keyword, 'all' = node has all keywords
   */
  private applyKeywordFilter(
    nodes: UniversalNodeData[],
    keywords: string[],
    include: boolean,
    mode: 'any' | 'all',
  ): UniversalNodeData[] {
    if (keywords.length === 0) return nodes;

    this.logger.debug(
      `Applying keyword filter: mode=${mode}, include=${include}, keywords=${keywords.join(',')}`,
    );

    return nodes.filter((node) => {
      const nodeKeywords = node.keywords.map((k) => k.word.toLowerCase());
      const searchKeywords = keywords.map((k) => k.toLowerCase());

      let matches: boolean;

      if (mode === 'any') {
        // ANY mode: node must have at least one of the keywords
        matches = searchKeywords.some((keyword) =>
          nodeKeywords.includes(keyword),
        );
      } else {
        // ALL mode: node must have all of the keywords
        matches = searchKeywords.every((keyword) =>
          nodeKeywords.includes(keyword),
        );
      }

      // Apply include/exclude logic
      return include ? matches : !matches;
    });
  }

  /**
   * ✅ Phase 4.2: Apply category filtering with ANY/ALL mode support
   *
   * @param nodes - Nodes to filter
   * @param categories - Category IDs to filter by
   * @param include - true = include matching nodes, false = exclude matching nodes
   * @param mode - 'any' = node in at least one category, 'all' = node in all categories
   */
  private applyCategoryFilter(
    nodes: UniversalNodeData[],
    categories: string[],
    include: boolean,
    mode: 'any' | 'all',
  ): UniversalNodeData[] {
    if (categories.length === 0) return nodes;

    this.logger.debug(
      `Applying category filter: mode=${mode}, include=${include}, categories=${categories.join(',')}`,
    );

    return nodes.filter((node) => {
      const nodeCategoryIds = node.categories.map((c) => c.id);

      let matches: boolean;

      if (mode === 'any') {
        // ANY mode: node must be in at least one of the categories
        matches = categories.some((catId) => nodeCategoryIds.includes(catId));
      } else {
        // ALL mode: node must be in all of the categories
        matches = categories.every((catId) => nodeCategoryIds.includes(catId));
      }

      // Apply include/exclude logic
      return include ? matches : !matches;
    });
  }

  /**
   * ✅ Phase 4.2: Apply user filtering with interaction mode support
   *
   * @param nodes - Nodes to filter
   * @param userId - User ID to filter by
   * @param mode - Filter mode:
   *   - 'all': No filtering (return all nodes)
   *   - 'created': Only nodes created by this user
   *   - 'interacted': Nodes user has voted on or commented on
   *   - 'voted': Nodes user has voted on (inclusion or content)
   */
  private async applyUserFilter(
    nodes: UniversalNodeData[],
    userId: string,
    mode: 'all' | 'created' | 'interacted' | 'voted',
  ): Promise<UniversalNodeData[]> {
    if (!userId || mode === 'all') return nodes;

    this.logger.debug(`Applying user filter: mode=${mode}, userId=${userId}`);

    switch (mode) {
      case 'created':
        // Only nodes created by this user
        return nodes.filter((node) => node.createdBy === userId);

      case 'voted':
        // Nodes the user has voted on (inclusion or content)
        try {
          const votedNodeIds = await this.getNodesVotedByUser(userId);
          return nodes.filter((node) => votedNodeIds.has(node.id));
        } catch (error) {
          this.logger.error(
            `Error fetching voted nodes for user ${userId}: ${error.message}`,
          );
          return nodes; // Return unfiltered on error
        }

      case 'interacted':
        // Nodes the user has voted on or commented on
        try {
          const interactedNodeIds = await this.getNodesInteractedByUser(userId);
          return nodes.filter((node) => interactedNodeIds.has(node.id));
        } catch (error) {
          this.logger.error(
            `Error fetching interacted nodes for user ${userId}: ${error.message}`,
          );
          return nodes; // Return unfiltered on error
        }

      default:
        return nodes;
    }
  }

  /**
   * ✅ Phase 4.2: Get IDs of nodes the user has voted on
   */
  private async getNodesVotedByUser(userId: string): Promise<Set<string>> {
    try {
      const query = `
        MATCH (u:User {sub: $userId})-[v:VOTED_ON]->(node)
        WHERE node:StatementNode OR node:OpenQuestionNode OR node:AnswerNode 
          OR node:QuantityNode OR node:EvidenceNode
        RETURN DISTINCT node.id as nodeId
      `;

      const result = await this.neo4jService.read(query, { userId });
      const nodeIds = new Set<string>();

      result.records.forEach((record) => {
        const nodeId = record.get('nodeId');
        if (nodeId) {
          nodeIds.add(nodeId);
        }
      });

      this.logger.debug(`User ${userId} has voted on ${nodeIds.size} nodes`);

      return nodeIds;
    } catch (error) {
      this.logger.error(
        `Error fetching voted nodes for user ${userId}: ${error.message}`,
      );
      return new Set<string>();
    }
  }

  /**
   * ✅ Phase 4.2: Get IDs of nodes the user has interacted with (voted or commented)
   */
  private async getNodesInteractedByUser(userId: string): Promise<Set<string>> {
    try {
      const query = `
        MATCH (u:User {sub: $userId})-[r]->(node)
        WHERE (type(r) = 'VOTED_ON' OR type(r) = 'COMMENTED')
          AND (node:StatementNode OR node:OpenQuestionNode OR node:AnswerNode 
            OR node:QuantityNode OR node:EvidenceNode)
        RETURN DISTINCT node.id as nodeId
      `;

      const result = await this.neo4jService.read(query, { userId });
      const nodeIds = new Set<string>();

      result.records.forEach((record) => {
        const nodeId = record.get('nodeId');
        if (nodeId) {
          nodeIds.add(nodeId);
        }
      });

      this.logger.debug(
        `User ${userId} has interacted with ${nodeIds.size} nodes`,
      );

      return nodeIds;
    } catch (error) {
      this.logger.error(
        `Error fetching interacted nodes for user ${userId}: ${error.message}`,
      );
      return new Set<string>();
    }
  }

  /**
   * Apply sorting with content vote fallback
   * Phase 4.3 will implement full sorting logic
   */
  private applySorting(
    nodes: UniversalNodeData[],
    sortBy: string,
    direction: string,
  ): UniversalNodeData[] {
    const sorted = [...nodes];
    const asc = direction === 'asc';

    sorted.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'netVotes':
        case 'inclusion_votes':
          aValue = a.inclusionNetVotes;
          bValue = b.inclusionNetVotes;
          break;

        case 'content_votes':
          aValue = a.contentNetVotes;
          bValue = b.contentNetVotes;
          break;

        case 'chronological':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;

        case 'latest_activity':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;

        case 'participants':
          aValue =
            a.inclusionPositiveVotes +
            a.inclusionNegativeVotes +
            a.contentPositiveVotes +
            a.contentNegativeVotes;
          bValue =
            b.inclusionPositiveVotes +
            b.inclusionNegativeVotes +
            b.contentPositiveVotes +
            b.contentNegativeVotes;
          break;

        default:
          aValue = a.inclusionNetVotes;
          bValue = b.inclusionNetVotes;
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return asc ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Enrich nodes with user context (votes and visibility preferences)
   */
  private async enrichWithUserContext(
    nodes: UniversalNodeData[],
    userId: string,
  ): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug(
        `Enriching ${nodes.length} nodes with user context for ${userId}`,
      );

      // Get user votes for all nodes
      const nodeIds = nodes.map((n) => n.id);
      const userVotes = await this.getUserVotesForNodes(userId, nodeIds);

      // Get user visibility preferences
      const visibilityPrefs =
        await this.visibilityService.getUserVisibilityPreferences(userId);

      // Enrich each node
      return nodes.map((node) => {
        const voteStatus = userVotes.get(node.id);
        const visibilityPref = visibilityPrefs[node.id];

        // ✅ FIXED: Convert visibility preference to 'hidden' | 'visible'
        let userVisibilityPreference: 'hidden' | 'visible' | undefined;
        if (visibilityPref !== undefined) {
          // Handle boolean or string values
          if (typeof visibilityPref === 'boolean') {
            userVisibilityPreference = visibilityPref ? 'visible' : 'hidden';
          } else if (typeof visibilityPref === 'string') {
            userVisibilityPreference = visibilityPref as 'hidden' | 'visible';
          }
        }

        return {
          ...node,
          metadata: {
            ...node.metadata,
            userVoteStatus: voteStatus,
            userVisibilityPreference,
          },
        };
      });
    } catch (error) {
      this.logger.error(`Error enriching with user context: ${error.message}`);
      return nodes;
    }
  }

  /**
   * Get user vote status for multiple nodes
   */
  private async getUserVotesForNodes(
    userId: string,
    nodeIds: string[],
  ): Promise<
    Map<
      string,
      {
        inclusionVote: 'positive' | 'negative' | null;
        contentVote: 'positive' | 'negative' | null;
      }
    >
  > {
    try {
      const query = `
        MATCH (u:User {sub: $userId})-[v:VOTED_ON]->(node)
        WHERE node.id IN $nodeIds
        RETURN node.id as nodeId, v.voteType as voteType, v.isPositive as isPositive
      `;

      const result = await this.neo4jService.read(query, { userId, nodeIds });
      const votes = new Map<
        string,
        {
          inclusionVote: 'positive' | 'negative' | null;
          contentVote: 'positive' | 'negative' | null;
        }
      >();

      result.records.forEach((record) => {
        const nodeId = record.get('nodeId');
        const voteType = record.get('voteType');
        const isPositive = record.get('isPositive');

        if (!votes.has(nodeId)) {
          votes.set(nodeId, { inclusionVote: null, contentVote: null });
        }

        const nodeVotes = votes.get(nodeId)!;
        const voteValue = isPositive ? 'positive' : 'negative';

        if (voteType === 'inclusion') {
          nodeVotes.inclusionVote = voteValue;
        } else if (voteType === 'content') {
          nodeVotes.contentVote = voteValue;
        }
      });

      return votes;
    } catch (error) {
      this.logger.error(`Error fetching user votes: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Get relationships between nodes
   * Phase 4.2+ will implement relationship consolidation
   */
  private async getRelationships(
    nodeIds: string[],
    relationshipTypes: string[],
    minCategoryOverlap: number,
  ): Promise<UniversalRelationshipData[]> {
    if (nodeIds.length === 0) return [];

    const relationships: UniversalRelationshipData[] = [];

    try {
      // Fetch each relationship type
      if (relationshipTypes.includes('shared_keyword')) {
        const sharedKeywordRels =
          await this.getSharedKeywordRelationships(nodeIds);
        relationships.push(...sharedKeywordRels);
      }

      if (relationshipTypes.includes('related_to')) {
        const relatedToRels = await this.getRelatedToRelationships(nodeIds);
        relationships.push(...relatedToRels);
      }

      if (relationshipTypes.includes('answers')) {
        const answersRels = await this.getAnswersRelationships(nodeIds);
        relationships.push(...answersRels);
      }

      if (relationshipTypes.includes('evidence_for')) {
        const evidenceForRels = await this.getEvidenceForRelationships(nodeIds);
        relationships.push(...evidenceForRels);
      }

      if (relationshipTypes.includes('shared_category')) {
        const sharedCategoryRels = await this.getSharedCategoryRelationships(
          nodeIds,
          minCategoryOverlap,
        );
        relationships.push(...sharedCategoryRels);
      }

      if (relationshipTypes.includes('categorized_as')) {
        const categorizedAsRels =
          await this.getCategorizedAsRelationships(nodeIds);
        relationships.push(...categorizedAsRels);
      }

      this.logger.debug(`Found ${relationships.length} total relationships`);

      return relationships;
    } catch (error) {
      this.logger.error(`Error fetching relationships: ${error.message}`);
      return [];
    }
  }

  /**
   * Get shared keyword relationships
   * Phase 4.2+ will consolidate multiple keyword relationships
   */
  private async getSharedKeywordRelationships(
    nodeIds: string[],
  ): Promise<UniversalRelationshipData[]> {
    try {
      const query = `
        MATCH (n1)-[:TAGGED]->(w:WordNode)<-[:TAGGED]-(n2)
        WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds AND n1.id < n2.id
        WITH n1, n2, collect(w.word) as sharedWords, count(w) as sharedCount
        WHERE sharedCount > 0
        RETURN n1.id as source, n2.id as target, sharedWords, sharedCount
      `;

      const result = await this.neo4jService.read(query, { nodeIds });
      const relationships: UniversalRelationshipData[] = [];

      result.records.forEach((record) => {
        const source = record.get('source');
        const target = record.get('target');
        const sharedWords = record.get('sharedWords');
        const sharedCount = record.get('sharedCount');

        relationships.push({
          id: `${source}-shared_keyword-${target}`,
          source,
          target,
          type: 'shared_keyword',
          strength:
            typeof sharedCount === 'object'
              ? sharedCount.toNumber()
              : sharedCount,
          metadata: {
            sharedWords,
          },
        });
      });

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error fetching shared keyword relationships: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get related_to relationships
   */
  private async getRelatedToRelationships(
    nodeIds: string[],
  ): Promise<UniversalRelationshipData[]> {
    try {
      const query = `
        MATCH (n1)-[r:RELATED_TO]->(n2)
        WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds
        RETURN n1.id as source, n2.id as target, r.strength as strength
      `;

      const result = await this.neo4jService.read(query, { nodeIds });
      const relationships: UniversalRelationshipData[] = [];

      result.records.forEach((record) => {
        const source = record.get('source');
        const target = record.get('target');
        const strength = record.get('strength') || 1.0;

        relationships.push({
          id: `${source}-related_to-${target}`,
          source,
          target,
          type: 'related_to',
          strength,
        });
      });

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error fetching related_to relationships: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get answers relationships (OpenQuestion -> Answer)
   */
  private async getAnswersRelationships(
    nodeIds: string[],
  ): Promise<UniversalRelationshipData[]> {
    try {
      const query = `
        MATCH (q:OpenQuestionNode)-[:HAS_ANSWER]->(a:AnswerNode)
        WHERE q.id IN $nodeIds AND a.id IN $nodeIds
        RETURN q.id as source, a.id as target
      `;

      const result = await this.neo4jService.read(query, { nodeIds });
      const relationships: UniversalRelationshipData[] = [];

      result.records.forEach((record) => {
        const source = record.get('source');
        const target = record.get('target');

        relationships.push({
          id: `${source}-answers-${target}`,
          source,
          target,
          type: 'answers',
          strength: 1.0,
        });
      });

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error fetching answers relationships: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get evidence_for relationships (Evidence -> Parent Node)
   */
  private async getEvidenceForRelationships(
    nodeIds: string[],
  ): Promise<UniversalRelationshipData[]> {
    try {
      const query = `
        MATCH (e:EvidenceNode)-[:SUPPORTS]->(parent)
        WHERE e.id IN $nodeIds AND parent.id IN $nodeIds
        RETURN e.id as source, parent.id as target
      `;

      const result = await this.neo4jService.read(query, { nodeIds });
      const relationships: UniversalRelationshipData[] = [];

      result.records.forEach((record) => {
        const source = record.get('source');
        const target = record.get('target');

        relationships.push({
          id: `${source}-evidence_for-${target}`,
          source,
          target,
          type: 'evidence_for',
          strength: 1.0,
        });
      });

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error fetching evidence_for relationships: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get shared category relationships
   */
  private async getSharedCategoryRelationships(
    nodeIds: string[],
    minOverlap: number,
  ): Promise<UniversalRelationshipData[]> {
    try {
      const query = `
        MATCH (n1)-[:CATEGORIZED_AS]->(c:CategoryNode)<-[:CATEGORIZED_AS]-(n2)
        WHERE n1.id IN $nodeIds AND n2.id IN $nodeIds 
          AND n1.id < n2.id AND c.inclusionNetVotes > 0
        WITH n1, n2, 
             collect({id: c.id, name: c.name}) as sharedCategories, 
             count(c) as overlapCount
        WHERE overlapCount >= $minOverlap
        RETURN n1.id as source, n2.id as target, sharedCategories, overlapCount
      `;

      const result = await this.neo4jService.read(query, {
        nodeIds,
        minOverlap,
      });
      const relationships: UniversalRelationshipData[] = [];

      result.records.forEach((record) => {
        const source = record.get('source');
        const target = record.get('target');
        const sharedCategories = record.get('sharedCategories');
        const overlapCount = record.get('overlapCount');

        relationships.push({
          id: `${source}-shared_category-${target}`,
          source,
          target,
          type: 'shared_category',
          strength:
            typeof overlapCount === 'object'
              ? overlapCount.toNumber()
              : overlapCount,
          metadata: {
            sharedCategories,
          },
        });
      });

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error fetching shared category relationships: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get categorized_as relationships (Node -> Category)
   */
  private async getCategorizedAsRelationships(
    nodeIds: string[],
  ): Promise<UniversalRelationshipData[]> {
    try {
      const query = `
        MATCH (node)-[:CATEGORIZED_AS]->(c:CategoryNode)
        WHERE node.id IN $nodeIds AND c.inclusionNetVotes > 0
        RETURN node.id as source, c.id as target, c.name as categoryName
      `;

      const result = await this.neo4jService.read(query, { nodeIds });
      const relationships: UniversalRelationshipData[] = [];

      result.records.forEach((record) => {
        const source = record.get('source');
        const target = record.get('target');
        const categoryName = record.get('categoryName');

        relationships.push({
          id: `${source}-categorized_as-${target}`,
          source,
          target,
          type: 'categorized_as',
          strength: 1.0,
          metadata: {
            relationshipType: 'categorized_as',
            sharedCategories: [{ id: target, name: categoryName }],
          },
        });
      });

      return relationships;
    } catch (error) {
      this.logger.error(
        `Error fetching categorized_as relationships: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get available keywords for filtering UI
   */
  async getAvailableKeywords(): Promise<KeywordInfo[]> {
    try {
      const query = `
        MATCH (w:WordNode)<-[:TAGGED]-(node)
        WHERE node:StatementNode OR node:OpenQuestionNode 
          OR node:AnswerNode OR node:QuantityNode OR node:EvidenceNode
        RETURN w.word as word, count(node) as usageCount
        ORDER BY usageCount DESC
        LIMIT 1000
      `;

      const result = await this.neo4jService.read(query);
      const keywords: KeywordInfo[] = [];

      result.records.forEach((record) => {
        keywords.push({
          word: record.get('word'),
          usageCount: record.get('usageCount')?.toNumber() || 0,
        });
      });

      return keywords;
    } catch (error) {
      this.logger.error(`Error fetching available keywords: ${error.message}`);
      return [];
    }
  }

  async getAvailableCategories(): Promise<CategoryInfo[]> {
    try {
      const categories = await this.categoryService.getAllCategories();

      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        usageCount: 0, // TODO: Calculate usage count
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching available categories: ${error.message}`,
      );
      return [];
    }
  }
}
