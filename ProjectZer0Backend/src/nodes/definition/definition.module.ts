import { Module } from '@nestjs/common';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';

@Module({
  controllers: [DefinitionController],
  providers: [DefinitionService, DefinitionSchema, UserSchema, VoteSchema],
  exports: [DefinitionService],
})
export class DefinitionModule {}
