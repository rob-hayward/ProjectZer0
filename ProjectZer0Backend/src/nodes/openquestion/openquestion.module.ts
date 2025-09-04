// src/nodes/openquestion/openquestion.module.ts

import { Module, Logger } from '@nestjs/common';
import { OpenQuestionController } from './openquestion.controller';
import { OpenQuestionService } from './openquestion.service';
import { OpenQuestionSchema } from '../../neo4j/schemas/openquestion.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { AnswerModule } from '../answer/answer.module'; // NEW: Added AnswerModule for answer integration
import { CategoryModule } from '../category/category.module'; // NEW: Added CategoryModule for validation and discovery
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
// REMOVED: StatementModule - no longer needed for answer creation

@Module({
  imports: [
    VoteModule, // For inclusion voting
    AnswerModule, // NEW: For answer creation and management
    CategoryModule, // NEW: For category validation and discovery
    DiscussionModule, // For discussion integration
    CommentModule, // For comment integration
    KeywordExtractionModule, // For keyword processing
    WordModule, // For creating missing word nodes
  ],
  controllers: [OpenQuestionController],
  providers: [OpenQuestionService, OpenQuestionSchema, VoteSchema, Logger],
  exports: [OpenQuestionService, OpenQuestionSchema], // Export both Service and Schema for external use
})
export class OpenQuestionModule {}
