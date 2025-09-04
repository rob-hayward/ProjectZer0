// src/nodes/statement/statement.module.ts

import { Module, Logger } from '@nestjs/common';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module'; // NEW: Added CategoryModule for validation and discovery
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';

@Module({
  imports: [
    VoteModule, // For dual voting (inclusion + content)
    CategoryModule, // NEW: For category validation and discovery
    DiscussionModule, // For discussion integration
    CommentModule, // For comment integration
    KeywordExtractionModule, // For keyword processing
    WordModule, // For creating missing word nodes
  ],
  controllers: [StatementController],
  providers: [StatementService, StatementSchema, VoteSchema, Logger],
  exports: [StatementService, StatementSchema], // Export both Service and Schema for external use
})
export class StatementModule {}
