// src/nodes/answer/answer.module.ts

import { Module, Logger } from '@nestjs/common';
import { AnswerController } from './answer.controller';
import { AnswerService } from './answer.service';
import { AnswerSchema } from '../../neo4j/schemas/answer.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';

@Module({
  imports: [
    VoteModule,
    CategoryModule, // For category validation and discovery
    DiscussionModule,
    CommentModule,
    KeywordExtractionModule, // For keyword processing
    WordModule, // For creating missing word nodes
  ],
  controllers: [AnswerController],
  providers: [AnswerService, AnswerSchema, VoteSchema, Logger],
  exports: [AnswerService, AnswerSchema],
})
export class AnswerModule {}
