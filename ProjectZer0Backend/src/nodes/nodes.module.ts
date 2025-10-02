// src/nodes/nodes.module.ts
import { Module } from '@nestjs/common';
import { WordModule } from './word/word.module';
import { DefinitionModule } from './definition/definition.module';
import { StatementModule } from './statement/statement.module';
import { OpenQuestionModule } from './openquestion/openquestion.module';
import { DiscussionModule } from './discussion/discussion.module';
import { CommentModule } from './comment/comment.module';
import { QuantityModule } from './quantity/quantity.module';
import { CategoryModule } from './category/category.module';
import { AnswerModule } from './answer/answer.module'; // NEW: Added AnswerModule
import { EvidenceModule } from './evidence/evidence.module';

@Module({
  imports: [
    WordModule,
    DefinitionModule,
    StatementModule,
    OpenQuestionModule,
    DiscussionModule,
    CommentModule,
    QuantityModule,
    CategoryModule,
    AnswerModule,
    EvidenceModule,
  ],
  exports: [
    WordModule,
    DefinitionModule,
    StatementModule,
    OpenQuestionModule,
    DiscussionModule,
    CommentModule,
    QuantityModule,
    CategoryModule,
    AnswerModule,
    EvidenceModule,
  ],
})
export class NodesModule {}
