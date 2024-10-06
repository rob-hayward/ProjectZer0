import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';

@Module({
  controllers: [CommentController],
  providers: [CommentService, CommentSchema],
  exports: [CommentService],
})
export class CommentModule {}
