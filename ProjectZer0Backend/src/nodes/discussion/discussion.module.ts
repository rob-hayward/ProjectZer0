// src/nodes/discussion/discussion.module.ts - SIMPLIFIED

import { Module } from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [
    CommentModule, // For comment service integration
    // ❌ REMOVED: VoteModule (discussions don't vote)
    // ❌ REMOVED: VisibilityModule (discussions don't have user visibility preferences)
  ],
  controllers: [DiscussionController],
  providers: [
    DiscussionService,
    DiscussionSchema,
    // ❌ REMOVED: VoteSchema (not needed for discussions)
  ],
  exports: [
    DiscussionService,
    DiscussionSchema, // Export for other modules that might need it
  ],
})
export class DiscussionModule {}
