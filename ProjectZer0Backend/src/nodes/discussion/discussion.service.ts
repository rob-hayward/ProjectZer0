import { Injectable } from '@nestjs/common';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DiscussionService {
  constructor(private readonly discussionSchema: DiscussionSchema) {}

  async createDiscussion(discussionData: {
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
  }) {
    const discussionWithId = {
      ...discussionData,
      id: uuidv4(),
    };
    return this.discussionSchema.createDiscussion(discussionWithId);
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
}
