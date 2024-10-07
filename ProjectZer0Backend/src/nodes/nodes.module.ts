import { Module } from '@nestjs/common';
import { WordModule } from './word/word.module';
import { DefinitionModule } from './definition/definition.module';
import { BeliefModule } from './belief/belief.module';
import { DiscussionModule } from './discussion/discussion.module';
import { CommentModule } from './comment/comment.module';

@Module({
  imports: [
    WordModule,
    DefinitionModule,
    BeliefModule,
    DiscussionModule,
    CommentModule,
  ],
  exports: [
    WordModule,
    DefinitionModule,
    BeliefModule,
    DiscussionModule,
    CommentModule,
  ],
})
export class NodesModule {}
