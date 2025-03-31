// src/users/interactions/interaction.module.ts

import { Module } from '@nestjs/common';
import { InteractionService } from './interaction.service';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import { Neo4jModule } from '../../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  providers: [InteractionService, InteractionSchema],
  exports: [InteractionService],
})
export class InteractionModule {}
