import { Module } from '@nestjs/common';
import { InteractionService } from './interaction.service';
import { VisibilityService } from './visibility.service';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import { Neo4jModule } from '../../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  providers: [InteractionService, VisibilityService, InteractionSchema],
  exports: [InteractionService, VisibilityService],
})
export class InteractionModule {}
