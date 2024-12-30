import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserAuthService } from './user-auth.service';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { InteractionModule } from './interactions/interaction.module';

@Module({
  imports: [Neo4jModule, InteractionModule],
  controllers: [UsersController],
  providers: [UserAuthService, UserSchema],
  exports: [UserAuthService, InteractionModule, UserSchema], // Added UserSchema to exports
})
export class UsersModule {}
