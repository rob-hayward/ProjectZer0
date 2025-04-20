// src/users/users.module.ts
import { Module, Logger } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserAuthService } from './user-auth.service';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { InteractionModule } from './interactions/interaction.module';
import { VisibilityModule } from './visibility/visibility.module';

@Module({
  imports: [Neo4jModule, InteractionModule, VisibilityModule],
  controllers: [UsersController],
  providers: [UserAuthService, UserSchema, Logger],
  exports: [UserAuthService, InteractionModule, VisibilityModule, UserSchema],
})
export class UsersModule {}
