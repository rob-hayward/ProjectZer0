// src/nodes/answer/answer.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { AnswerController } from './answer.controller';
import { AnswerService } from './answer.service';
import { AnswerSchema } from '../../neo4j/schemas/answer.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
import { OpenQuestionModule } from '../openquestion/openquestion.module';

@Module({
  imports: [
    VoteModule,
    DiscussionModule, // ← For DiscussionSchema
    KeywordExtractionModule, // ← For keyword extraction
    WordModule, // ← For word auto-creation
    CategoryModule, // ← For category validation
    OpenQuestionModule, // ← For parent question validation
  ],
  controllers: [AnswerController],
  providers: [
    AnswerService,
    AnswerSchema,
    UserSchema, // ← CRITICAL: Must be included
    VoteSchema,
    Logger,
  ],
  exports: [AnswerService, AnswerSchema],
})
export class AnswerModule {}
