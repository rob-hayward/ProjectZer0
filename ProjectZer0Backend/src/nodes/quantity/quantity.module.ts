// src/nodes/quantity/quantity.module.ts

import { Module, Logger } from '@nestjs/common';
import { QuantityController } from './quantity.controller';
import { QuantityService } from './quantity.service';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module'; // NEW: Added CategoryModule for validation and discovery
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
import { UnitModule } from '../../units/unit.module';

@Module({
  imports: [
    VoteModule, // For dual voting (inclusion + content)
    CategoryModule, // NEW: For category validation and discovery
    DiscussionModule, // For discussion integration
    CommentModule, // For comment integration
    KeywordExtractionModule, // For keyword processing
    WordModule, // For creating missing word nodes
    UnitModule, // For unit validation and conversion
  ],
  controllers: [QuantityController],
  providers: [QuantityService, QuantitySchema, VoteSchema, Logger],
  exports: [QuantityService, QuantitySchema], // Export both Service and Schema for external use
})
export class QuantityModule {}
