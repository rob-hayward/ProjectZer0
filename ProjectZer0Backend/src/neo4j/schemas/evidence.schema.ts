// src/neo4j/schemas/evidence.schema.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';

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

export type EvidenceParentType =
  | 'StatementNode'
  | 'AnswerNode'
  | 'QuantityNode';

export interface EvidenceData extends BaseNodeData {
  title: string;
  url: string;
  authors?: string[];
  publicationDate?: Date;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: EvidenceParentType;
  description?: string;
  avgQualityScore?: number;
  avgIndependenceScore?: number;
  avgRelevanceScore?: number;
  overallScore?: number;
  reviewCount?: number;
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
}

export interface EvidencePeerReview {
  id: string;
  evidenceId: string;
  userId: string;
  qualityScore: number;
  independenceScore: number;
  relevanceScore: number;
  comments?: string;
  createdAt: Date;
  updatedAt?: Date;
}

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
  publicCredit: boolean;
  initialComment?: string;
}

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
  protected readonly idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, EvidenceSchema.name);
  }

  protected supportsContentVoting(): boolean {
    return false;
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
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
      avgQualityScore: this.toNumber(props.avgQualityScore),
      avgIndependenceScore: this.toNumber(props.avgIndependenceScore),
      avgRelevanceScore: this.toNumber(props.avgRelevanceScore),
      overallScore: this.toNumber(props.overallScore),
      reviewCount: this.toNumber(props.reviewCount),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<EvidenceData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id')
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

  async createEvidence(
    evidenceData: CreateEvidenceData,
  ): Promise<EvidenceData> {
    try {
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

      try {
        new URL(evidenceData.url);
      } catch {
        throw new BadRequestException('Invalid URL format');
      }

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

      const result = await this.neo4jService.write(
        `
        MATCH (parent:${evidenceData.parentNodeType} {id: $parentNodeId})
        WHERE parent.inclusionNetVotes > 0
        
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
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          avgQualityScore: 0,
          avgIndependenceScore: 0,
          avgRelevanceScore: 0,
          overallScore: 0,
          reviewCount: 0
        })
        
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
          publicCredit: evidenceData.publicCredit,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Parent node may not exist or have not passed inclusion threshold',
        );
      }

      const createdEvidence = result.records[0].get('e').properties;

      const discussionId = await this.createDiscussion({
        nodeId: evidenceData.id,
        nodeType: this.nodeLabel,
        createdBy: evidenceData.createdBy,
        initialComment: evidenceData.initialComment,
      });

      createdEvidence.discussionId = discussionId;

      const mockRecord = {
        get: (key: string) => {
          if (key === 'n') {
            return { properties: createdEvidence };
          }
          return null;
        },
      } as unknown as Record;

      return this.mapNodeFromRecord(mockRecord);
    } catch (error) {
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
        OPTIONAL MATCH (e)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        MATCH (e)-[:EVIDENCE_FOR]->(parent)
        OPTIONAL MATCH (e)<-[:PEER_REVIEWED]-(review:PeerReviewNode)
        
        RETURN e,
        disc.id as discussionId,
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

      evidence.discussionId = record.get('discussionId');
      evidence.parentInfo = record.get('parentInfo');
      evidence.reviews = record.get('reviews').filter((r) => r && r.id);

      return evidence;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.standardError('retrieve evidence', error);
    }
  }

  async submitPeerReview(
    reviewData: CreatePeerReviewData,
  ): Promise<EvidencePeerReview> {
    try {
      const { qualityScore, independenceScore, relevanceScore } = reviewData;

      if (
        !this.isValidScore(qualityScore) ||
        !this.isValidScore(independenceScore) ||
        !this.isValidScore(relevanceScore)
      ) {
        throw new BadRequestException('All scores must be between 1 and 5');
      }

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
    } catch (error) {
      throw this.standardError('recalculate evidence scores', error);
    }
  }

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
      throw this.standardError('check evidence', error);
    }
  }
}
