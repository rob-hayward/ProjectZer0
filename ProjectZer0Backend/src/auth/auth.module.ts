import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { Auth0Strategy } from './auth0.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'auth0' }), UsersModule],
  providers: [Auth0Strategy],
  controllers: [AuthController],
})
export class AuthModule {}
