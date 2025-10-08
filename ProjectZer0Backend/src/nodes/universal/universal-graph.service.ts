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
  type: 'statement' | 'openquestion' | 'answer' | 'quantity' | 'evidence';
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
    | 'categorized_as';
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

  // Category filtering
  categories?: string[];
  includeCategoriesFilter?: boolean; // true = include, false = exclude

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

  // Keyword filtering
  keywords?: string[];
  includeKeywordsFilter?: boolean;

  // User filtering
  user_id?: string;

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
  description?: string;
  usageCount: number;
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
   */
  async getUniversalNodes(
    options: UniversalGraphOptions,
  ): Promise<UniversalGraphResponse> {
    try {
      // Set defaults - only content nodes (no Category in default set)
      const {
        node_types = ['statement', 'openquestion'], // Backward compatible default
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

      // Apply filters
      let filteredNodes = this.applyKeywordFilter(
        allNodes,
        keywords,
        includeKeywordsFilter,
      );
      filteredNodes = this.applyCategoryFilter(
        filteredNodes,
        categories,
        includeCategoriesFilter,
      );

      // Apply user filter if specified
      if (user_id) {
        filteredNodes = this.applyUserFilter(filteredNodes, user_id);
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

      const evidence = await this.evidenceSchema.findAll({
        minInclusionVotes: -5,
        includeKeywords: true,
        includeCategories: true,
        includeDiscussion: true,
        limit: 10000,
      });

      this.logger.debug(`Found ${evidence.length} evidence from schema`);

      // Fetch parent node data for each evidence
      const evidenceWithParents = await Promise.all(
        evidence.map(async (ev) => {
          try {
            // Get full evidence data with parent node
            const fullEvidence = await this.evidenceSchema.findById(ev.id);
            return fullEvidence || ev;
          } catch (error) {
            this.logger.warn(
              `Could not fetch parent for evidence ${ev.id}: ${error.message}`,
            );
            return ev;
          }
        }),
      );

      return evidenceWithParents.map((ev) =>
        this.transformEvidenceToUniversalNode(ev),
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
    return {
      id: stmt.id,
      type: 'statement',
      content: stmt.statement,
      createdBy: stmt.createdBy,
      publicCredit: stmt.publicCredit,
      createdAt: stmt.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: stmt.updatedAt?.toISOString() || new Date().toISOString(),
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
    return {
      id: q.id,
      type: 'openquestion',
      content: q.questionText,
      createdBy: q.createdBy,
      publicCredit: q.publicCredit,
      createdAt: q.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: q.updatedAt?.toISOString() || new Date().toISOString(),
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
      createdAt: ans.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: ans.updatedAt?.toISOString() || new Date().toISOString(),
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
        parentQuestion, // ✅ ALWAYS include parent question info
      },
    };
  }

  /**
   * Transform Quantity to UniversalNode format
   * Uses content vote fallback to inclusion votes
   * ✅ FIXED: Uses qty.question (not qty.definition)
   * ✅ FIXED: Removed measurementUnit and value (not on QuantityData)
   */
  private transformQuantityToUniversalNode(
    qty: QuantityData,
  ): UniversalNodeData {
    return {
      id: qty.id,
      type: 'quantity',
      content: qty.question, // ✅ FIXED: Changed from qty.definition
      createdBy: qty.createdBy,
      publicCredit: qty.publicCredit,
      createdAt: qty.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: qty.updatedAt?.toISOString() || new Date().toISOString(),
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
      metadata: {}, // ✅ FIXED: Removed measurementUnit and value
    };
  }

  /**
   * Transform Evidence to UniversalNode format
   * ALWAYS includes parent node info in metadata
   * Uses content vote fallback to inclusion votes
   * ✅ FIXED: Removed isPeerReviewed (not on EvidenceData)
   */
  private transformEvidenceToUniversalNode(
    ev: EvidenceData,
  ): UniversalNodeData {
    // Extract parent node data if available
    let parentNode: UniversalNodeData['metadata']['parentNode'];

    if (ev.parentInfo) {
      parentNode = {
        nodeId: ev.parentInfo.id,
        nodeType: ev.parentInfo.type,
        content: ev.parentInfo.title,
      };
    }

    return {
      id: ev.id,
      type: 'evidence',
      content: ev.title,
      createdBy: ev.createdBy,
      publicCredit: ev.publicCredit,
      createdAt: ev.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: ev.updatedAt?.toISOString() || new Date().toISOString(),
      inclusionPositiveVotes: ev.inclusionPositiveVotes || 0,
      inclusionNegativeVotes: ev.inclusionNegativeVotes || 0,
      inclusionNetVotes: ev.inclusionNetVotes || 0,
      // Evidence has no content votes - will fall back to inclusion
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: ev.inclusionNetVotes || 0, // ✅ Fallback to inclusion
      discussionId: ev.discussionId || null,
      keywords: ev.keywords || [],
      categories: ev.categories || [],
      metadata: {
        parentNode, // ✅ ALWAYS include parent node info
        sourceUrl: ev.url,
        // ✅ FIXED: Removed isPeerReviewed (not a direct property of EvidenceData)
      },
    };
  }

  /**
   * Apply keyword filtering
   * Phase 4.2 will add ANY/ALL modes
   */
  private applyKeywordFilter(
    nodes: UniversalNodeData[],
    keywords: string[],
    include: boolean,
  ): UniversalNodeData[] {
    if (keywords.length === 0) return nodes;

    return nodes.filter((node) => {
      const nodeKeywords = node.keywords.map((k) => k.word.toLowerCase());
      const hasKeyword = keywords.some((kw) =>
        nodeKeywords.includes(kw.toLowerCase()),
      );
      return include ? hasKeyword : !hasKeyword;
    });
  }

  /**
   * Apply category filtering
   * Phase 4.2 will add ANY/ALL modes
   */
  private applyCategoryFilter(
    nodes: UniversalNodeData[],
    categories: string[],
    include: boolean,
  ): UniversalNodeData[] {
    if (categories.length === 0) return nodes;

    return nodes.filter((node) => {
      const nodeCategoryIds = node.categories.map((c) => c.id);
      const hasCategory = categories.some((catId) =>
        nodeCategoryIds.includes(catId),
      );
      return include ? hasCategory : !hasCategory;
    });
  }

  /**
   * Apply user filtering
   * Phase 4.2 will add created/interacted/voted modes
   */
  private applyUserFilter(
    nodes: UniversalNodeData[],
    userId: string,
  ): UniversalNodeData[] {
    return nodes.filter((node) => node.createdBy === userId);
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
   * Phase 4.5 will implement batch enrichment
   */
  private async enrichWithUserContext(
    nodes: UniversalNodeData[],
    userId: string,
  ): Promise<UniversalNodeData[]> {
    try {
      this.logger.debug(
        `Enriching ${nodes.length} nodes with user context for ${userId}`,
      );

      const enriched = await Promise.all(
        nodes.map(async (node) => {
          try {
            // Get node label for Neo4j query
            const nodeLabel =
              node.type === 'statement'
                ? 'StatementNode'
                : node.type === 'openquestion'
                  ? 'OpenQuestionNode'
                  : node.type === 'answer'
                    ? 'AnswerNode'
                    : node.type === 'quantity'
                      ? 'QuantityNode'
                      : 'EvidenceNode';

            // Get vote status from the appropriate schema
            let voteStatus: any = null;

            switch (node.type) {
              case 'statement':
                voteStatus = await this.statementSchema.getVoteStatus(
                  node.id,
                  userId,
                );
                break;
              case 'openquestion':
                voteStatus = await this.openQuestionSchema.getVoteStatus(
                  node.id,
                  userId,
                );
                break;
              case 'answer':
                voteStatus = await this.answerSchema.getVoteStatus(
                  node.id,
                  userId,
                );
                break;
              case 'quantity':
                voteStatus = await this.quantitySchema.getVoteStatus(
                  node.id,
                  userId,
                );
                break;
              case 'evidence':
                voteStatus = await this.evidenceSchema.getVoteStatus(
                  node.id,
                  userId,
                );
                break;
            }

            // Get visibility preference
            const visQuery = `
              MATCH (u:UserNode {id: $userId})-[h:HIDES]->(n:${nodeLabel} {id: $nodeId})
              RETURN h.preference as preference
            `;

            const visResult = await this.neo4jService.read(visQuery, {
              userId,
              nodeId: node.id,
            });

            const visibilityPref =
              visResult.records.length > 0
                ? visResult.records[0].get('preference')
                : 'visible';

            // Convert vote counts to vote status
            let inclusionVote: 'positive' | 'negative' | null = null;
            let contentVote: 'positive' | 'negative' | null = null;

            if (voteStatus) {
              // Check if user has voted - need to query the relationship
              const userVoteQuery = `
                MATCH (u:UserNode {id: $userId})-[v:VOTED_ON]->(n:${nodeLabel} {id: $nodeId})
                RETURN v.kind as kind, v.status as status
              `;

              const userVoteResult = await this.neo4jService.read(
                userVoteQuery,
                {
                  userId,
                  nodeId: node.id,
                },
              );

              if (userVoteResult.records.length > 0) {
                userVoteResult.records.forEach((record) => {
                  const kind = record.get('kind');
                  const status = record.get('status');

                  if (kind === 'INCLUSION') {
                    inclusionVote =
                      status === 'agree' ? 'positive' : 'negative';
                  } else if (kind === 'CONTENT') {
                    contentVote = status === 'agree' ? 'positive' : 'negative';
                  }
                });
              }
            }

            return {
              ...node,
              metadata: {
                ...node.metadata,
                userVoteStatus: {
                  inclusionVote,
                  contentVote,
                },
                userVisibilityPreference: visibilityPref || 'visible',
              },
            };
          } catch (error) {
            this.logger.warn(
              `Failed to enrich node ${node.id}: ${error.message}`,
            );
            return node;
          }
        }),
      );

      return enriched;
    } catch (error) {
      this.logger.error(`Error enriching with user context: ${error.message}`);
      return nodes; // Return original nodes if enrichment fails
    }
  }

  /**
   * Get relationships between nodes
   * Phase 4.2+ will implement relationship fetching
   */
  private async getRelationships(
    nodeIds: string[],
    relationshipTypes: string[],
    minCategoryOverlap: number,
  ): Promise<UniversalRelationshipData[]> {
    const relationships: UniversalRelationshipData[] = [];

    if (nodeIds.length === 0) return relationships;

    // Phase 4.2+ will implement relationship fetching
    // For now, return empty array
    this.logger.debug(
      `Relationship fetching will be implemented in Phase 4.2+ ` +
        `(requested types: ${relationshipTypes.join(', ')}, minOverlap: ${minCategoryOverlap})`,
    );

    return relationships;
  }

  /**
   * Get available keywords for filtering
   * Phase 4.2+ will implement with caching
   */
  async getAvailableKeywords(): Promise<KeywordInfo[]> {
    try {
      this.logger.debug('Fetching available keywords');

      const query = `
        MATCH (w:WordNode)-[t:TAGGED]->(n)
        WHERE w.inclusionNetVotes > 0
        AND (n:StatementNode OR n:OpenQuestionNode OR n:AnswerNode OR n:QuantityNode OR n:EvidenceNode)
        WITH w.word as word, count(DISTINCT n) as usageCount
        RETURN word, usageCount
        ORDER BY usageCount DESC
      `;

      const result = await this.neo4jService.read(query, {});

      return result.records.map((record) => ({
        word: record.get('word'),
        usageCount: record.get('usageCount').toInt(),
      }));
    } catch (error) {
      this.logger.error(`Error fetching keywords: ${error.message}`);
      return [];
    }
  }

  /**
   * Get available categories for filtering
   * Phase 4.2+ will implement with caching
   */
  async getAvailableCategories(): Promise<CategoryInfo[]> {
    try {
      this.logger.debug('Fetching available categories');

      const query = `
        MATCH (c:CategoryNode)-[cat:CATEGORIZED_AS]->(n)
        WHERE c.inclusionNetVotes > 0
        AND (n:StatementNode OR n:OpenQuestionNode OR n:AnswerNode OR n:QuantityNode OR n:EvidenceNode)
        WITH c.id as id, c.name as name, c.description as description, count(DISTINCT n) as usageCount
        RETURN id, name, description, usageCount
        ORDER BY usageCount DESC
      `;

      const result = await this.neo4jService.read(query, {});

      return result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        description: record.get('description'),
        usageCount: record.get('usageCount').toInt(),
      }));
    } catch (error) {
      this.logger.error(`Error fetching categories: ${error.message}`);
      return [];
    }
  }
}
