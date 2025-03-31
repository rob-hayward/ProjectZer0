// src/debug/debug.module.ts

import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { Neo4jModule } from '../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  controllers: [DebugController],
})
export class DebugModule {}
