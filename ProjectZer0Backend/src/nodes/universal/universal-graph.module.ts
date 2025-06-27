// src/nodes/universal/universal-graph.module.ts

import { Module } from '@nestjs/common';
import { UniversalGraphController } from './universal-graph.controller';
import { UniversalGraphService } from './universal-graph.service';
import { Neo4jModule } from '../../neo4j/neo4j.module';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VisibilityModule } from '../../users/visibility/visibility.module';

@Module({
  imports: [Neo4jModule, VoteModule, VisibilityModule],
  controllers: [UniversalGraphController],
  providers: [
    UniversalGraphService,
    VoteSchema, // Add VoteSchema as a provider
  ],
  exports: [UniversalGraphService],
})
export class UniversalGraphModule {}
