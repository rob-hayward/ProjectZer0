// src/nodes/nodes.module.ts
import { Module } from '@nestjs/common';
import { WordModule } from './word/word.module';
import { DefinitionModule } from './definition/definition.module';
import { StatementModule } from './statement/statement.module';
import { DiscussionModule } from './discussion/discussion.module';
import { CommentModule } from './comment/comment.module';
import { QuantityModule } from './quantity/quantity.module';

@Module({
  imports: [
    WordModule,
    DefinitionModule,
    StatementModule,
    DiscussionModule,
    CommentModule,
    QuantityModule,
  ],
  exports: [
    WordModule,
    DefinitionModule,
    StatementModule,
    DiscussionModule,
    CommentModule,
    QuantityModule,
  ],
})
export class NodesModule {}
