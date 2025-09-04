// src/nodes/quantity/quantity.controller.ts

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
import { QuantityService } from './quantity.service';
import type { VoteResult } from '../../neo4j/schemas/vote.schema';

// Define DTOs for better type safety - Following consistent patterns
interface CreateQuantityNodeDto {
  question: string;
  unitCategoryId: string;
  defaultUnitId: string;
  publicCredit: boolean;
  categoryIds?: string[]; // 0-3 categories
  userKeywords?: string[];
  initialComment?: string;
}

interface UpdateQuantityNodeDto {
  question?: string;
  unitCategoryId?: string;
  defaultUnitId?: string;
  publicCredit?: boolean;
  userKeywords?: string[];
}

interface VoteQuantityDto {
  isPositive: boolean;
}

interface RemoveVoteDto {
  kind?: 'INCLUSION' | 'CONTENT';
}

interface VisibilityDto {
  isVisible: boolean;
}

interface SubmitResponseDto {
  value: number;
  unitId: string;
}

interface AddCommentDto {
  commentText: string;
  parentCommentId?: string;
}

@Controller('nodes/quantity')
@UseGuards(JwtAuthGuard)
export class QuantityController {
  private readonly logger = new Logger(QuantityController.name);

  constructor(private readonly quantityService: QuantityService) {}

  // CRUD OPERATIONS - Following consistent patterns

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuantityNode(
    @Body() nodeData: CreateQuantityNodeDto,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Creating quantity node from user ${req.user.sub}`);

      // Validate required fields
      if (!nodeData.question || nodeData.question.trim() === '') {
        throw new BadRequestException('Question text is required');
      }

      if (!nodeData.unitCategoryId || nodeData.unitCategoryId.trim() === '') {
        throw new BadRequestException('Unit category ID is required');
      }

      if (!nodeData.defaultUnitId || nodeData.defaultUnitId.trim() === '') {
        throw new BadRequestException('Default unit ID is required');
      }

      if (typeof nodeData.publicCredit !== 'boolean') {
        throw new BadRequestException('Public credit flag is required');
      }

      const result = await this.quantityService.createQuantityNode({
        ...nodeData,
        createdBy: req.user.sub, // Use authenticated user ID from JWT
      });

      this.logger.log(
        `Successfully created quantity node with ID: ${result.id}`,
      );
      return result;
    } catch (error) {
      this.handleError(error, `Error creating quantity node`);
    }
  }

  @Get(':id')
  async getQuantityNode(
    @Param('id') id: string,
    @Query('includeDiscussion') includeDiscussion?: string,
    @Query('includeStatistics') includeStatistics?: string,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Retrieving quantity node: ${id}`);

      const options = {
        includeDiscussion: includeDiscussion === 'true',
        includeStatistics: includeStatistics === 'true',
      };

      const quantityNode = await this.quantityService.getQuantityNode(
        id,
        options,
      );

