// src/nodes/quantity/quantity.module.ts - REFACTORED TO SCHEMA ARCHITECTURE

import { Module, Logger } from '@nestjs/common';
import { QuantityController } from './quantity.controller';
import { QuantityService } from './quantity.service';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
import { UnitModule } from '../../units/unit.module';

@Module({
  imports: [
    VoteModule,
    DiscussionModule, // ← For DiscussionSchema
    KeywordExtractionModule, // ← For keyword extraction
    WordModule, // ← For word auto-creation
    CategoryModule, // ← For category validation
    UnitModule, // ← For unit validation (unique to Quantity)
  ],
  controllers: [QuantityController],
  providers: [
    QuantityService,
    QuantitySchema,
    UserSchema, // ← CRITICAL: Must be included
    VoteSchema,
    Logger,
  ],
  exports: [QuantityService, QuantitySchema],
})
export class QuantityModule {}
