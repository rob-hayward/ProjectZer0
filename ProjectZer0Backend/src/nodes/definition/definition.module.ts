import { Module } from '@nestjs/common';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';

@Module({
  controllers: [DefinitionController],
  providers: [DefinitionService, DefinitionSchema],
  exports: [DefinitionService],
})
export class DefinitionModule {}