      this.logger.debug(
        `Retrieved quantity node: ${quantityNode.question.substring(0, 50)}...`,
      );
      return quantityNode;
    } catch (error) {
      this.handleError(error, `Error retrieving quantity node: ${id}`);
    }
  }

  @Put(':id')
  async updateQuantityNode(
    @Param('id') id: string,
    @Body() updateData: UpdateQuantityNodeDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Updating quantity node: ${id}`);

      const result = await this.quantityService.updateQuantityNode(
        id,
        updateData,
      );

      this.logger.log(`Successfully updated quantity node: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `Error updating quantity node: ${id}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuantityNode(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Deleting quantity node: ${id}`);

      await this.quantityService.deleteQuantityNode(id);

      this.logger.log(`Successfully deleted quantity node: ${id}`);
    } catch (error) {
      this.handleError(error, `Error deleting quantity node: ${id}`);
    }
  }

  // VOTING ENDPOINTS - DUAL VOTING (INCLUSION + CONTENT)

  @Post(':id/vote/inclusion')
  async voteQuantityInclusion(
    @Param('id') id: string,
    @Body() voteData: VoteQuantityDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing inclusion vote on quantity node ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.quantityService.voteQuantityInclusion(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on quantity node inclusion: ${id}`);
    }
  }

  @Post(':id/vote/content')
  async voteQuantityContent(
    @Param('id') id: string,
    @Body() voteData: VoteQuantityDto,
    @Request() req: any,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (typeof voteData.isPositive !== 'boolean') {
        throw new BadRequestException(
          'Vote direction (isPositive) is required',
        );
      }

      this.logger.log(
        `Processing content vote on quantity node ${id}: ${voteData.isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.quantityService.voteQuantityContent(
        id,
        req.user.sub,
        voteData.isPositive,
      );

      return result;
    } catch (error) {
      this.handleError(error, `Error voting on quantity node content: ${id}`);
    }
  }

  @Get(':id/vote')
  async getQuantityVoteStatus(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting vote status for quantity node: ${id}`);

      const voteStatus = await this.quantityService.getQuantityVoteStatus(
        id,
        req.user.sub,
      );

      return { voteStatus };
    } catch (error) {
      this.handleError(
        error,
        `Error getting vote status for quantity node: ${id}`,
      );
    }
  }

  @Delete(':id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeQuantityVote(
    @Param('id') id: string,
    @Body() removeVoteData: RemoveVoteDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      const kind = removeVoteData.kind || 'INCLUSION';
      this.logger.log(`Removing ${kind} vote from quantity node: ${id}`);

      await this.quantityService.removeQuantityVote(id, req.user.sub, kind);
    } catch (error) {
      this.handleError(error, `Error removing vote from quantity node: ${id}`);
    }
  }

  @Get(':id/votes')
  async getQuantityVotes(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting vote counts for quantity node: ${id}`);

      const votes = await this.quantityService.getQuantityVotes(id);

      return { votes };
    } catch (error) {
      this.handleError(error, `Error getting votes for quantity node: ${id}`);
    }
  }

  // VISIBILITY ENDPOINTS - Following consistent patterns

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: VisibilityDto,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (typeof visibilityData.isVisible !== 'boolean') {
        throw new BadRequestException(
          'Visibility status (isVisible) is required',
        );
      }

      this.logger.log(
        `Setting visibility for quantity node ${id} to ${visibilityData.isVisible}`,
      );

      const result = await this.quantityService.setVisibilityStatus(
        id,
        visibilityData.isVisible,
      );

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error setting visibility for quantity node: ${id}`,
      );
    }
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting visibility status for quantity node: ${id}`);

      const status = await this.quantityService.getVisibilityStatus(id);

      return { visibilityStatus: status };
    } catch (error) {
      this.handleError(
        error,
        `Error getting visibility status for quantity node: ${id}`,
      );
    }
  }

  // NEW: DISCOVERY ENDPOINTS - Following established patterns

  @Get(':id/related')
  async getRelatedContentBySharedCategories(
    @Param('id') id: string,
    @Query('nodeTypes') nodeTypes?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy')
    sortBy:
      | 'category_overlap'
      | 'created'
      | 'inclusion_votes'
      | 'content_votes' = 'category_overlap',
    @Query('sortDirection') sortDirection: 'asc' | 'desc' = 'desc',
    @Query('excludeSelf') excludeSelf?: string,
    @Query('minCategoryOverlap') minCategoryOverlap?: number,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting related content for quantity node: ${id}`);

      const options = {
        nodeTypes: nodeTypes
          ? (nodeTypes.split(',') as (
              | 'statement'
              | 'answer'
              | 'openquestion'
              | 'quantity'
            )[])
          : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : 0,
        sortBy,
        sortDirection,
        excludeSelf: excludeSelf === 'true',
        minCategoryOverlap: minCategoryOverlap
          ? Number(minCategoryOverlap)
          : undefined,
      };

      const relatedContent =
        await this.quantityService.getRelatedContentBySharedCategories(
          id,
          options,
        );

      return { relatedContent };
    } catch (error) {
      this.handleError(
        error,
        `Error getting related content for quantity node: ${id}`,
      );
    }
  }

  @Get(':id/categories')
  async getQuantityNodeCategories(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting categories for quantity node: ${id}`);

      const categories =
        await this.quantityService.getQuantityNodeCategories(id);

      return { categories };
    } catch (error) {
      this.handleError(
        error,
        `Error getting categories for quantity node: ${id}`,
      );
    }
  }

  // RESPONSE MANAGEMENT ENDPOINTS

  @Post(':id/response')
  async submitResponse(
    @Param('id') id: string,
    @Body() responseData: SubmitResponseDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (responseData.value === undefined || isNaN(responseData.value)) {
        throw new BadRequestException('Response value must be a valid number');
      }

      if (!responseData.unitId || responseData.unitId.trim() === '') {
        throw new BadRequestException('Unit ID is required');
      }

      this.logger.log(`Submitting response to quantity node: ${id}`);

      const result = await this.quantityService.submitResponse({
        userId: req.user.sub,
        quantityNodeId: id,
        value: responseData.value,
        unitId: responseData.unitId,
      });

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error submitting response to quantity node: ${id}`,
      );
    }
  }

  @Get(':id/response')
  async getUserResponse(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting user response for quantity node: ${id}`);

      const response = await this.quantityService.getUserResponse(
        req.user.sub,
        id,
      );

      return response;
    } catch (error) {
      this.handleError(
        error,
        `Error getting user response for quantity node: ${id}`,
      );
    }
  }

  @Delete(':id/response')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUserResponse(@Param('id') id: string, @Request() req: any) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Deleting user response for quantity node: ${id}`);

      await this.quantityService.deleteUserResponse(req.user.sub, id);
    } catch (error) {
      this.handleError(
        error,
        `Error deleting user response for quantity node: ${id}`,
      );
    }
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting statistics for quantity node: ${id}`);

      const statistics = await this.quantityService.getStatistics(id);

      return statistics;
    } catch (error) {
      this.handleError(
        error,
        `Error getting statistics for quantity node: ${id}`,
      );
    }
  }

  // DISCUSSION AND COMMENT ENDPOINTS - Following consistent patterns

  @Get(':id/discussion')
  async getQuantityNodeWithDiscussion(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Getting quantity node with discussion: ${id}`);

      const quantityNode =
        await this.quantityService.getQuantityNodeWithDiscussion(id);

      return quantityNode;
    } catch (error) {
      this.handleError(
        error,
        `Error retrieving quantity node with discussion: ${id}`,
      );
    }
  }

  @Get(':id/comments')
  async getQuantityNodeComments(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.log(`Getting comments for quantity node: ${id}`);

      const result = await this.quantityService.getQuantityNodeComments(id);

      return result;
    } catch (error) {
      this.handleError(
        error,
        `Error retrieving comments for quantity node: ${id}`,
      );
    }
  }

  @Post(':id/comments')
  async addQuantityNodeComment(
    @Param('id') id: string,
    @Body() commentData: AddCommentDto,
    @Request() req: any,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(`Adding comment to quantity node: ${id}`);

      const comment = await this.quantityService.addQuantityNodeComment(
        id,
        commentData,
        req.user.sub,
      );

      return comment;
    } catch (error) {
      this.handleError(error, `Error adding comment to quantity node: ${id}`);
    }
  }

  // UTILITY ENDPOINTS

  @Get(':id/approved')
  async isQuantityNodeApproved(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Checking approval status for quantity node: ${id}`);

      const isApproved = await this.quantityService.isQuantityNodeApproved(id);

      return { isApproved };
    } catch (error) {
      this.handleError(
        error,
        `Error checking approval for quantity node: ${id}`,
      );
    }
  }

  @Get(':id/content-voting')
  async isContentVotingAvailable(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(
        `Checking content voting availability for quantity node: ${id}`,
      );

      const isAvailable =
        await this.quantityService.isContentVotingAvailable(id);

      return { contentVotingAvailable: isAvailable };
    } catch (error) {
      this.handleError(
        error,
        `Error checking content voting availability for quantity node: ${id}`,
      );
    }
  }

  @Get(':id/numeric-response')
  async isNumericResponseAllowed(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(
        `Checking numeric response availability for quantity node: ${id}`,
      );

      const isAllowed = await this.quantityService.isNumericResponseAllowed(id);

      return { numericResponseAllowed: isAllowed };
    } catch (error) {
      this.handleError(
        error,
        `Error checking numeric response availability for quantity node: ${id}`,
      );
    }
  }

  @Get(':id/stats')
  async getQuantityNodeStats(@Param('id') id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Quantity node ID is required');
      }

      this.logger.debug(`Getting quantity node stats for: ${id}`);

      const stats = await this.quantityService.getQuantityNodeStats(id);

      return stats;
    } catch (error) {
      this.handleError(error, `Error getting quantity node stats: ${id}`);
    }
  }

  // PRIVATE HELPER METHODS

  /**
   * Centralized error handling
   */
  private handleError(error: any, context: string): never {
    this.logger.error(`${context}: ${error.message}`, error.stack);

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    // Log the full error for debugging while throwing a generic message
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An internal server error occurred',
        error: 'Internal Server Error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
