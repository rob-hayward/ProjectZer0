// src/nodes/discussion/discussion.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module } from '@nestjs/common';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { CommentModule } from '../comment/comment.module';

/**
 * DiscussionModule - Provides discussion query functionality across the application
 *
 * ARCHITECTURE:
 * - Provides DiscussionService for orchestration and queries
 * - Provides DiscussionSchema for direct schema access
 * - Imports CommentModule for comment integration
 * - VoteSchema required for BaseNodeSchema integration
 * - NO VisibilityModule - discussions don't use user visibility preferences
 *
 * DEPENDENCIES:
 * ✅ CommentModule - For fetching discussion comments
 * ✅ VoteSchema - Required by BaseNodeSchema (DiscussionSchema extends BaseNodeSchema)
 * ❌ VisibilityModule - NOT needed (discussions have no visibility preferences)
 *
 * EXPORTS:
 * ✅ DiscussionService - For other modules that need discussion queries
 * ✅ DiscussionSchema - For other modules that need to create discussions directly
 *
 * KEY ARCHITECTURAL DECISION:
 * DiscussionSchema is exported because content services (Word, Statement, etc.)
 * need to inject it directly to call createDiscussionForNode().
 * Discussion creation is NOT exposed through DiscussionService.
 *
 * USED BY:
 * - WordModule (words create discussions)
 * - DefinitionModule (definitions create discussions)
 * - StatementModule (statements create discussions)
 * - OpenQuestionModule (questions create discussions)
 * - AnswerModule (answers create discussions)
 * - CategoryModule (categories create discussions)
 * - QuantityModule (quantities create discussions)
 * - EvidenceModule (evidence creates discussions)
 * - All other content modules that support discussions
 *
 * USAGE PATTERN:
 * ```typescript
 * // In WordModule
 * @Module({
 *   imports: [DiscussionModule], // Import to get DiscussionSchema
 *   providers: [WordService, WordSchema],
 * })
 *
 * // In WordService
 * constructor(
 *   private readonly wordSchema: WordSchema,
 *   private readonly discussionSchema: DiscussionSchema, // Inject schema directly
 * ) {}
 *
 * async createWord(data) {
 *   const word = await this.wordSchema.createWord(data);
 *
 *   if (data.initialComment) {
 *     await this.discussionSchema.createDiscussionForNode({
 *       nodeId: word.word,
 *       nodeType: 'WordNode',
 *       nodeIdField: 'word',
 *       createdBy: data.createdBy,
 *       initialComment: data.initialComment
 *     });
 *   }
 * }
 * ```
 */
@Module({
  imports: [
    CommentModule, // For CommentService - used to fetch discussion comments
  ],
  controllers: [
    DiscussionController, // HTTP endpoints for discussion queries
  ],
  providers: [
    DiscussionService, // Query and orchestration layer
    DiscussionSchema, // Data access layer (extends BaseNodeSchema)
    VoteSchema, // Required for BaseNodeSchema voting integration
  ],
  exports: [
    DiscussionService, // Export for modules that need discussion query operations
    DiscussionSchema, // Export for modules that need to create discussions directly
  ],
})
export class DiscussionModule {}
