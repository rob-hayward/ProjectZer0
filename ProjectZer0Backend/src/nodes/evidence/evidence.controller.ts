// src/nodes/evidence/evidence.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EvidenceService } from './evidence.service';
import { EvidenceType } from '../../neo4j/schemas/evidence.schema';

interface CreateEvidenceDto {
  title: string;
  url: string;
  evidenceType: EvidenceType;
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
  authors?: string[];
  publicationDate?: string;
  description?: string;
  publicCredit: boolean;
  categoryIds?: string[];
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateEvidenceDto {
  title?: string;
  url?: string;
  authors?: string[];
  publicationDate?: string;
  description?: string;
  publicCredit?: boolean;
  categoryIds?: string[];
}

interface SubmitPeerReviewDto {
  qualityScore: number;
  independenceScore: number;
  relevanceScore: number;
  comments?: string;
}

interface VoteEvidenceDto {
  isPositive: boolean;
}

interface AddCommentDto {
  commentText: string;
  parentCommentId?: string;
}

@Controller('nodes/evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  private readonly logger = new Logger(EvidenceController.name);

  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEvidence(
    @Body() evidenceData: CreateEvidenceDto,
    @Request() req: any,
  ) {
    try {
      this.logger.log(
        `Creating evidence for parent: ${evidenceData.parentNodeId}`,
      );

      if (!evidenceData.title || evidenceData.title.trim() === '') {
        throw new BadRequestException('Title is required');
      }

      if (!evidenceData.url || evidenceData.url.trim() === '') {
        throw new BadRequestException('URL is required');
      }

      if (
        !evidenceData.parentNodeId ||
        evidenceData.parentNodeId.trim() === ''
      ) {
        throw new BadRequestException('Parent node ID is required');
      }

      if (!evidenceData.parentNodeType) {
        throw new BadRequestException('Parent node type is required');
      }

      if (!evidenceData.evidenceType) {
        throw new BadRequestException('Evidence type is required');
      }

      if (typeof evidenceData.publicCredit !== 'boolean') {
        throw new BadRequestException('Public credit flag is required');
      }

      let publicationDate: Date | undefined;
      if (evidenceData.publicationDate) {
        publicationDate = new Date(evidenceData.publicationDate);
        if (isNaN(publicationDate.getTime())) {
          throw new BadRequestException('Invalid publication date format');
        }
      }

      const result = await this.evidenceService.createEvidence({
        ...evidenceData,
        publicationDate,
        createdBy: req.user.sub,
      });

      this.logger.log(`Successfully created evidence with ID: ${result.id}`);
      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error creating evidence for parent: ${evidenceData.parentNodeId}`,
      );
    }
  }

  @Get(':id')
  async getEvidence(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const evidence = await this.evidenceService.getEvidence(id);
      return evidence;
    } catch (error) {
      this.handleError(error, `Error retrieving evidence: ${id}`);
    }
  }

  @Put(':id')
  async updateEvidence(
    @Param('id') id: string,
    @Body() updateData: UpdateEvidenceDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      let publicationDate: Date | undefined;
      if (updateData.publicationDate) {
        publicationDate = new Date(updateData.publicationDate);
        if (isNaN(publicationDate.getTime())) {
          throw new BadRequestException('Invalid publication date format');
        }
      }

      const updatePayload = {
        ...updateData,
        publicationDate,
      };

      const result = await this.evidenceService.updateEvidence(
        id,
        updatePayload,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error updating evidence: ${id}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvidence(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      await this.evidenceService.deleteEvidence(id, req.user.sub);
    } catch (error) {
      this.handleError(error, `Error deleting evidence: ${id}`);
    }
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  async submitPeerReview(
    @Param('id') evidenceId: string,
    @Body() reviewData: SubmitPeerReviewDto,
    @Request() req: any,
  ) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const { qualityScore, independenceScore, relevanceScore } = reviewData;

      if (
        !this.isValidScore(qualityScore) ||
        !this.isValidScore(independenceScore) ||
        !this.isValidScore(relevanceScore)
      ) {
        throw new BadRequestException(
          'All scores must be between 1 and 5 (inclusive)',
        );
      }

      const result = await this.evidenceService.submitPeerReview({
        evidenceId,
        userId: req.user.sub,
        ...reviewData,
      });

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error submitting peer review for evidence: ${evidenceId}`,
      );
    }
  }

