// src/neo4j/schemas/evidence.schema.ts - NEW NODE EXTENDING BaseNodeSchema

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';

// Evidence type categories
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

// Parent node types that can have evidence
export type EvidenceParentType =
  | 'StatementNode'
  | 'AnswerNode'
  | 'QuantityNode';

// Evidence-specific data interface extending BaseNodeData
export interface EvidenceData extends BaseNodeData {
  title: string;
  url: string;
  authors?: string[];
  publicationDate?: Date;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: EvidenceParentType;
  description?: string;
  createdBy: string;
  // Aggregate peer review scores (calculated from reviews)
  avgQualityScore?: number;
  avgIndependenceScore?: number;
  avgRelevanceScore?: number;
  overallScore?: number;
  reviewCount?: number;
  // Enhanced fields returned by getEvidence()
  parentInfo?: {
    id: string;
    type: string;
    title: string;
  };
  reviews?: Array<{
    id: string;
    userId: string;
    qualityScore: number;
    independenceScore: number;
    relevanceScore: number;
    comments?: string;
    createdAt: string;
  }>;
  // Only inclusion voting supported (no content voting - peer review instead)
}

// Peer review data structure
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

// Input data for creating evidence
export interface CreateEvidenceData {
  id: string;
  title: string;
  url: string;
  authors?: string[];
  publicationDate?: Date;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: EvidenceParentType;
  description?: string;
  createdBy: string;
}

// Input data for peer review
export interface CreatePeerReviewData {
  evidenceId: string;
  userId: string;
  qualityScore: number;
  independenceScore: number;
  relevanceScore: number;
  comments?: string;
}

