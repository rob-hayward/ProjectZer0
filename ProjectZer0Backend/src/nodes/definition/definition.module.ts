// src/nodes/definition/definition.module.ts
import { Module, Logger } from '@nestjs/common';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [DiscussionModule, CommentModule],
  controllers: [DefinitionController],
  providers: [
    DefinitionService,
    DefinitionSchema,
    UserSchema,
    VoteSchema,
    Logger,
  ],
  exports: [DefinitionService],
})
export class DefinitionModule {}
