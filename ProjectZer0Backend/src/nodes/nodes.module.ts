import { Module } from '@nestjs/common';
import { WordModule } from './word/word.module';
import { DefinitionModule } from './definition/definition.module';
import { StatementModule } from './statement/statement.module';
import { DiscussionModule } from './discussion/discussion.module';
import { CommentModule } from './comment/comment.module';

@Module({
  imports: [
    WordModule,
    DefinitionModule,
    StatementModule,
    DiscussionModule,
    CommentModule,
  ],
  exports: [
    WordModule,
    DefinitionModule,
    StatementModule,
    DiscussionModule,
    CommentModule,
  ],
})
export class NodesModule {}