@Injectable()
export class EvidenceSchema extends BaseNodeSchema<EvidenceData> {
  protected readonly nodeLabel = 'EvidenceNode';
  protected readonly idField = 'id'; // Evidence uses standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, EvidenceSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return false; // Evidence uses peer review system instead of content voting
  }

  protected mapNodeFromRecord(record: Record): EvidenceData {
    const props = record.get('n').properties;
    return {
      id: props.id,
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
      createdBy: props.createdBy,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Only inclusion voting (no content voting)
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: 0, // Always 0 - peer review instead
      contentNegativeVotes: 0,
      contentNetVotes: 0,
      // Aggregate peer review scores
      avgQualityScore: this.toNumber(props.avgQualityScore),
      avgIndependenceScore: this.toNumber(props.avgIndependenceScore),
      avgRelevanceScore: this.toNumber(props.avgRelevanceScore),
      overallScore: this.toNumber(props.overallScore),
      reviewCount: this.toNumber(props.reviewCount),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<EvidenceData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id') // Don't update the id field
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

  // EVIDENCE-SPECIFIC METHODS

  async createEvidence(
    evidenceData: CreateEvidenceData,
  ): Promise<EvidenceData> {
    try {
      // Validate required fields
      if (!evidenceData.title || evidenceData.title.trim() === '') {
        throw new BadRequestException('Evidence title cannot be empty');
      }
      if (!evidenceData.url || evidenceData.url.trim() === '') {
        throw new BadRequestException('Evidence URL cannot be empty');
      }
      if (
        !evidenceData.parentNodeId ||
        evidenceData.parentNodeId.trim() === ''
      ) {
        throw new BadRequestException('Parent node ID cannot be empty');
      }

      // Validate URL format (basic check)
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

      this.logger.log(`Creating evidence with ID: ${evidenceData.id}`);
      this.logger.debug(`Evidence data: ${JSON.stringify(evidenceData)}`);

      const result = await this.neo4jService.write(
        `
        // Validate that parent node exists and has passed inclusion threshold
        MATCH (parent:${evidenceData.parentNodeType} {id: $parentNodeId})
        WHERE parent.inclusionNetVotes > 0 // Parent must have passed inclusion
        
        // Create the evidence node
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
          createdAt: datetime(),
          updatedAt: datetime(),
          // Only inclusion voting for evidence
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          // Initialize peer review aggregates
          avgQualityScore: 0,
          avgIndependenceScore: 0,
          avgRelevanceScore: 0,
          overallScore: 0,
          reviewCount: 0
        })
        
        // Create relationship to parent
        CREATE (e)-[:EVIDENCE_FOR]->(parent)
        
        RETURN e
        `,
        {
          id: evidenceData.id,
          title: evidenceData.title,
          url: evidenceData.url,
          authors: evidenceData.authors || [],
          publicationDate: evidenceData.publicationDate?.toISOString(),
          evidenceType: evidenceData.evidenceType,
          parentNodeId: evidenceData.parentNodeId,
          parentNodeType: evidenceData.parentNodeType,
          description: evidenceData.description || '',
          createdBy: evidenceData.createdBy,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Parent node may not exist or have not passed inclusion threshold',
        );
      }

      const createdEvidence = result.records[0].get('e').properties;
      this.logger.log(
        `Successfully created evidence with ID: ${createdEvidence.id}`,
      );

      // Convert properties to EvidenceData using proper Record structure
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: createdEvidence }),
      } as unknown as Record;

      return this.mapNodeFromRecord(mockRecord);
    } catch (error) {
      this.logger.error(
        `Error creating evidence: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message.includes('Parent node may not exist')) {
        throw new BadRequestException(
          'Parent node must exist and have passed inclusion threshold before evidence can be added',
        );
      }

      throw this.standardError('create evidence', error);
    }
  }

  async getEvidence(id: string): Promise<EvidenceData | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (e:EvidenceNode {id: $id})
        
        // Get parent node info
        MATCH (e)-[:EVIDENCE_FOR]->(parent)
        
        // Get peer reviews
        OPTIONAL MATCH (e)<-[:PEER_REVIEWED]-(review:PeerReviewNode)
        
        RETURN e,
        {
          id: parent.id,
          type: labels(parent)[0],
          title: COALESCE(parent.statement, parent.answerText, parent.questionText, parent.quantity)
        } as parentInfo,
        collect({
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

      // Add additional data
      evidence.parentInfo = record.get('parentInfo');
      evidence.reviews = record.get('reviews').filter((r) => r && r.id);

      return evidence;
    } catch (error) {
      this.logger.error(
        `Error getting evidence ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.standardError('retrieve evidence', error);
    }
  }

  // PEER REVIEW SYSTEM

  async submitPeerReview(
    reviewData: CreatePeerReviewData,
  ): Promise<EvidencePeerReview> {
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

      // Check if evidence exists and has passed inclusion threshold
      const evidence = await this.findById(reviewData.evidenceId);
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

      // Check if user has already reviewed this evidence
      const existingReview = await this.getUserPeerReview(
        reviewData.evidenceId,
        reviewData.userId,
      );
      if (existingReview) {
        throw new BadRequestException(
          'User has already submitted a peer review for this evidence',
        );
      }

      this.logger.log(
        `Submitting peer review for evidence ${reviewData.evidenceId} by user ${reviewData.userId}`,
      );

      const reviewId = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const result = await this.neo4jService.write(
        `
        // Find the evidence
        MATCH (e:EvidenceNode {id: $evidenceId})
        
        // Create peer review node
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
        
        // Create relationship
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

      // Update aggregate scores for the evidence
      await this.recalculateEvidenceScores(reviewData.evidenceId);

      this.logger.log(
        `Successfully submitted peer review ${reviewId} for evidence ${reviewData.evidenceId}`,
      );

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
      this.logger.error(
        `Error submitting peer review: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('submit peer review', error);
    }
  }

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
      this.logger.error(
        `Error getting user peer review: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get user peer review', error);
    }
  }

  async recalculateEvidenceScores(evidenceId: string): Promise<void> {
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

      this.logger.debug(`Recalculated scores for evidence ${evidenceId}`);
    } catch (error) {
      this.logger.error(
        `Error recalculating evidence scores: ${error.message}`,
        error.stack,
      );
      throw this.standardError('recalculate evidence scores', error);
    }
  }

  // DISCOVERY METHODS

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
        WHERE e.inclusionNetVotes >= 0 // Include non-negative evidence
        RETURN e as n
        ORDER BY e.inclusionNetVotes DESC, e.overallScore DESC, e.createdAt DESC
        `,
        { nodeId },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting evidence for node: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get evidence for node', error);
    }
  }

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
      this.logger.error(
        `Error getting top rated evidence: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get top rated evidence', error);
    }
  }

  // UTILITY METHODS

  private isValidScore(score: number): boolean {
    return Number.isInteger(score) && score >= 1 && score <= 5;
  }

  async checkEvidence(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (e:EvidenceNode) RETURN count(e) as count',
        {},
      );

      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      this.logger.error(
        `Error checking evidence: ${error.message}`,
        error.stack,
      );
      throw this.standardError('check evidence', error);
    }
  }

  // ✅ INHERITED FROM BaseNodeSchema (No need to implement):
  // - findById() -> for basic evidence retrieval
  // - update() -> for simple evidence updates
  // - delete() -> for evidence deletion
  // - voteInclusion() -> for evidence inclusion voting
  // - getVoteStatus() -> for evidence vote status
  // - removeVote() -> for removing evidence votes
  // - getVotes() -> for getting evidence vote counts
  // - Standard validation, error handling, Neo4j utilities

  // ✅ ENHANCED EVIDENCE-SPECIFIC METHODS:
  // - createEvidence() -> Complex creation with parent validation
  // - getEvidence() -> Enhanced retrieval with parent info and reviews
  // - submitPeerReview() -> Peer review system
  // - getUserPeerReview() -> Get user's review for evidence
  // - recalculateEvidenceScores() -> Aggregate scoring system
  // - getEvidenceForNode() -> Discovery by parent node
  // - getTopRatedEvidence() -> Discovery by quality rating
  // - checkEvidence() -> Utility counting method
}
