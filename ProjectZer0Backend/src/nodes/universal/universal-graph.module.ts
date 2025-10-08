import { Module } from '@nestjs/common';
import { Neo4jModule } from '../../neo4j/neo4j.module';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { VisibilityModule } from '../../users/visibility/visibility.module';
import { CategoryModule } from '../category/category.module';

// ✅ NEW: Import all 5 content node modules
import { StatementModule } from '../statement/statement.module';
import { OpenQuestionModule } from '../openquestion/openquestion.module';
import { AnswerModule } from '../answer/answer.module';
import { QuantityModule } from '../quantity/quantity.module';
import { EvidenceModule } from '../evidence/evidence.module';

import { UniversalGraphController } from './universal-graph.controller';
import { UniversalGraphService } from './universal-graph.service';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';

@Module({
  imports: [
    Neo4jModule,
    VoteModule,
    VisibilityModule,
    CategoryModule,
    // ✅ Phase 4.1: Import all content node modules for schema injection
    StatementModule,
    OpenQuestionModule,
    AnswerModule,
    QuantityModule,
    EvidenceModule,
  ],
  controllers: [UniversalGraphController],
  providers: [
    UniversalGraphService,
    VoteSchema, // Still needed for certain vote operations
  ],
  exports: [UniversalGraphService],
})
export class UniversalGraphModule {}