  @Get(':id/reviews/stats')
  async getPeerReviewStats(@Param('id') evidenceId: string) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const stats = await this.evidenceService.getPeerReviewStats(evidenceId);
      return stats;
    } catch (error) {
      this.handleError(
        error,
        `Error getting peer review stats for: ${evidenceId}`,
      );
    }
  }

  @Get(':id/reviews/mine')
  async getMyPeerReview(@Param('id') evidenceId: string, @Request() req: any) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const review = await this.evidenceService.getUserPeerReview(
        evidenceId,
        req.user.sub,
      );

      return review || { hasReviewed: false };
    } catch (error) {
      this.handleError(
        error,
        `Error getting user's peer review for: ${evidenceId}`,
      );
    }
  }

  @Get(':id/reviews/allowed')
  async isPeerReviewAllowed(@Param('id') evidenceId: string) {
    try {
      if (!evidenceId || evidenceId.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const allowed =
        await this.evidenceService.isPeerReviewAllowed(evidenceId);

      return { allowed };
    } catch (error) {
      this.handleError(
        error,
        `Error checking peer review availability for: ${evidenceId}`,
      );
    }
  }

  @Post(':id/vote/inclusion')
  @HttpCode(HttpStatus.OK)
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteData: VoteEvidenceDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException('Vote value (isPositive) is required');
      }

      const status = voteData.isPositive ? 'agree' : 'disagree';

      return {
        success: true,
        message: 'Inclusion vote recorded',
        status,
      };
    } catch (error) {
      this.handleError(error, `Error voting on evidence inclusion: ${id}`);
    }
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVote(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return {
        success: true,
        message: 'Vote removed',
      };
    } catch (error) {
      this.handleError(error, `Error removing vote from evidence: ${id}`);
    }
  }

  @Get(':id/votes')
  async getVotes(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const votes = await this.evidenceService.getEvidenceVotes(id);
      return votes;
    } catch (error) {
      this.handleError(error, `Error getting votes for evidence: ${id}`);
    }
  }

  @Get('parent/:parentNodeId')
  async getEvidenceForParent(
    @Param('parentNodeId') parentNodeId: string,
    @Query('parentNodeType') parentNodeType?: string,
  ) {
    try {
      if (!parentNodeId || parentNodeId.trim() === '') {
        throw new BadRequestException('Parent node ID is required');
      }

      if (!parentNodeType) {
        throw new BadRequestException('Parent node type is required');
      }

      const validParentTypes = ['StatementNode', 'AnswerNode', 'QuantityNode'];
      if (!validParentTypes.includes(parentNodeType)) {
        throw new BadRequestException('Invalid parent node type');
      }

      const evidence = await this.evidenceService.getEvidenceForNode(
        parentNodeId,
        parentNodeType as 'StatementNode' | 'AnswerNode' | 'QuantityNode',
      );

      return { evidence, count: evidence.length };
    } catch (error) {
      this.handleError(
        error,
        `Error getting evidence for parent: ${parentNodeId}`,
      );
    }
  }

  @Get('top-rated')
  async getTopRatedEvidence(
    @Query('limit') limit?: number,
    @Query('evidenceType') evidenceType?: EvidenceType,
  ) {
    try {
      const evidence = await this.evidenceService.getTopRatedEvidence({
        limit: limit ? Number(limit) : 20,
        evidenceType,
      });

      return { evidence, count: evidence.length };
    } catch (error) {
      this.handleError(error, 'Error getting top-rated evidence');
    }
  }

  @Get('search')
  async searchEvidence(
    @Query('evidenceType') evidenceType?: EvidenceType,
    @Query('minOverallScore') minOverallScore?: number,
    @Query('minInclusionVotes') minInclusionVotes?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      const evidence = await this.evidenceService.searchEvidence({
        evidenceType,
        minOverallScore: minOverallScore ? Number(minOverallScore) : undefined,
        minInclusionVotes: minInclusionVotes
          ? Number(minInclusionVotes)
          : undefined,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
      });

      return { evidence, count: evidence.length };
    } catch (error) {
      this.handleError(error, 'Error searching evidence');
    }
  }

  @Get(':id/categories')
  async getCategories(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const categories = await this.evidenceService.getEvidenceCategories(id);
      return { categories };
    } catch (error) {
      this.handleError(error, `Error getting categories for evidence: ${id}`);
    }
  }

  @Get(':id/related')
  async getRelatedEvidence(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const related = await this.evidenceService.discoverRelatedEvidence(id);
      return related;
    } catch (error) {
      this.handleError(error, `Error getting related evidence for: ${id}`);
    }
  }

  @Get(':id/discussion')
  async getDiscussion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const evidence = await this.evidenceService.getEvidenceWithDiscussion(id);
      return { discussionId: evidence.discussionId };
    } catch (error) {
      this.handleError(error, `Error getting discussion for evidence: ${id}`);
    }
  }

  @Get(':id/comments')
  async getComments(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      return await this.evidenceService.getEvidenceComments(id);
    } catch (error) {
      this.handleError(error, `Error getting comments for evidence: ${id}`);
    }
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @Param('id') id: string,
    @Body() commentData: AddCommentDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      const comment = await this.evidenceService.addEvidenceComment(
        id,
        commentData,
        req.user.sub,
      );

      return comment;
    } catch (error) {
      this.handleError(error, `Error adding comment to evidence: ${id}`);
    }
  }

  @Get(':id/approved')
  async isApproved(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Evidence ID is required');
      }

      const approved = await this.evidenceService.isEvidenceApproved(id);
      return { approved };
    } catch (error) {
      this.handleError(error, `Error checking approval status: ${id}`);
    }
  }

  @Get('stats')
  async getStats() {
    try {
      return await this.evidenceService.checkEvidenceStats();
    } catch (error) {
      this.handleError(error, 'Error getting evidence statistics');
    }
  }

  private isValidScore(score: number): boolean {
    return (
      typeof score === 'number' &&
      Number.isInteger(score) &&
      score >= 1 &&
      score <= 5
    );
  }

  private handleError(error: any, context: string): never {
    this.logger.error(`${context}: ${error.message}`, error.stack);

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message || 'Internal server error',
        context,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
