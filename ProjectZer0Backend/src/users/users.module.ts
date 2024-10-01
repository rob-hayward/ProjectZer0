import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UserAuthService } from './user-auth.service';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { Neo4jModule } from '../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  controllers: [UsersController],
  providers: [UserAuthService, UserSchema],
  exports: [UserAuthService],
})
export class UsersModule {}
