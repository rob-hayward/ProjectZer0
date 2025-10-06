// src/nodes/openquestion/openquestion.module.ts

import { Module, Logger } from '@nestjs/common';
import { OpenQuestionController } from './openquestion.controller';
import { OpenQuestionService } from './openquestion.service';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';

@Module({
  imports: [
    VoteModule, // For inclusion voting
    DiscussionModule, // For DiscussionSchema injection
    KeywordExtractionModule, // For AI keyword extraction
    WordModule, // For auto-creating missing word nodes
    CategoryModule, // For category validation
  ],
  controllers: [OpenQuestionController],
  providers: [
    OpenQuestionService,
    OpenQuestionSchema,
    UserSchema, // CRITICAL: Required for service injection
    VoteSchema,
    Logger,
  ],
  exports: [OpenQuestionService, OpenQuestionSchema],
})
export class OpenQuestionModule {}
