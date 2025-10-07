// src/nodes/evidence/evidence.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceSchema } from '../../neo4j/schemas/evidence.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';

/**
 * EvidenceModule - Dependency injection for evidence operations
 *
 * IMPORTS:
 * - VoteModule: Provides VoteSchema for inclusion voting only
 * - CategoryModule: Provides CategoryService for category validation
 * - DiscussionModule: Provides DiscussionSchema for discussion creation
 * - KeywordExtractionModule: Provides KeywordExtractionService for AI keyword extraction
 * - WordModule: Provides WordService for creating missing word nodes
 *
 * PROVIDERS:
 * - EvidenceService: Business logic layer
 * - EvidenceSchema: Database layer for evidence (extends CategorizedNodeSchema)
 * - UserSchema: User tracking
 * - VoteSchema: Voting functionality
 * - Logger: Logging utility
 *
 * EXPORTS:
 * - EvidenceService: For use by other modules
 * - EvidenceSchema: For use by other schemas
 *
 * KEY CHARACTERISTICS:
 * - Inclusion voting only (no content voting - uses peer review system instead)
 * - 3D peer review system (quality, independence, relevance scores)
 * - Must link to parent node (Statement, Answer, or Quantity)
 * - 0-3 categories
 * - Multiple keywords
 * - Has discussions
 */
@Module({
  imports: [
    VoteModule, // Provides VoteSchema for inclusion voting
    CategoryModule, // Provides CategoryService for validation (0-3 categories)
    DiscussionModule, // Provides DiscussionSchema (CRITICAL for discussion creation)
    KeywordExtractionModule, // Provides KeywordExtractionService for AI keyword extraction
    WordModule, // Provides WordService for creating missing word nodes
  ],
  controllers: [EvidenceController],
  providers: [
    EvidenceService,
    EvidenceSchema,
    UserSchema, // CRITICAL: Must be included for user tracking
    VoteSchema,
    Logger,
  ],
  exports: [EvidenceService, EvidenceSchema],
})
export class EvidenceModule {}
