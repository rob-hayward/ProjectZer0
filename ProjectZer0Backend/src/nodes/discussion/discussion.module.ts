// src/nodes/discussion/discussion.module.ts - UPDATED FOR BaseNodeSchema

import { Module } from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema'; // ✅ NEW: Required for BaseNodeSchema
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [
    CommentModule, // For comment service integration
    // ❌ NOTE: No VisibilityModule needed - discussions don't use user visibility preferences
  ],
  controllers: [DiscussionController],
  providers: [
    DiscussionService,
    DiscussionSchema,
    VoteSchema, // ✅ NEW: Required for BaseNodeSchema inheritance
  ],
  exports: [
    DiscussionService,
    DiscussionSchema, // Export for other modules that might need it
  ],
})
export class DiscussionModule {}
