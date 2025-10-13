// src/neo4j/schemas/evidence.schema.ts - REFACTORED & FIXED

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import {
  CategorizedNodeSchema,
  CategorizedNodeData,
} from './base/categorized.schema';
import { DiscussionSchema } from './discussion.schema';
import { UserSchema } from './user.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * Evidence types supported by the system
 */
export type EvidenceType =
  | 'academic_paper'
  | 'news_article'
  | 'government_report'
  | 'dataset'
  | 'book'
  | 'website'
  | 'legal_document'
  | 'expert_testimony'
  | 'survey_study'
  | 'meta_analysis'
  | 'other';

/**
 * Parent node types that can have evidence attached
 */
export type EvidenceParentType =
  | 'StatementNode'
  | 'AnswerNode'
  | 'QuantityNode';

/**
 * EvidenceNode data interface
 * External evidence supporting claims in the system
 */
export interface EvidenceData extends CategorizedNodeData {
  title: string;
  url: string;
  authors?: string[];
  publicationDate?: Date;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: EvidenceParentType;
  description?: string;
  // Peer review scores (aggregated)
  avgQualityScore?: number;
  avgIndependenceScore?: number;
  avgRelevanceScore?: number;
  overallScore?: number;
  reviewCount?: number;
  // Related data
  parentInfo?: {
    id: string;
    type: string;
    title: string;
  };
  reviews?: EvidencePeerReview[];
  // Inherited from CategorizedNodeData:
  // - categories (up to 3)
  // Inherited from TaggedNodeData through CategorizedNodeData:
  // - keywords (tagged with relevant words)
  // Inherited from BaseNodeData:
  // - All voting fields (inclusion only for evidence)
  // - discussionId, createdBy, publicCredit, etc.
}

/**
 * Peer review data for evidence quality assessment
 */
export interface EvidencePeerReview {
  id: string;
  evidenceId: string;
  userId: string;
  qualityScore: number; // 1-5 scale
  independenceScore: number; // 1-5 scale
  relevanceScore: number; // 1-5 scale
  comments?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Schema for EvidenceNode - external evidence supporting claims.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> CategorizedNodeSchema -> EvidenceSchema
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Inclusion voting only (no content voting - uses peer review scores instead)
 * - Has discussions (via injected DiscussionSchema)
 * - IS taggable (multiple keywords from the evidence)
 * - IS categorizable (up to 3 categories)
 * - Must link to a parent node (Statement, Answer, or Quantity)
 * - Parent must pass inclusion threshold first
 * - Peer review only after inclusion threshold passed
 * - Quality assessed through 3-dimensional peer review scores
 */
@Injectable()
export class EvidenceSchema extends CategorizedNodeSchema<EvidenceData> {
  protected readonly nodeLabel = 'EvidenceNode';
  protected readonly idField = 'id'; // Standard ID field
  protected readonly maxCategories = 3; // Evidence can have up to 3 categories

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly discussionSchema: DiscussionSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, EvidenceSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return false; // Evidence uses peer review scores, not binary content voting
  }

