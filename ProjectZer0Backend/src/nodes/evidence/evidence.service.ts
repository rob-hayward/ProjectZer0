// src/nodes/evidence/evidence.service.ts

import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  EvidenceSchema,
  EvidenceData,
  EvidenceType,
  EvidencePeerReview,
} from '../../neo4j/schemas/evidence.schema';
import { CategoryService } from '../category/category.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { KeywordExtractionService } from '../../services/keyword-extraction/keyword-extraction.service';
import { WordService } from '../word/word.service';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { v4 as uuidv4 } from 'uuid';

interface CreateEvidenceData {
  title: string;
  url: string;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
  authors?: string[];
  publicationDate?: Date;
  description?: string;
  publicCredit: boolean;
  createdBy: string;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;
}

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly evidenceSchema: EvidenceSchema,
    private readonly categoryService: CategoryService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
    private readonly keywordExtractionService: KeywordExtractionService,
    private readonly wordService: WordService,
    private readonly userSchema: UserSchema,
  ) {}

  async createEvidence(
    evidenceData: CreateEvidenceData,
  ): Promise<EvidenceData> {
    try {
      this.validateCreateEvidenceData(evidenceData);

      const evidenceId = uuidv4();

      this.logger.log(
        `Creating evidence for parent: ${evidenceData.parentNodeId} (${evidenceData.parentNodeType})`,
      );

      let keywords: KeywordWithFrequency[] = [];
      if (evidenceData.userKeywords && evidenceData.userKeywords.length > 0) {
        keywords = evidenceData.userKeywords.map((keyword) => ({
          word: keyword,
          frequency: 1,
          source: 'user' as const,
        }));
      } else {
        try {
          const textToAnalyze = [
            evidenceData.title,
            evidenceData.description || '',
            evidenceData.authors?.join(', ') || '',
          ]
            .filter((t) => t)
            .join(' ');

          const extractionResult =
            await this.keywordExtractionService.extractKeywords({
              text: textToAnalyze,
              userKeywords: evidenceData.userKeywords,
            });
          keywords = extractionResult.keywords;
        } catch (error) {
          this.logger.warn(
            `Keyword extraction failed for evidence: ${error.message}`,
          );
          keywords = [];
        }
      }

      if (keywords.length > 0) {
        await this.processKeywordsForCreation(keywords, evidenceData);
      }

      if (evidenceData.categoryIds && evidenceData.categoryIds.length > 0) {
        await this.validateCategories(evidenceData.categoryIds);
      }

      const evidence = await this.evidenceSchema.createEvidence({
        id: evidenceId,
        ...evidenceData,
        keywords,
      });

      try {
        await this.userSchema.addCreatedNode(
          evidenceData.createdBy,
          evidenceId,
          'evidence',
        );
      } catch (error) {
        this.logger.warn(
          `Failed to track evidence creation in UserSchema: ${error.message}`,
        );
      }

      this.logger.log(`Successfully created evidence: ${evidence.id}`);
      return evidence;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error creating evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to create evidence: ${error.message}`,
      );
    }
  }

  async getEvidence(id: string): Promise<EvidenceData> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const evidence = await this.evidenceSchema.getEvidence(id);

      if (!evidence) {
        throw new NotFoundException(`Evidence with ID ${id} not found`);
      }

      return evidence;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error retrieving evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve evidence: ${error.message}`,
      );
    }
  }

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
  ): Promise<EvidenceData> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      if (updateData.categoryIds) {
        await this.validateCategories(updateData.categoryIds);
      }

      const updated = await this.evidenceSchema.updateEvidence(id, updateData);

      if (!updated) {
        throw new NotFoundException(`Evidence with ID ${id} not found`);
      }

      return updated;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update evidence: ${error.message}`,
      );
    }
  }

  async deleteEvidence(id: string, userId: string): Promise<void> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const evidence = await this.getEvidence(id);

      if (evidence.createdBy !== userId) {
        throw new BadRequestException(
          'Only the creator can delete this evidence',
        );
      }

      await this.evidenceSchema.delete(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to delete evidence: ${error.message}`,
      );
    }
  }

  async submitPeerReview(reviewData: {
    evidenceId: string;
    userId: string;
    qualityScore: number;
    independenceScore: number;
    relevanceScore: number;
    comments?: string;
  }): Promise<EvidencePeerReview> {
    try {
      const review = await this.evidenceSchema.submitPeerReview(reviewData);
      return review;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error submitting peer review: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to submit peer review: ${error.message}`,
      );
    }
  }

  async getPeerReviewStats(evidenceId: string) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return await this.evidenceSchema.getPeerReviewStats(evidenceId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting peer review stats for ${evidenceId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get peer review stats: ${error.message}`,
      );
    }
  }

  async getUserPeerReview(
    evidenceId: string,
    userId: string,
  ): Promise<EvidencePeerReview | null> {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return await this.evidenceSchema.getUserPeerReview(evidenceId, userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting user peer review: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get user peer review: ${error.message}`,
      );
    }
  }

  async isPeerReviewAllowed(evidenceId: string): Promise<boolean> {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return await this.evidenceSchema.isPeerReviewAllowed(evidenceId);
    } catch {
      return false;
    }
  }

  async getEvidenceForNode(
    parentNodeId: string,
    parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode',
  ): Promise<EvidenceData[]> {
    try {
      if (!parentNodeId || parentNodeId.trim() === '') {
        throw new BadRequestException('Parent node ID is required');
      }

      return await this.evidenceSchema.getEvidenceForNode(
        parentNodeId,
        parentNodeType,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting evidence for node: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get evidence for node: ${error.message}`,
      );
    }
  }

  async getTopRatedEvidence(
    options: {
      limit?: number;
      evidenceType?: EvidenceType;
    } = {},
  ): Promise<EvidenceData[]> {
    try {
      return await this.evidenceSchema.getTopRatedEvidence(
        options.limit,
        options.evidenceType,
      );
    } catch (error) {
      this.logger.error(
        `Error getting top-rated evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get top-rated evidence: ${error.message}`,
      );
    }
  }

  async searchEvidence(filters: {
    evidenceType?: EvidenceType;
    minOverallScore?: number;
    minInclusionVotes?: number;
    limit?: number;
    offset?: number;
  }): Promise<EvidenceData[]> {
    try {
      return await this.evidenceSchema.getAllEvidence({
        evidenceType: filters.evidenceType,
        minReviewCount: filters.minOverallScore ? 1 : undefined,
        includeUnapproved: false,
        limit: filters.limit || 20,
        offset: filters.offset || 0,
      });
    } catch (error) {
      this.logger.error(
        `Error searching evidence: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to search evidence: ${error.message}`,
      );
    }
  }

  async getEvidenceCategories(evidenceId: string) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return await this.evidenceSchema.getCategories(evidenceId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting categories for evidence ${evidenceId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get evidence categories: ${error.message}`,
      );
    }
  }

  async discoverRelatedEvidence(evidenceId: string) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const categories = await this.getEvidenceCategories(evidenceId);
      const categoryIds = categories.map((c) => c.id);

      if (categoryIds.length === 0) {
        return { evidence: [], totalOverlap: 0 };
      }

      this.logger.warn(
        `discoverRelatedEvidence not fully implemented - returning empty array`,
      );

      return {
        evidence: [],
        totalOverlap: 0,
        categoryIds,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error discovering related evidence for ${evidenceId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to discover related evidence: ${error.message}`,
      );
    }
  }

  async getEvidenceWithDiscussion(id: string) {
    return this.getEvidence(id);
  }

  async getEvidenceComments(id: string) {
    try {
      const evidence = await this.getEvidence(id);

      if (!evidence.discussionId) {
        return { comments: [] };
      }

      const comments = await this.commentService.getCommentsByDiscussionId(
        evidence.discussionId,
      );
      return { comments };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting comments for evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get evidence comments: ${error.message}`,
      );
    }
  }

  async addEvidenceComment(
    id: string,
    commentData: { commentText: string; parentCommentId?: string },
    createdBy: string,
  ) {
    try {
      const evidence = await this.getEvidence(id);

      if (!evidence.discussionId) {
        throw new Error(
          `Evidence ${id} is missing its discussion - this should not happen`,
        );
      }

      const comment = await this.commentService.createComment({
        createdBy,
        discussionId: evidence.discussionId,
        commentText: commentData.commentText,
        parentCommentId: commentData.parentCommentId,
      });

      return comment;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error adding comment to evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to add evidence comment: ${error.message}`,
      );
    }
  }

  async isEvidenceApproved(id: string): Promise<boolean> {
    try {
      const evidence = await this.getEvidence(id);
      return evidence.inclusionNetVotes > 0;
    } catch {
      return false;
    }
  }

  async getEvidenceVotes(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return await this.evidenceSchema.getVotes(id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for evidence ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to get evidence votes: ${error.message}`,
      );
    }
  }

  async checkEvidenceStats() {
    try {
      return await this.evidenceSchema.checkEvidence();
    } catch (error) {
      this.logger.error(
        `Error checking evidence stats: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to check evidence stats: ${error.message}`,
      );
    }
  }

  private validateCreateEvidenceData(data: CreateEvidenceData): void {
    if (!data.title || data.title.trim() === '') {
      throw new BadRequestException('Title is required');
    }

    if (!data.url || data.url.trim() === '') {
      throw new BadRequestException('URL is required');
    }

    try {
      new URL(data.url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (!data.parentNodeId || data.parentNodeId.trim() === '') {
      throw new BadRequestException('Parent node ID is required');
    }

    if (!data.parentNodeType) {
      throw new BadRequestException('Parent node type is required');
    }

    const validParentTypes = ['StatementNode', 'AnswerNode', 'QuantityNode'];
    if (!validParentTypes.includes(data.parentNodeType)) {
      throw new BadRequestException('Invalid parent node type');
    }

    if (typeof data.publicCredit !== 'boolean') {
      throw new BadRequestException('Public credit flag is required');
    }

    if (data.categoryIds && data.categoryIds.length > 3) {
      throw new BadRequestException('Evidence can have maximum 3 categories');
    }
  }

  private async processKeywordsForCreation(
    keywords: KeywordWithFrequency[],
    evidenceData: CreateEvidenceData,
  ): Promise<void> {
    for (const keyword of keywords) {
      try {
        const existingWord = await this.wordService.getWord(keyword.word);
        if (!existingWord) {
          await this.wordService.createWord({
            word: keyword.word,
            createdBy: evidenceData.createdBy,
            publicCredit: false,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Could not ensure word exists for keyword "${keyword.word}": ${error.message}`,
        );
      }
    }
  }

  private async validateCategories(categoryIds: string[]): Promise<void> {
    for (const categoryId of categoryIds) {
      const category = await this.categoryService.getCategory(categoryId);
      if (!category) {
        throw new BadRequestException(
          `Category with ID ${categoryId} not found`,
        );
      }
      if (category.inclusionNetVotes <= 0) {
        throw new BadRequestException(
          `Category ${categoryId} has not passed inclusion threshold`,
        );
      }
    }
  }
}
