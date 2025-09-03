// src/nodes/universal/universal-graph.module.ts

import { Module } from '@nestjs/common';
import { UniversalGraphController } from './universal-graph.controller';
import { UniversalGraphService } from './universal-graph.service';
import { Neo4jModule } from '../../neo4j/neo4j.module';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityModule } from '../../users/visibility/visibility.module';
import { CategoryModule } from '../category/category.module'; // NEW: CategoryModule import

@Module({
  imports: [
    Neo4jModule,
    VoteModule,
    VisibilityModule,
    CategoryModule, // NEW: Added CategoryModule for category filtering and discovery
  ],
  controllers: [UniversalGraphController],
  providers: [
    UniversalGraphService,
    VoteSchema, // Add VoteSchema as a provider
  ],
  exports: [UniversalGraphService],
})
export class UniversalGraphModule {}
