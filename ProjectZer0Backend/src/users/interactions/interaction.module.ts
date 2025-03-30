import { Module } from '@nestjs/common';
import { InteractionService } from './interaction.service';
import { VisibilityService } from './visibility.service';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import { Neo4jModule } from '../../neo4j/neo4j.module';
import { VisibilityController } from './visibility.controller';

@Module({
  imports: [Neo4jModule],
  controllers: [VisibilityController],
  providers: [InteractionService, VisibilityService, InteractionSchema],
  exports: [InteractionService, VisibilityService],
})
export class InteractionModule {}
