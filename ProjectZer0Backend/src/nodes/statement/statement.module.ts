// src/nodes/statement/statement.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';

/**
 * StatementModule - Dependency injection for statement operations
 *
 * IMPORTS:
 * - VoteModule: Provides VoteSchema for dual voting (inclusion + content)
 * - CategoryModule: Provides CategoryService for category validation
 * - DiscussionModule: Provides DiscussionSchema for discussion creation
 * - CommentModule: Provides CommentSchema for comment functionality
 * - KeywordExtractionModule: Provides KeywordExtractionService for AI keyword extraction
 * - WordModule: Provides WordService for creating missing word nodes
 *
 * PROVIDERS:
 * - StatementService: Business logic layer
 * - StatementSchema: Database layer for statements (extends CategorizedNodeSchema)
 * - UserSchema: User tracking (CRITICAL - was missing!)
 * - VoteSchema: Voting functionality
 * - Logger: Logging utility
 *
 * EXPORTS:
 * - StatementService: For use by other modules
 * - StatementSchema: For use by other schemas
 */
@Module({
  imports: [
    VoteModule, // Provides VoteSchema for dual voting
    CategoryModule, // Provides CategoryService for validation (0-3 categories)
    DiscussionModule, // Provides DiscussionSchema (CRITICAL for discussion creation)
    CommentModule, // Provides CommentSchema
    KeywordExtractionModule, // Provides KeywordExtractionService for AI keyword extraction
    WordModule, // Provides WordService for creating missing word nodes
  ],
  controllers: [StatementController],
  providers: [
    StatementService,
    StatementSchema,
    UserSchema, // ← CRITICAL FIX: Added UserSchema
    VoteSchema,
    Logger,
  ],
  exports: [StatementService, StatementSchema],
})
export class StatementModule {}
