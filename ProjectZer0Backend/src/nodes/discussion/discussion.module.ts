import { Module } from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [CommentModule],
  controllers: [DiscussionController],
  providers: [DiscussionService, DiscussionSchema],
  exports: [DiscussionService],
})
export class DiscussionModule {}
