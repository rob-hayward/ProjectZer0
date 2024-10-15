import { Injectable, Logger } from '@nestjs/common';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

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
    this.logger.log(
      `Creating discussion: ${JSON.stringify(discussionData, null, 2)}`,
    );
    const discussionWithId = {
      ...discussionData,
      id: uuidv4(),
    };
    const createdDiscussion =
      await this.discussionSchema.createDiscussion(discussionWithId);
    this.logger.log(
      `Created discussion: ${JSON.stringify(createdDiscussion, null, 2)}`,
    );

    if (discussionData.initialComment) {
      this.logger.log(
        `Creating initial comment for discussion: ${createdDiscussion.id}`,
      );
      try {
        const comment = await this.commentService.createComment({
          createdBy: discussionData.createdBy,
          discussionId: createdDiscussion.id,
          commentText: discussionData.initialComment,
          // Explicitly set parentCommentId to undefined for initial comment
          parentCommentId: undefined,
        });
        this.logger.log(
          `Created initial comment: ${JSON.stringify(comment, null, 2)}`,
        );
      } catch (error) {
        this.logger.error(`Error creating initial comment: ${error.message}`);
        this.logger.error(error.stack);
        throw error; // Re-throw the error to be handled by the calling service
      }
    }

    return createdDiscussion;
  }

  async getDiscussion(id: string) {
    this.logger.log(`Getting discussion: ${id}`);
    const discussion = await this.discussionSchema.getDiscussion(id);
    this.logger.log(
      `Retrieved discussion: ${JSON.stringify(discussion, null, 2)}`,
    );
    return discussion;
  }

  async updateDiscussion(id: string, updateData: any) {
    this.logger.log(
      `Updating discussion ${id}: ${JSON.stringify(updateData, null, 2)}`,
    );
    const updatedDiscussion = await this.discussionSchema.updateDiscussion(
      id,
      updateData,
    );
    this.logger.log(
      `Updated discussion: ${JSON.stringify(updatedDiscussion, null, 2)}`,
    );
    return updatedDiscussion;
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
