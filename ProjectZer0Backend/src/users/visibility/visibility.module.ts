// src/users/visibility/visibility.module.ts

import { Module } from '@nestjs/common';
import { VisibilityService } from './visibility.service';
import { VisibilityController } from './visibility.controller';
import { VisibilitySchema } from '../../neo4j/schemas/visibility.schema';
import { Neo4jModule } from '../../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  controllers: [VisibilityController],
  providers: [VisibilityService, VisibilitySchema],
  exports: [VisibilityService],
})
export class VisibilityModule {}
