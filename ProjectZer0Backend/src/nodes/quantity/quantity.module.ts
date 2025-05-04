// src/nodes/quantity/quantity.module.ts
import { Module, Logger } from '@nestjs/common';
import { QuantityController } from './quantity.controller';
import { QuantityService } from './quantity.service';
import { QuantitySchema } from '../../neo4j/schemas/quantity.schema';
import { WordModule } from '../word/word.module';
import { UnitModule } from '../../units/unit.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [
    WordModule,
    UnitModule,
    KeywordExtractionModule,
    VoteModule,
    DiscussionModule,
    CommentModule,
  ],
  controllers: [QuantityController],
  providers: [QuantityService, QuantitySchema, VoteSchema, Logger],
  exports: [QuantityService],
})
export class QuantityModule {}
