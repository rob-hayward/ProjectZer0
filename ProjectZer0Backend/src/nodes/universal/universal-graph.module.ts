// src/nodes/universal/universal-graph.module.ts - ENHANCED VERSION

import { Module } from '@nestjs/common';
import { UniversalGraphController } from './universal-graph.controller';
import { UniversalGraphService } from './universal-graph.service';
import { Neo4jModule } from '../../neo4j/neo4j.module';
import { QuantityModule } from '../quantity/quantity.module';

@Module({
  imports: [Neo4jModule, QuantityModule],
  controllers: [UniversalGraphController],
  providers: [UniversalGraphService],
  exports: [UniversalGraphService],
})
export class UniversalGraphModule {}
