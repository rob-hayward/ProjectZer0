import { Injectable } from '@nestjs/common';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommentService {
  constructor(private readonly commentSchema: CommentSchema) {}

  async createComment(commentData: {
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }) {
    const commentWithId = {
      ...commentData,
      id: uuidv4(),
    };
    return this.commentSchema.createComment(commentWithId);
  }

  async getComment(id: string) {
    return this.commentSchema.getComment(id);
  }

  async updateComment(id: string, updateData: { commentText: string }) {
    return this.commentSchema.updateComment(id, updateData);
  }

  async deleteComment(id: string) {
    return this.commentSchema.deleteComment(id);
  }

  async getCommentsByDiscussionId(discussionId: string) {
    return this.commentSchema.getCommentsByDiscussionId(discussionId);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    return this.commentSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    return this.commentSchema.getVisibilityStatus(id);
  }
}
