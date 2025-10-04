// src/nodes/category/category.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CategorySchema } from '../../neo4j/schemas/category.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';

/**
 * CategoryModule - Dependency injection for category operations
 *
 * IMPORTS:
 * - VoteModule: Provides VoteSchema for voting functionality
 * - DiscussionModule: Provides DiscussionSchema for discussion creation
 * - CommentModule: Provides CommentSchema for comment functionality
 *
 * PROVIDERS:
 * - CategoryService: Business logic layer
 * - CategorySchema: Database layer for categories
 * - UserSchema: User tracking (CRITICAL - was missing!)
 * - VoteSchema: Voting functionality
 * - Logger: Logging utility
 *
 * EXPORTS:
 * - CategoryService: For use by other modules
 * - CategorySchema: For use by other schemas
 */
@Module({
  imports: [
    VoteModule, // Provides VoteSchema
    DiscussionModule, // Provides DiscussionSchema (CRITICAL for discussion creation)
    CommentModule, // Provides CommentSchema
  ],
  controllers: [CategoryController],
  providers: [
    CategoryService,
    CategorySchema,
    UserSchema, // ← CRITICAL FIX: Added UserSchema
    VoteSchema,
    Logger,
  ],
  exports: [CategoryService, CategorySchema],
})
export class CategoryModule {}
