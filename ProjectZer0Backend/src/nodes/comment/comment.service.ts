import { Injectable, Logger } from '@nestjs/common';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(private readonly commentSchema: CommentSchema) {}

  async createComment(commentData: {
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }) {
    this.logger.log(
      `Creating comment: ${JSON.stringify(commentData, null, 2)}`,
    );
    const commentWithId = {
      ...commentData,
      id: uuidv4(),
    };
    const createdComment =
      await this.commentSchema.createComment(commentWithId);
    this.logger.log(
      `Created comment: ${JSON.stringify(createdComment, null, 2)}`,
    );
    return createdComment;
  }

  async getComment(id: string) {
    this.logger.log(`Getting comment: ${id}`);
    const comment = await this.commentSchema.getComment(id);
    this.logger.log(`Retrieved comment: ${JSON.stringify(comment, null, 2)}`);
    return comment;
  }

  async updateComment(id: string, updateData: { commentText: string }) {
    this.logger.log(
      `Updating comment ${id}: ${JSON.stringify(updateData, null, 2)}`,
    );
    const updatedComment = await this.commentSchema.updateComment(
      id,
      updateData,
    );
    this.logger.log(
      `Updated comment: ${JSON.stringify(updatedComment, null, 2)}`,
    );
    return updatedComment;
  }

  async deleteComment(id: string) {
    this.logger.log(`Deleting comment: ${id}`);
    await this.commentSchema.deleteComment(id);
    this.logger.log(`Deleted comment: ${id}`);
  }

  async getCommentsByDiscussionId(discussionId: string) {
    this.logger.log(`Getting comments for discussion: ${discussionId}`);
    const comments =
      await this.commentSchema.getCommentsByDiscussionId(discussionId);
    this.logger.log(
      `Retrieved ${comments.length} comments for discussion ${discussionId}`,
    );
    return comments;
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    this.logger.log(
      `Setting visibility status for comment ${id}: ${isVisible}`,
    );
    const updatedComment = await this.commentSchema.setVisibilityStatus(
      id,
      isVisible,
    );
    this.logger.log(
      `Updated comment visibility: ${JSON.stringify(updatedComment, null, 2)}`,
    );
    return updatedComment;
  }

  async getVisibilityStatus(id: string) {
    this.logger.log(`Getting visibility status for comment: ${id}`);
    const status = await this.commentSchema.getVisibilityStatus(id);
    this.logger.log(`Visibility status for comment ${id}: ${status}`);
    return status;
  }
}
