// src/nodes/definition/definition.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { DiscussionModule } from '../discussion/discussion.module'; // ← Import for DiscussionSchema

/**
 * DefinitionModule - Module configuration for definition operations
 *
 * ARCHITECTURE:
 * - Imports DiscussionModule to get DiscussionSchema
 * - Provides DefinitionSchema, UserSchema, VoteSchema
 * - Exports DefinitionService and DefinitionSchema for other modules
 *
 * KEY DEPENDENCIES:
 * ✅ DiscussionModule - Provides DiscussionSchema for direct injection
 * ✅ VoteSchema - Required by BaseNodeSchema
 */
@Module({
  imports: [
    DiscussionModule, // ← CRITICAL: Import to get DiscussionSchema
  ],
  controllers: [DefinitionController],
  providers: [
    DefinitionService,
    DefinitionSchema,
    UserSchema,
    VoteSchema, // Required by BaseNodeSchema
    Logger,
  ],
  exports: [
    DefinitionService, // Export for other modules
    DefinitionSchema, // Export for other schemas
  ],
})
export class DefinitionModule {}
