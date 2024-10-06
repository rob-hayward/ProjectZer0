import { Module } from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';

@Module({
  controllers: [DiscussionController],
  providers: [DiscussionService, DiscussionSchema],
  exports: [DiscussionService],
})
export class DiscussionModule {}
