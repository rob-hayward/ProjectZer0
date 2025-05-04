// src/nodes/quantity/quantity.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  Request,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { QuantityService } from './quantity.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';

@Controller('nodes/quantity')
@UseGuards(JwtAuthGuard)
export class QuantityController {
  private readonly logger = new Logger(QuantityController.name);

  constructor(
    private readonly quantityService: QuantityService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuantityNode(@Body() nodeData: any, @Request() req: any) {
    this.logger.log(
      `Received request to create quantity node from user ${req.user.sub}`,
    );

    // Validate required fields
    if (!nodeData.question || nodeData.question.trim() === '') {
      throw new BadRequestException('Question text is required');
    }

    if (!nodeData.unitCategoryId) {
      throw new BadRequestException('Unit category ID is required');
    }

    if (!nodeData.defaultUnitId) {
      throw new BadRequestException('Default unit ID is required');
    }

    if (typeof nodeData.publicCredit !== 'boolean') {
      throw new BadRequestException('publicCredit must be a boolean value');
    }

    return this.quantityService.createQuantityNode({
      ...nodeData,
      createdBy: req.user.sub, // Use the authenticated user's ID from JWT
    });
  }

  @Get(':id')
  async getQuantityNode(@Param('id') id: string) {
    this.logger.debug(`Received request to get quantity node ${id}`);

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    return this.quantityService.getQuantityNode(id);
  }

  @Put(':id')
  async updateQuantityNode(@Param('id') id: string, @Body() updateData: any) {
    this.logger.log(`Received request to update quantity node ${id}`);

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    return this.quantityService.updateQuantityNode(id, updateData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuantityNode(@Param('id') id: string) {
    this.logger.log(`Received request to delete quantity node ${id}`);

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    return this.quantityService.deleteQuantityNode(id);
  }

  @Put(':id/visibility')
  async setVisibilityStatus(
    @Param('id') id: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    this.logger.log(
      `Received request to set visibility for quantity node ${id}: ${visibilityData.isVisible}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (typeof visibilityData.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean value');
    }

    return this.quantityService.setVisibilityStatus(
      id,
      visibilityData.isVisible,
    );
  }

  @Get(':id/visibility')
  async getVisibilityStatus(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get visibility status for quantity node ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    return this.quantityService.getVisibilityStatus(id);
  }

  @Post(':id/response')
  async submitResponse(
    @Param('id') id: string,
    @Body() responseData: { value: number; unitId: string },
    @Request() req: any,
  ) {
    this.logger.log(
      `Received request to submit response to quantity node ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (responseData.value === undefined || isNaN(responseData.value)) {
      throw new BadRequestException('Response value must be a valid number');
    }

    if (!responseData.unitId) {
      throw new BadRequestException('Unit ID is required');
    }

    return this.quantityService.submitResponse({
      userId: req.user.sub,
      quantityNodeId: id,
      value: responseData.value,
      unitId: responseData.unitId,
    });
  }

  @Get(':id/response')
  async getUserResponse(@Param('id') id: string, @Request() req: any) {
    this.logger.debug(
      `Received request to get user response for quantity node ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    return this.quantityService.getUserResponse(req.user.sub, id);
  }

  @Delete(':id/response')
  async deleteUserResponse(@Param('id') id: string, @Request() req: any) {
    this.logger.log(
      `Received request to delete user response for quantity node ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    return this.quantityService.deleteUserResponse(req.user.sub, id);
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get statistics for quantity node ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    return this.quantityService.getStatistics(id);
  }

  // New endpoints for discussions and comments
  @Get(':id/discussion')
  async getQuantityNodeWithDiscussion(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get quantity node ${id} with discussion`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    const quantityNode = await this.quantityService.getQuantityNode(id);

    if (!quantityNode) {
      throw new NotFoundException(`Quantity node with ID ${id} not found`);
    }

    return quantityNode; // The getQuantityNode method already includes discussion info
  }

  @Get(':id/comments')
  async getQuantityNodeComments(@Param('id') id: string) {
    this.logger.debug(
      `Received request to get comments for quantity node ${id}`,
    );

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    const quantityNode = await this.quantityService.getQuantityNode(id);

    if (!quantityNode) {
      throw new NotFoundException(`Quantity node with ID ${id} not found`);
    }

    if (!quantityNode.discussionId) {
      return { comments: [] };
    }

    const comments = await this.commentService.getCommentsByDiscussionId(
      quantityNode.discussionId,
    );
    return { comments };
  }

  @Post(':id/comments')
  async addQuantityNodeComment(
    @Param('id') id: string,
    @Body() commentData: { commentText: string; parentCommentId?: string },
    @Request() req: any,
  ) {
    this.logger.log(`Received request to add comment to quantity node ${id}`);

    if (!id) {
      throw new BadRequestException('Quantity node ID is required');
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new BadRequestException('Comment text is required');
    }

    const quantityNode = await this.quantityService.getQuantityNode(id);

    if (!quantityNode) {
      throw new NotFoundException(`Quantity node with ID ${id} not found`);
    }

    // If no discussion exists, create one
    let discussionId = quantityNode.discussionId;

    if (!discussionId) {
      const discussion = await this.discussionService.createDiscussion({
        createdBy: req.user.sub,
        associatedNodeId: id,
        associatedNodeType: 'QuantityNode',
      });

      discussionId = discussion.id;

      // Update quantity node with discussion ID
      await this.quantityService.updateQuantityNode(id, { discussionId });
    }

    // Create the comment
    const comment = await this.commentService.createComment({
      createdBy: req.user.sub,
      discussionId,
      commentText: commentData.commentText,
      parentCommentId: commentData.parentCommentId,
    });

    return comment;
  }
}