  protected mapNodeFromRecord(record: Record): EvidenceData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      title: props.title,
      url: props.url,
      authors: props.authors || [],
      publicationDate: props.publicationDate
        ? new Date(props.publicationDate)
        : undefined,
      evidenceType: props.evidenceType,
      parentNodeId: props.parentNodeId,
      parentNodeType: props.parentNodeType,
      description: props.description,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Only inclusion voting (no content voting)
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // Content voting disabled for evidence
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
      // Peer review scores
      avgQualityScore: this.toNumber(props.avgQualityScore),
      avgIndependenceScore: this.toNumber(props.avgIndependenceScore),
      avgRelevanceScore: this.toNumber(props.avgRelevanceScore),
      overallScore: this.toNumber(props.overallScore),
      reviewCount: this.toNumber(props.reviewCount),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<EvidenceData>) {
    // Filter out complex fields that need special handling
    const setClause = Object.keys(data)
      .filter(
        (key) =>
          key !== 'id' &&
          key !== 'keywords' &&
          key !== 'categories' &&
          key !== 'categoryIds' &&
          key !== 'reviews' &&
          key !== 'parentInfo' &&
          key !== 'parentNodeId' && // Don't allow changing parent
          key !== 'parentNodeType', // Don't allow changing parent type
      )
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:EvidenceNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // ============================================
  // EVIDENCE-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new evidence node with keywords and categories
   */
  async createEvidence(evidenceData: {
    id?: string;
    title: string;
    url: string;
    authors?: string[];
    publicationDate?: Date;
    evidenceType: EvidenceType;
    parentNodeId: string;
    parentNodeType: EvidenceParentType;
    description?: string;
    createdBy: string;
    publicCredit: boolean;
    categoryIds?: string[];
    keywords?: KeywordWithFrequency[];
    initialComment?: string;
  }): Promise<EvidenceData> {
    // Validate required fields
    if (!evidenceData.title || evidenceData.title.trim() === '') {
      throw new BadRequestException('Evidence title cannot be empty');
    }
    if (!evidenceData.url || evidenceData.url.trim() === '') {
      throw new BadRequestException('Evidence URL cannot be empty');
    }
    if (!evidenceData.parentNodeId || evidenceData.parentNodeId.trim() === '') {
      throw new BadRequestException('Parent node ID cannot be empty');
    }

    // Validate URL format
    try {
      new URL(evidenceData.url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    // Validate evidence type
    const validTypes: EvidenceType[] = [
      'academic_paper',
      'news_article',
      'government_report',
      'dataset',
      'book',
      'website',
      'legal_document',
      'expert_testimony',
      'survey_study',
      'meta_analysis',
      'other',
    ];
    if (!validTypes.includes(evidenceData.evidenceType)) {
      throw new BadRequestException('Invalid evidence type');
    }

    // Validate category count
    if (
      evidenceData.categoryIds &&
      evidenceData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Evidence can have maximum ${this.maxCategories} categories`,
      );
    }

    const evidenceId = evidenceData.id || uuidv4();

    this.logger.log(`Creating evidence with ID: ${evidenceId}`);

    try {
      let query = `
        // Validate parent node exists and has passed inclusion threshold
        MATCH (parent:${evidenceData.parentNodeType} {id: $parentNodeId})
        WHERE parent.inclusionNetVotes > 0
        
        // Create the evidence node with inclusion voting only (no content voting)
        CREATE (e:EvidenceNode {
          id: $id,
          title: $title,
          url: $url,
          authors: $authors,
          publicationDate: $publicationDate,
          evidenceType: $evidenceType,
          parentNodeId: $parentNodeId,
          parentNodeType: $parentNodeType,
          description: $description,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          createdAt: datetime(),
          updatedAt: datetime(),
          // Only inclusion voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          // Peer review scores (initial)
          avgQualityScore: 0,
          avgIndependenceScore: 0,
          avgRelevanceScore: 0,
          overallScore: 0,
          reviewCount: 0
        })
        
        // Create EVIDENCE_FOR relationship to parent
        CREATE (e)-[:EVIDENCE_FOR]->(parent)
      `;

      const params: any = {
        id: evidenceId,
        title: evidenceData.title.trim(),
        url: evidenceData.url,
        authors: evidenceData.authors || [],
        publicationDate: evidenceData.publicationDate?.toISOString() || null,
        evidenceType: evidenceData.evidenceType,
        parentNodeId: evidenceData.parentNodeId,
        parentNodeType: evidenceData.parentNodeType,
        description: evidenceData.description || '',
        createdBy: evidenceData.createdBy,
        publicCredit: evidenceData.publicCredit,
      };

      // Add categories if provided
      // FIXED BUG #1: Removed WHERE cat.inclusionNetVotes > 0
      if (evidenceData.categoryIds && evidenceData.categoryIds.length > 0) {
        query += `
        // Match categories and create relationships
        WITH e, parent
        UNWIND $categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        
        // Create CATEGORIZED_AS relationships
        CREATE (e)-[:CATEGORIZED_AS {
          createdAt: datetime()
        }]->(cat)
        
        // Create SHARED_CATEGORY relationships for discovery
        WITH e, parent, cat
        OPTIONAL MATCH (other:EvidenceNode)-[:CATEGORIZED_AS]->(cat)
        WHERE other.id <> e.id AND other.inclusionNetVotes > 0
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (e)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)
          ON CREATE SET sc.strength = 1,
                        sc.categoryName = cat.name,
                        sc.createdAt = datetime()
          ON MATCH SET sc.strength = sc.strength + 1,
                       sc.updatedAt = datetime()
        )
        `;
        params.categoryIds = evidenceData.categoryIds;
      }

      // Add keywords if provided
      // FIXED BUG #1: Removed WHERE w.inclusionNetVotes > 0
      if (evidenceData.keywords && evidenceData.keywords.length > 0) {
        query += `
        // Process keywords
        WITH e, parent
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (should already exist)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create TAGGED relationship
        CREATE (e)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        
        // Create SHARED_TAG relationships for discovery
        WITH e, w, keyword, parent
        OPTIONAL MATCH (other:EvidenceNode)-[t:TAGGED]->(w)
        WHERE other.id <> e.id
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (e)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency,
                        st.createdAt = datetime()
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency),
                       st.updatedAt = datetime()
        )
        `;
        params.keywords = evidenceData.keywords;
      }

      // Create user relationship
      query += `
        // Create CREATED relationship for user tracking
        WITH e, parent
        MATCH (u:User {sub: $createdBy})
        CREATE (u)-[:CREATED {
          createdAt: datetime(),
          nodeType: 'evidence'
        }]->(e)
        
        RETURN e as n
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create evidence - parent node may not exist or have not passed inclusion threshold',
        );
      }

      const createdEvidence = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: evidenceId,
          nodeType: this.nodeLabel,
          nodeIdField: 'id',
          createdBy: evidenceData.createdBy,
          initialComment: evidenceData.initialComment,
        });

      createdEvidence.discussionId = discussionResult.discussionId;

      // Track user participation
      try {
        await this.userSchema.addCreatedNode(
          evidenceData.createdBy,
          evidenceId,
          'evidence',
        );
      } catch (error) {
        this.logger.warn(
          `Could not track user creation for evidence ${evidenceId}: ${error.message}`,
        );
      }

      this.logger.log(`Successfully created evidence: ${createdEvidence.id}`);
      return createdEvidence;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('parent node may not exist')) {
        throw new BadRequestException(
          'Parent node must exist and have passed inclusion threshold before evidence can be added',
        );
      }

      if (error.message?.includes('not found')) {
        throw new BadRequestException(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      }

      this.logger.error(
        `Error creating evidence: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create evidence', error);
    }
  }

  /**
   * Gets an evidence node with all its relationships
   */
  async getEvidence(id: string): Promise<EvidenceData | null> {
    this.validateId(id);

    this.logger.debug(`Retrieving evidence with ID: ${id}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode {id: $id})
        
        // Get parent node
        MATCH (e)-[:EVIDENCE_FOR]->(parent)
        
        // Get keywords
        OPTIONAL MATCH (e)-[t:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (e)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        WHERE cat.inclusionNetVotes > 0
        
        // Get discussion
        OPTIONAL MATCH (e)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        // Get peer reviews
        OPTIONAL MATCH (e)<-[:PEER_REVIEWED]-(review:PeerReviewNode)
        
        RETURN e as n,
               {
                 id: parent.id,
                 type: labels(parent)[0],
                 title: COALESCE(parent.statement, parent.answerText, parent.question)
               } as parentInfo,
               collect(DISTINCT {
                 word: w.word,
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
               collect(DISTINCT {
                 id: cat.id,
                 name: cat.name,
                 description: cat.description,
                 inclusionNetVotes: cat.inclusionNetVotes
               }) as categories,
               d.id as discussionId,
               collect(DISTINCT {
                 id: review.id,
                 userId: review.userId,
                 qualityScore: review.qualityScore,
                 independenceScore: review.independenceScore,
                 relevanceScore: review.relevanceScore,
                 comments: review.comments,
                 createdAt: review.createdAt
               }) as reviews
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const evidence = this.mapNodeFromRecord(record);

      // Add related data
      evidence.parentInfo = record.get('parentInfo');
      evidence.discussionId = record.get('discussionId');

      const keywords = record
        .get('keywords')
        .filter((k: any) => k.word !== null);
      const categories = record
        .get('categories')
        .filter((c: any) => c.id !== null);
      const reviews = record.get('reviews').filter((r: any) => r.id !== null);

      if (keywords.length > 0) evidence.keywords = keywords;
      if (categories.length > 0) evidence.categories = categories;
      if (reviews.length > 0) evidence.reviews = reviews;

      this.logger.debug(`Retrieved evidence with ID: ${id}`);
      return evidence;
    } catch (error) {
      this.logger.error(
        `Error retrieving evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve evidence', error);
    }
  }

  /**
   * Updates an evidence node including its keywords and categories
   */
  async updateEvidence(
    id: string,
    updateData: {
      title?: string;
      url?: string;
      authors?: string[];
      publicationDate?: Date;
      description?: string;
      publicCredit?: boolean;
      categoryIds?: string[];
      keywords?: KeywordWithFrequency[];
    },
  ): Promise<EvidenceData | null> {
    this.validateId(id);

    // Validate URL if being updated
    if (updateData.url) {
      try {
        new URL(updateData.url);
      } catch {
        throw new BadRequestException('Invalid URL format');
      }
    }

    // Validate category count if updating categories
    if (
      updateData.categoryIds &&
      updateData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Evidence can have maximum ${this.maxCategories} categories`,
      );
    }

    // If no keywords or categories to update, use base update
    if (!updateData.keywords && updateData.categoryIds === undefined) {
      // Convert date to string if present
      if (updateData.publicationDate) {
        (updateData as any).publicationDate =
          updateData.publicationDate.toISOString();
      }
      return await this.update(id, updateData);
    }

    // Complex update with keywords/categories
    try {
      // Update categories if provided (uses inherited method)
      if (updateData.categoryIds !== undefined) {
        await this.updateCategories(id, updateData.categoryIds);
      }

      // Update keywords if provided (uses inherited method)
      if (updateData.keywords) {
        await this.updateKeywords(id, updateData.keywords);
      }

      // Update basic properties
      const basicUpdate = { ...updateData };
      delete basicUpdate.keywords;
      delete basicUpdate.categoryIds;

      // Convert date to string if present
      if (basicUpdate.publicationDate) {
        (basicUpdate as any).publicationDate =
          basicUpdate.publicationDate.toISOString();
      }

      if (Object.keys(basicUpdate).length > 0) {
        await this.update(id, basicUpdate);
      }

      // Return updated evidence
      return await this.getEvidence(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Error updating evidence: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update evidence', error);
    }
  }

  // ============================================
  // PEER REVIEW METHODS - Core unique functionality
  // ============================================

  /**
   * Submit a peer review for evidence (requires inclusion threshold)
   */
  async submitPeerReview(reviewData: {
    evidenceId: string;
    userId: string;
    qualityScore: number;
    independenceScore: number;
    relevanceScore: number;
    comments?: string;
  }): Promise<EvidencePeerReview> {
    try {
      // Validate scores (1-5 scale)
      const { qualityScore, independenceScore, relevanceScore } = reviewData;

      if (
        !this.isValidScore(qualityScore) ||
        !this.isValidScore(independenceScore) ||
        !this.isValidScore(relevanceScore)
      ) {
        throw new BadRequestException('All scores must be between 1 and 5');
      }

      // Check if evidence exists and has passed inclusion
      const evidence = await this.getEvidence(reviewData.evidenceId);
      if (!evidence) {
        throw new NotFoundException(
          `Evidence with ID ${reviewData.evidenceId} not found`,
        );
      }

      if (!VotingUtils.hasPassedInclusion(evidence.inclusionNetVotes)) {
        throw new BadRequestException(
          'Evidence must pass inclusion threshold before peer review is allowed',
        );
      }

      // Check if user has already reviewed
      const existingReview = await this.getUserPeerReview(
        reviewData.evidenceId,
        reviewData.userId,
      );
      if (existingReview) {
        throw new BadRequestException(
          'User has already submitted a peer review for this evidence',
        );
      }

      const reviewId = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const result = await this.neo4jService.write(
        `
        MATCH (e:EvidenceNode {id: $evidenceId})
        
        CREATE (pr:PeerReviewNode {
          id: $reviewId,
          evidenceId: $evidenceId,
          userId: $userId,
          qualityScore: $qualityScore,
          independenceScore: $independenceScore,
          relevanceScore: $relevanceScore,
          comments: $comments,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        
        CREATE (pr)-[:PEER_REVIEWED]->(e)
        
        RETURN pr
        `,
        {
          reviewId,
          evidenceId: reviewData.evidenceId,
          userId: reviewData.userId,
          qualityScore: reviewData.qualityScore,
          independenceScore: reviewData.independenceScore,
          relevanceScore: reviewData.relevanceScore,
          comments: reviewData.comments || '',
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create peer review');
      }

      const createdReview = result.records[0].get('pr').properties;

      // Recalculate aggregate scores
      await this.recalculateEvidenceScores(reviewData.evidenceId);

      return {
        id: createdReview.id,
        evidenceId: createdReview.evidenceId,
        userId: createdReview.userId,
        qualityScore: this.toNumber(createdReview.qualityScore),
        independenceScore: this.toNumber(createdReview.independenceScore),
        relevanceScore: this.toNumber(createdReview.relevanceScore),
        comments: createdReview.comments,
        createdAt: new Date(createdReview.createdAt),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('submit peer review', error);
    }
  }

  /**
   * Get user's peer review for specific evidence
   */
  async getUserPeerReview(
    evidenceId: string,
    userId: string,
  ): Promise<EvidencePeerReview | null> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (pr:PeerReviewNode {evidenceId: $evidenceId, userId: $userId})
        RETURN pr
        `,
        { evidenceId, userId },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const review = result.records[0].get('pr').properties;
      return {
        id: review.id,
        evidenceId: review.evidenceId,
        userId: review.userId,
        qualityScore: this.toNumber(review.qualityScore),
        independenceScore: this.toNumber(review.independenceScore),
        relevanceScore: this.toNumber(review.relevanceScore),
        comments: review.comments,
        createdAt: new Date(review.createdAt),
        updatedAt: review.updatedAt ? new Date(review.updatedAt) : undefined,
      };
    } catch (error) {
      throw this.standardError('get user peer review', error);
    }
  }

  /**
   * Recalculate aggregate scores for evidence based on all reviews
   */
  private async recalculateEvidenceScores(evidenceId: string): Promise<void> {
    try {
      await this.neo4jService.write(
        `
        MATCH (e:EvidenceNode {id: $evidenceId})
        OPTIONAL MATCH (e)<-[:PEER_REVIEWED]-(pr:PeerReviewNode)
        
        WITH e, 
             count(pr) as reviewCount,
             avg(pr.qualityScore) as avgQuality,
             avg(pr.independenceScore) as avgIndependence,
             avg(pr.relevanceScore) as avgRelevance
        
        SET e.reviewCount = reviewCount,
            e.avgQualityScore = COALESCE(avgQuality, 0),
            e.avgIndependenceScore = COALESCE(avgIndependence, 0),
            e.avgRelevanceScore = COALESCE(avgRelevance, 0),
            e.overallScore = CASE 
              WHEN reviewCount > 0 
              THEN (avgQuality * 0.333) + (avgIndependence * 0.333) + (avgRelevance * 0.334)
              ELSE 0 
            END,
            e.updatedAt = datetime()
        `,
        { evidenceId },
      );
    } catch (error) {
      throw this.standardError('recalculate evidence scores', error);
    }
  }

  /**
   * Validate peer review score (1-5 scale)
   */
  private isValidScore(score: number): boolean {
    return Number.isInteger(score) && score >= 1 && score <= 5;
  }

  // ============================================
  // DISCOVERY METHODS - Leveraging inherited functionality
  // ============================================

  /**
   * Get evidence related by tags or categories
   */
  async getRelatedEvidence(
    evidenceId: string,
    limit: number = 10,
  ): Promise<EvidenceData[]> {
    // Use inherited method from CategorizedNodeSchema
    const related = await this.findRelatedByCombined(evidenceId, limit);

    // Load full evidence data for each related ID
    const evidenceList = await Promise.all(
      related.map((r) => this.getEvidence(r.nodeId)),
    );

    return evidenceList.filter((e) => e !== null) as EvidenceData[];
  }

  /**
   * Get evidence for a specific node
   */
  async getEvidenceForNode(
    nodeId: string,
    nodeType: EvidenceParentType,
  ): Promise<EvidenceData[]> {
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (parent:${nodeType} {id: $nodeId})<-[:EVIDENCE_FOR]-(e:EvidenceNode)
        WHERE e.inclusionNetVotes >= 0
        RETURN e as n
        ORDER BY e.inclusionNetVotes DESC, e.overallScore DESC, e.createdAt DESC
        `,
        { nodeId },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      throw this.standardError('get evidence for node', error);
    }
  }

  /**
   * Get top-rated evidence across the system
   */
  async getTopRatedEvidence(
    limit: number = 20,
    evidenceType?: EvidenceType,
  ): Promise<EvidenceData[]> {
    try {
      let query = `
        MATCH (e:EvidenceNode)
        WHERE e.inclusionNetVotes > 0 AND e.reviewCount >= 5
      `;

      const params: any = { limit };

      if (evidenceType) {
        query += ` AND e.evidenceType = $evidenceType`;
        params.evidenceType = evidenceType;
      }

      query += `
        RETURN e as n
        ORDER BY e.overallScore DESC, e.reviewCount DESC, e.inclusionNetVotes DESC
        LIMIT $limit
      `;

      const result = await this.neo4jService.read(query, params);

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      throw this.standardError('get top rated evidence', error);
    }
  }

  /**
   * Get evidence by type
   */
  async getEvidenceByType(
    evidenceType: EvidenceType,
    options: {
      includeUnapproved?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<EvidenceData[]> {
    const { includeUnapproved = false, limit = 50, offset = 0 } = options;

    try {
      const whereClause = includeUnapproved
        ? 'WHERE e.evidenceType = $evidenceType'
        : 'WHERE e.evidenceType = $evidenceType AND e.inclusionNetVotes > 0';

      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode)
        ${whereClause}
        RETURN e as n
        ORDER BY e.inclusionNetVotes DESC, e.overallScore DESC
        SKIP $offset
        LIMIT $limit
        `,
        { evidenceType, offset, limit },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      throw this.standardError('get evidence by type', error);
    }
  }

  /**
   * Get evidence with minimum peer review count
   */
  async getWellReviewedEvidence(
    minReviewCount: number = 3,
    limit: number = 20,
  ): Promise<EvidenceData[]> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode)
        WHERE e.inclusionNetVotes > 0 AND e.reviewCount >= $minReviewCount
        RETURN e as n
        ORDER BY e.overallScore DESC, e.reviewCount DESC
        LIMIT $limit
        `,
        { minReviewCount, limit },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      throw this.standardError('get well-reviewed evidence', error);
    }
  }

  /**
   * Get all evidence with optional filters
   */
  async getAllEvidence(
    options: {
      includeUnapproved?: boolean;
      categoryId?: string;
      evidenceType?: EvidenceType;
      parentType?: EvidenceParentType;
      minReviewCount?: number;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<EvidenceData[]> {
    const {
      includeUnapproved = false,
      categoryId,
      evidenceType,
      parentType,
      minReviewCount,
      limit = 50,
      offset = 0,
    } = options;

    try {
      const whereConditions = [];
      const params: any = { limit, offset };

      if (!includeUnapproved) {
        whereConditions.push('e.inclusionNetVotes > 0');
      }

      if (categoryId) {
        whereConditions.push(
          'EXISTS((e)-[:CATEGORIZED_AS]->(:CategoryNode {id: $categoryId}))',
        );
        params.categoryId = categoryId;
      }

      if (evidenceType) {
        whereConditions.push('e.evidenceType = $evidenceType');
        params.evidenceType = evidenceType;
      }

      if (parentType) {
        whereConditions.push('e.parentNodeType = $parentType');
        params.parentType = parentType;
      }

      if (minReviewCount !== undefined) {
        whereConditions.push('e.reviewCount >= $minReviewCount');
        params.minReviewCount = minReviewCount;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode)
        ${whereClause}
        RETURN e as n
        ORDER BY e.inclusionNetVotes DESC, e.overallScore DESC
        SKIP $offset
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      throw this.standardError('get evidence', error);
    }
  }

  /**
   * Check if peer review is allowed (evidence has passed inclusion threshold)
   */
  async isPeerReviewAllowed(evidenceId: string): Promise<boolean> {
    try {
      const evidence = await this.getEvidence(evidenceId);
      if (!evidence) return false;

      return VotingUtils.hasPassedInclusion(evidence.inclusionNetVotes);
    } catch (error) {
      this.logger.error(
        `Error checking peer review availability: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get peer review statistics for evidence
   */
  async getPeerReviewStats(evidenceId: string): Promise<{
    reviewCount: number;
    avgQualityScore: number;
    avgIndependenceScore: number;
    avgRelevanceScore: number;
    overallScore: number;
    scoreDistribution: {
      quality: { [key: number]: number };
      independence: { [key: number]: number };
      relevance: { [key: number]: number };
    };
  }> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode {id: $evidenceId})
        OPTIONAL MATCH (e)<-[:PEER_REVIEWED]-(pr:PeerReviewNode)
        
        WITH e, collect(pr) as reviews
        
        RETURN e.reviewCount as reviewCount,
               e.avgQualityScore as avgQualityScore,
               e.avgIndependenceScore as avgIndependenceScore,
               e.avgRelevanceScore as avgRelevanceScore,
               e.overallScore as overallScore,
               [r IN reviews | r.qualityScore] as qualityScores,
               [r IN reviews | r.independenceScore] as independenceScores,
               [r IN reviews | r.relevanceScore] as relevanceScores
        `,
        { evidenceId },
      );

      if (!result.records || result.records.length === 0) {
        return {
          reviewCount: 0,
          avgQualityScore: 0,
          avgIndependenceScore: 0,
          avgRelevanceScore: 0,
          overallScore: 0,
          scoreDistribution: {
            quality: {},
            independence: {},
            relevance: {},
          },
        };
      }

      const record = result.records[0];

      // Calculate score distributions
      const calculateDistribution = (
        scores: number[],
      ): { [key: number]: number } => {
        const distribution: { [key: number]: number } = {};
        for (let i = 1; i <= 5; i++) {
          distribution[i] = 0;
        }
        scores.forEach((score) => {
          if (score >= 1 && score <= 5) {
            distribution[score]++;
          }
        });
        return distribution;
      };

      const qualityScores = record.get('qualityScores') || [];
      const independenceScores = record.get('independenceScores') || [];
      const relevanceScores = record.get('relevanceScores') || [];

      return {
        reviewCount: this.toNumber(record.get('reviewCount')),
        avgQualityScore: this.toNumber(record.get('avgQualityScore')),
        avgIndependenceScore: this.toNumber(record.get('avgIndependenceScore')),
        avgRelevanceScore: this.toNumber(record.get('avgRelevanceScore')),
        overallScore: this.toNumber(record.get('overallScore')),
        scoreDistribution: {
          quality: calculateDistribution(
            qualityScores.map((s) => this.toNumber(s)),
          ),
          independence: calculateDistribution(
            independenceScores.map((s) => this.toNumber(s)),
          ),
          relevance: calculateDistribution(
            relevanceScores.map((s) => this.toNumber(s)),
          ),
        },
      };
    } catch (error) {
      throw this.standardError('get peer review stats', error);
    }
  }

  /**
   * Check evidence statistics
   */
  async checkEvidence(): Promise<{
    count: number;
    byType: { [key in EvidenceType]?: number };
    withReviews: number;
    wellReviewed: number;
  }> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode)
        RETURN 
          count(e) as count,
          count(CASE WHEN e.reviewCount > 0 THEN 1 END) as withReviews,
          count(CASE WHEN e.reviewCount >= 5 THEN 1 END) as wellReviewed,
          count(CASE WHEN e.evidenceType = 'academic_paper' THEN 1 END) as academicPapers,
          count(CASE WHEN e.evidenceType = 'news_article' THEN 1 END) as newsArticles,
          count(CASE WHEN e.evidenceType = 'government_report' THEN 1 END) as governmentReports,
          count(CASE WHEN e.evidenceType = 'dataset' THEN 1 END) as datasets,
          count(CASE WHEN e.evidenceType = 'book' THEN 1 END) as books,
          count(CASE WHEN e.evidenceType = 'website' THEN 1 END) as websites,
          count(CASE WHEN e.evidenceType = 'legal_document' THEN 1 END) as legalDocuments,
          count(CASE WHEN e.evidenceType = 'expert_testimony' THEN 1 END) as expertTestimony,
          count(CASE WHEN e.evidenceType = 'survey_study' THEN 1 END) as surveyStudies,
          count(CASE WHEN e.evidenceType = 'meta_analysis' THEN 1 END) as metaAnalyses,
          count(CASE WHEN e.evidenceType = 'other' THEN 1 END) as other
        `,
      );

      const record = result.records[0];

      return {
        count: this.toNumber(record.get('count')),
        byType: {
          academic_paper: this.toNumber(record.get('academicPapers')),
          news_article: this.toNumber(record.get('newsArticles')),
          government_report: this.toNumber(record.get('governmentReports')),
          dataset: this.toNumber(record.get('datasets')),
          book: this.toNumber(record.get('books')),
          website: this.toNumber(record.get('websites')),
          legal_document: this.toNumber(record.get('legalDocuments')),
          expert_testimony: this.toNumber(record.get('expertTestimony')),
          survey_study: this.toNumber(record.get('surveyStudies')),
          meta_analysis: this.toNumber(record.get('metaAnalyses')),
          other: this.toNumber(record.get('other')),
        },
        withReviews: this.toNumber(record.get('withReviews')),
        wellReviewed: this.toNumber(record.get('wellReviewed')),
      };
    } catch (error) {
      this.logger.error(`Error checking evidence: ${error.message}`);
      throw this.standardError('check evidence', error);
    }
  }
}
