// src/nodes/discussion/discussion.controller.ts - FIXED SIMPLIFIED CONTAINER PATTERN

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DiscussionService } from './discussion.service';

@Controller('discussions')
@UseGuards(JwtAuthGuard)
export class DiscussionController {
  private readonly logger = new Logger(DiscussionController.name);

  constructor(private readonly discussionService: DiscussionService) {}

  @Post()
  async createDiscussion(
    @Body()
    discussionData: {
      createdBy: string;
      associatedNodeId: string;
      associatedNodeType: string;
      initialComment?: string;
    },
  ) {
    if (!discussionData.createdBy) {
      throw new BadRequestException('createdBy is required');
    }

    if (!discussionData.associatedNodeId) {
      throw new BadRequestException('associatedNodeId is required');
    }

    if (!discussionData.associatedNodeType) {
      throw new BadRequestException('associatedNodeType is required');
    }

    this.logger.debug(
      `Creating discussion for ${discussionData.associatedNodeType}: ${discussionData.associatedNodeId}`,
    );

    return this.discussionService.createDiscussion(discussionData);
  }

  @Get(':id')
  async getDiscussion(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion: ${id}`);
    const discussion = await this.discussionService.getDiscussion(id);

    if (!discussion) {
      throw new NotFoundException(`Discussion with ID ${id} not found`);
    }

    return discussion;
  }

  @Put(':id')
  async updateDiscussion(@Param('id') id: string, @Body() updateData: any) {
    // ✅ FIXED: Removed unused 'req' parameter
    if (!id) {
      throw new BadRequestException('Discussion ID is required');
    }

    // Basic validation - only allow certain fields to be updated
    const allowedFields = ['updatedAt']; // Discussions have minimal updateable fields
    const filteredData = Object.keys(updateData)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {} as any);

    this.logger.debug(`Updating discussion: ${id}`);
    return this.discussionService.updateDiscussion(id, filteredData);
  }

  @Delete(':id')
  async deleteDiscussion(@Param('id') id: string, @Request() req: any) {
    if (!id) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Deleting discussion: ${id}`);

    // Verify discussion exists first
    const discussion = await this.discussionService.getDiscussion(id);
    if (!discussion) {
      throw new NotFoundException(`Discussion with ID ${id} not found`);
    }

    // Only creator can delete (or admin - could add role check here)
    if (discussion.createdBy !== req.user.sub) {
      throw new HttpException(
        'Only the discussion creator can delete it',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.discussionService.deleteDiscussion(id);
  }

  // ✅ NEW: Get discussion with all comments included
  @Get(':id/with-comments')
  async getDiscussionWithComments(@Param('id') id: string) {
    // ✅ FIXED: Removed unused 'req' parameter
    if (!id) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion with comments: ${id}`);
    return this.discussionService.getDiscussionWithComments(id);
  }

  // ✅ NEW: Get discussions by associated node
  @Get('by-node/:nodeType/:nodeId')
  async getDiscussionsByNode(
    @Param('nodeType') nodeType: string,
    @Param('nodeId') nodeId: string,
  ) {
    if (!nodeType) {
      throw new BadRequestException('Node type is required');
    }

    if (!nodeId) {
      throw new BadRequestException('Node ID is required');
    }

    this.logger.debug(`Getting discussions for ${nodeType}: ${nodeId}`);
    return this.discussionService.getDiscussionsByAssociatedNode(
      nodeId,
      nodeType,
    );
  }

  // ✅ NEW: Get comment count for discussion
  @Get(':id/comment-count')
  async getDiscussionCommentCount(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comment count for discussion: ${id}`);
    const count = await this.discussionService.getDiscussionCommentCount(id);
    return { count };
  }

  // ❌ REMOVED: All voting endpoints - discussions don't support voting
  // Discussions are simple containers, not votable content
  // Voting happens at the comment level within discussions

  // ❌ REMOVED: All visibility endpoints - discussions don't have user visibility preferences
  // Discussion visibility is determined by the associated node
  // If a word is visible, its discussion is visible
  // User preferences are handled at the comment level, not discussion level

  // ✅ PRESERVED: Simple CRUD operations only
  // - Create: Associate discussion with a node
  // - Read: Get discussion data and comments
  // - Update: Minimal updates (mainly timestamps)
  // - Delete: Remove discussion and cascade to comments
}
