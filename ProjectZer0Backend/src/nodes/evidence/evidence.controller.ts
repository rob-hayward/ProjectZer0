// src/nodes/evidence/evidence.controller.ts - REFACTORED TO SCHEMA ARCHITECTURE

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EvidenceService } from './evidence.service';
import type { VoteResult } from '../../neo4j/schemas/vote.schema';

/**
 * EvidenceController - HTTP endpoints for evidence operations
 *
 * ARCHITECTURE:
 * - Handles HTTP request/response
 * - Extracts user from JWT token
 * - Validates request data
 * - Delegates business logic to EvidenceService
 *
 * ENDPOINTS:
 * - CRUD: POST /, GET /:id, PUT /:id, DELETE /:id
 * - Voting (Inclusion Only): POST /:id/vote-inclusion, GET /:id/vote-status, DELETE /:id/vote, GET /:id/votes
 * - Peer Review: POST /:id/reviews, GET /:id/reviews/stats, GET /:id/reviews/mine, GET /:id/reviews/allowed
 * - Utility: GET /:id/approved, GET /parent/:parentNodeId
 */

// ============================================
// DTOs
// ============================================

interface CreateEvidenceDto {
  title: string;
  url: string;
  authors?: string[];
  publicationDate?: string;
  evidenceType:
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
  parentNodeId: string;
  parentNodeType: 'StatementNode' | 'AnswerNode' | 'QuantityNode';
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
  userKeywords?: string[];
}

interface SubmitPeerReviewDto {
  qualityScore: number;
  independenceScore: number;
  relevanceScore: number;
  comments?: string;
}

interface VoteDto {
  isPositive: boolean;
}

