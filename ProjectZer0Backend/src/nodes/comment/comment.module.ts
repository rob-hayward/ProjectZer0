// src/nodes/comment/comment.module.ts
import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { VisibilityModule } from '../../users/visibility/visibility.module';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';

@Module({
  imports: [VisibilityModule, VoteModule],
  controllers: [CommentController],
  providers: [CommentService, CommentSchema, VoteSchema],
  exports: [CommentService],
})
export class CommentModule {}
