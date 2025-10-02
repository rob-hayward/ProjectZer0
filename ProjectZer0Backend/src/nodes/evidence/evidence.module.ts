// src/nodes/evidence/evidence.module.ts

import { Module, Logger } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceSchema } from '../../neo4j/schemas/evidence.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
import { UserSchema } from '../../neo4j/schemas/user.schema';

@Module({
  imports: [
    VoteModule,
    CategoryModule,
    DiscussionModule,
    CommentModule,
    KeywordExtractionModule,
    WordModule,
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService, EvidenceSchema, VoteSchema, UserSchema, Logger],
  exports: [EvidenceService, EvidenceSchema],
})
export class EvidenceModule {}
