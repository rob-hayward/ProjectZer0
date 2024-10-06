import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CommentService } from './comment.service';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  async createComment(
    @Body()
    commentData: {
      createdBy: string;
      discussionId: string;
      commentText: string;
    },
  ) {
    return this.commentService.createComment(commentData);
  }

  @Get(':id')
  async getComment(@Param('id') id: string) {
    return this.commentService.getComment(id);
  }

  @Put(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateData: { commentText: string },
  ) {
    return this.commentService.updateComment(id, updateData);
  }

  @Delete(':id')
  async deleteComment(@Param('id') id: string) {
    return this.commentService.deleteComment(id);
  }
}
