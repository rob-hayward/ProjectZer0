// src/nodes/universal/universal-graph.module.ts

import { Module } from '@nestjs/common';
import { UniversalGraphController } from './universal-graph.controller';
import { UniversalGraphService } from './universal-graph.service';
import { Neo4jModule } from '../../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  controllers: [UniversalGraphController],
  providers: [UniversalGraphService],
  exports: [UniversalGraphService],
})
export class UniversalGraphModule {}
