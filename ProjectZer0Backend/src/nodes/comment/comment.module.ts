// src/nodes/comment/comment.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityModule } from '../../users/visibility/visibility.module';

/**
 * CommentModule - Provides comment functionality across the application
 *
 * ARCHITECTURE:
 * - Provides CommentService and CommentSchema for dependency injection
 * - Imports VisibilityModule for user visibility preferences
 * - VoteSchema required for BaseNodeSchema voting integration
 * - Exports both service and schema for use by other modules
 *
 * DEPENDENCIES:
 * ✅ VisibilityModule - For centralized visibility management
 * ✅ VoteSchema - Required by BaseNodeSchema (CommentSchema extends BaseNodeSchema)
 *
 * EXPORTS:
 * ✅ CommentService - For other modules that need comment operations
 * ✅ CommentSchema - For other modules that need direct schema access
 *
 * USED BY:
 * - DiscussionModule (discussions contain comments)
 * - WordModule (word discussions contain comments)
 * - DefinitionModule (definition discussions contain comments)
 * - StatementModule (statement discussions contain comments)
 * - All other content modules that have discussions
 */
@Module({
  imports: [
    VisibilityModule, // For user visibility preferences on comments
  ],
  controllers: [
    CommentController, // HTTP endpoints for comment operations
  ],
  providers: [
    CommentService, // Business logic layer
    CommentSchema, // Data access layer (extends BaseNodeSchema)
    VoteSchema, // Required for BaseNodeSchema voting integration
  ],
  exports: [
    CommentService, // Export for other modules that need comment operations
    CommentSchema, // Export for direct schema access (e.g., DiscussionModule)
  ],
})
export class CommentModule {}