@Controller('nodes/evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  private readonly logger = new Logger(EvidenceController.name);

  constructor(private readonly evidenceService: EvidenceService) {}

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  /**
   * Create a new evidence node
   * POST /nodes/evidence
   */
  @Post()
  async createEvidence(
    @Body() createDto: CreateEvidenceDto,
    @Request() req: any,
  ) {
    // Validate required fields
    if (!createDto.title || createDto.title.trim() === '') {
      throw new BadRequestException('Evidence title is required');
    }

    if (!createDto.url || createDto.url.trim() === '') {
      throw new BadRequestException('Evidence URL is required');
    }

    if (!createDto.parentNodeId || createDto.parentNodeId.trim() === '') {
      throw new BadRequestException('Parent node ID is required');
    }

    if (!createDto.parentNodeType) {
      throw new BadRequestException('Parent node type is required');
    }

    if (!createDto.evidenceType) {
      throw new BadRequestException('Evidence type is required');
    }

    if (typeof createDto.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (createDto.categoryIds && createDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    // Parse publication date if provided
    let publicationDate: Date | undefined;
    if (createDto.publicationDate) {
      publicationDate = new Date(createDto.publicationDate);
      if (isNaN(publicationDate.getTime())) {
        throw new BadRequestException('Invalid publication date format');
      }
    }

    this.logger.log(
      `Creating evidence: ${createDto.title.substring(0, 50)}...`,
    );

    const result = await this.evidenceService.createEvidence({
      ...createDto,
      publicationDate,
      createdBy: req.user.sub,
    });

    this.logger.log(`Successfully created evidence: ${result.id}`);
    return result;
  }

  /**
   * Get an evidence node by ID
   * GET /nodes/evidence/:id
   */
  @Get(':id')
  async getEvidence(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Getting evidence: ${id}`);

    const evidence = await this.evidenceService.getEvidence(id);

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${id} not found`);
    }

    return evidence;
  }

  /**
   * Update an evidence node
   * PUT /nodes/evidence/:id
   */
  @Put(':id')
  async updateEvidence(
    @Param('id') id: string,
    @Body() updateDto: UpdateEvidenceDto,
    @Request() req: any,
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (updateDto.categoryIds && updateDto.categoryIds.length > 3) {
      throw new BadRequestException('Maximum 3 categories allowed');
    }

    // Parse publication date if provided
    const updateData: any = updateDto.publicationDate
      ? (() => {
          const publicationDate = new Date(updateDto.publicationDate);
          if (isNaN(publicationDate.getTime())) {
            throw new BadRequestException('Invalid publication date format');
          }
          return { ...updateDto, publicationDate };
        })()
      : updateDto;

    this.logger.log(`Updating evidence: ${id}`);

    const result = await this.evidenceService.updateEvidence(id, updateData);

    this.logger.log(`Successfully updated evidence: ${id}`);
    return result;
  }

  /**
   * Delete an evidence node
   * DELETE /nodes/evidence/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvidence(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Deleting evidence: ${id}`);

    await this.evidenceService.deleteEvidence(id, req.user.sub);

    this.logger.log(`Successfully deleted evidence: ${id}`);
  }

  // ============================================
  // VOTING ENDPOINTS - INCLUSION ONLY
  // ============================================

  /**
   * Vote on evidence inclusion
   * POST /nodes/evidence/:id/vote-inclusion
   */
  @Post(':id/vote')
  async voteInclusion(
    @Param('id') id: string,
    @Body() voteDto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    if (typeof voteDto.isPositive !== 'boolean') {
      throw new BadRequestException('isPositive must be a boolean');
    }

    this.logger.log(
      `Processing inclusion vote on evidence ${id}: ${voteDto.isPositive ? 'positive' : 'negative'}`,
    );

    const result = await this.evidenceService.voteInclusion(
      id,
      req.user.sub,
      voteDto.isPositive,
    );

    return result;
  }

  /**
   * Get vote status for current user
   * GET /nodes/evidence/:id/vote-status
   */
  @Get(':id/vote-status')
  async getVoteStatus(@Param('id') id: string, @Request() req: any) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting vote status for evidence ${id}, user ${req.user.sub}`,
    );

    const status = await this.evidenceService.getVoteStatus(id, req.user.sub);

    return status;
  }

  /**
   * Remove vote from evidence
   * DELETE /nodes/evidence/:id/vote
   */
  @Delete(':id/vote')
  async removeVote(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Removing vote from evidence: ${id}`);

    const result = await this.evidenceService.removeVote(id, req.user.sub);

    return result;
  }

  /**
   * Get vote totals for evidence
   * GET /nodes/evidence/:id/votes
   */
  @Get(':id/votes')
  async getVotes(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Getting votes for evidence: ${id}`);

    const votes = await this.evidenceService.getVotes(id);

    return votes;
  }

  // ============================================
  // PEER REVIEW ENDPOINTS
  // ============================================

  /**
   * Submit a peer review for evidence
   * POST /nodes/evidence/:id/reviews
   */
  @Post(':id/reviews')
  async submitPeerReview(
    @Param('id') evidenceId: string,
    @Body() reviewDto: SubmitPeerReviewDto,
    @Request() req: any,
  ) {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    // Validate scores
    if (
      typeof reviewDto.qualityScore !== 'number' ||
      reviewDto.qualityScore < 1 ||
      reviewDto.qualityScore > 5 ||
      !Number.isInteger(reviewDto.qualityScore)
    ) {
      throw new BadRequestException(
        'Quality score must be an integer between 1 and 5',
      );
    }

    if (
      typeof reviewDto.independenceScore !== 'number' ||
      reviewDto.independenceScore < 1 ||
      reviewDto.independenceScore > 5 ||
      !Number.isInteger(reviewDto.independenceScore)
    ) {
      throw new BadRequestException(
        'Independence score must be an integer between 1 and 5',
      );
    }

    if (
      typeof reviewDto.relevanceScore !== 'number' ||
      reviewDto.relevanceScore < 1 ||
      reviewDto.relevanceScore > 5 ||
      !Number.isInteger(reviewDto.relevanceScore)
    ) {
      throw new BadRequestException(
        'Relevance score must be an integer between 1 and 5',
      );
    }

    this.logger.log(
      `Submitting peer review for evidence ${evidenceId} by user ${req.user.sub}`,
    );

    const result = await this.evidenceService.submitPeerReview({
      evidenceId,
      userId: req.user.sub,
      ...reviewDto,
    });

    return result;
  }

  /**
   * Get peer review statistics for evidence
   * GET /nodes/evidence/:id/reviews/stats
   */
  @Get(':id/reviews/stats')
  async getPeerReviewStats(@Param('id') evidenceId: string) {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Getting peer review stats for evidence: ${evidenceId}`);

    const stats = await this.evidenceService.getPeerReviewStats(evidenceId);

    return stats;
  }

  /**
   * Get current user's peer review for evidence
   * GET /nodes/evidence/:id/reviews/mine
   */
  @Get(':id/reviews/mine')
  async getMyPeerReview(@Param('id') evidenceId: string, @Request() req: any) {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    if (!req.user?.sub) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(
      `Getting peer review for evidence ${evidenceId}, user ${req.user.sub}`,
    );

    const review = await this.evidenceService.getUserPeerReview(
      evidenceId,
      req.user.sub,
    );

    return review || { hasReviewed: false };
  }

  /**
   * Check if peer review is allowed for evidence
   * GET /nodes/evidence/:id/reviews/allowed
   */
  @Get(':id/reviews/allowed')
  async isPeerReviewAllowed(@Param('id') evidenceId: string) {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(
      `Checking peer review availability for evidence: ${evidenceId}`,
    );

    const allowed = await this.evidenceService.isPeerReviewAllowed(evidenceId);

    return { allowed };
  }

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Check if evidence has passed inclusion threshold
   * GET /nodes/evidence/:id/approved
   */
  @Get(':id/approved')
  async isEvidenceApproved(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Evidence ID is required');
    }

    this.logger.debug(`Checking approval status for evidence: ${id}`);

    const isApproved = await this.evidenceService.isEvidenceApproved(id);

    return { approved: isApproved };
  }

  /**
   * Get evidence for a specific parent node
   * GET /nodes/evidence/parent/:parentNodeId
   */
  @Get('parent/:parentNodeId')
  async getEvidenceForParent(
    @Param('parentNodeId') parentNodeId: string,
    @Query('parentNodeType') parentNodeType?: string,
  ) {
    if (!parentNodeId || parentNodeId.trim() === '') {
      throw new BadRequestException('Parent node ID is required');
    }

    if (!parentNodeType) {
      throw new BadRequestException('Parent node type is required');
    }

    const validTypes = ['StatementNode', 'AnswerNode', 'QuantityNode'];
    if (!validTypes.includes(parentNodeType)) {
      throw new BadRequestException(
        'Parent node type must be StatementNode, AnswerNode, or QuantityNode',
      );
    }

    this.logger.debug(
      `Getting evidence for ${parentNodeType}: ${parentNodeId}`,
    );

    const evidence = await this.evidenceService.getEvidenceForNode(
      parentNodeId,
      parentNodeType as 'StatementNode' | 'AnswerNode' | 'QuantityNode',
    );

    return {
      evidence,
      count: evidence.length,
    };
  }
}
