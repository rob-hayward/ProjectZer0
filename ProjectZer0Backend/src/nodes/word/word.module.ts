// src/nodes/word/word.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { DiscussionModule } from '../discussion/discussion.module'; // ← Import for DiscussionSchema
import { DictionaryModule } from '../../dictionary/dictionary.module';
import { VisibilityModule } from '../../users/visibility/visibility.module';
import { DefinitionModule } from '../definition/definition.module'; // ← ADD THIS

/**
 * WordModule - Module configuration for word operations
 *
 * ARCHITECTURE:
 * - Imports DiscussionModule to get DiscussionSchema
 * - Imports VisibilityModule for visibility operations
 * - Imports DefinitionModule for loading word+definitions on graph (Phase 2b)
 * - Provides WordSchema, UserSchema, VoteSchema
 * - Exports WordService and WordSchema for other modules
 *
 * KEY DEPENDENCIES:
 * ✅ DiscussionModule - Provides DiscussionSchema for direct injection
 * ✅ VisibilityModule - Provides VisibilityService
 * ✅ DictionaryModule - Provides DictionaryService for API definitions
 * ✅ DefinitionModule - Provides DefinitionService for graph visualization
 * ✅ VoteSchema - Required by BaseNodeSchema
 */
@Module({
  imports: [
    DiscussionModule, // ← CRITICAL: Import to get DiscussionSchema
    VisibilityModule, // For visibility operations
    DictionaryModule, // For API definition fetching
    DefinitionModule, // ← ADD THIS: For loading word+definitions on graph
  ],
  controllers: [WordController],
  providers: [
    WordService,
    WordSchema,
    UserSchema,
    VoteSchema, // Required by BaseNodeSchema
    Logger,
  ],
  exports: [
    WordService, // Export for other modules (like StatementService)
    WordSchema, // Export for other schemas that need word operations
  ],
})
export class WordModule {}
