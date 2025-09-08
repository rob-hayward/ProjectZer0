// src/nodes/comment/comment.module.ts - UPDATED FOR CONVERSION

import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityModule } from '../../users/visibility/visibility.module'; // ✅ NEW

@Module({
  imports: [
    VisibilityModule, // ✅ NEW: Import VisibilityModule for centralized visibility management
  ],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentSchema,
    VoteSchema, // ✅ NEW: Required for BaseNodeSchema voting integration
  ],
  exports: [
    CommentService,
    CommentSchema, // Export for other modules (like DiscussionModule)
  ],
})
export class CommentModule {}
