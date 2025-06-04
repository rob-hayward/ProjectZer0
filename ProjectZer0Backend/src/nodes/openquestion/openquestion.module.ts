// src/nodes/openquestion/openquestion.module.ts
import { Module } from '@nestjs/common';
import { OpenQuestionController } from './openquestion.controller';
import { OpenQuestionService } from './openquestion.service';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
import { StatementModule } from '../statement/statement.module';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [
    KeywordExtractionModule,
    WordModule,
    StatementModule,
    VoteModule,
    DiscussionModule,
    CommentModule,
  ],
  controllers: [OpenQuestionController],
  providers: [OpenQuestionService, OpenQuestionSchema, VoteSchema],
  exports: [OpenQuestionService],
})
export class OpenQuestionModule {}
