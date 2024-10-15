import { Injectable } from '@nestjs/common';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DiscussionService {
  constructor(
    private readonly discussionSchema: DiscussionSchema,
    private readonly commentService: CommentService,
  ) {}

  async createDiscussion(discussionData: {
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
    initialComment?: string;
  }) {
    const discussionWithId = {
      ...discussionData,
      id: uuidv4(),
    };
    const createdDiscussion =
      await this.discussionSchema.createDiscussion(discussionWithId);

    if (discussionData.initialComment) {
      await this.commentService.createComment({
        createdBy: discussionData.createdBy,
        discussionId: createdDiscussion.id,
        commentText: discussionData.initialComment,
      });
    }

    return createdDiscussion;
  }

  async getDiscussion(id: string) {
    return this.discussionSchema.getDiscussion(id);
  }

  async updateDiscussion(id: string, updateData: any) {
    return this.discussionSchema.updateDiscussion(id, updateData);
  }

  async deleteDiscussion(id: string) {
    return this.discussionSchema.deleteDiscussion(id);
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    return this.discussionSchema.setVisibilityStatus(id, isVisible);
  }

  async getVisibilityStatus(id: string) {
    return this.discussionSchema.getVisibilityStatus(id);
  }
}
