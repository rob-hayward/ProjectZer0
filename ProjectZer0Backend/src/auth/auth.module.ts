import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { Auth0Strategy } from './auth0.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'auth0' }),
    ConfigModule,
  ],
  providers: [Auth0Strategy],
  controllers: [AuthController],
})
export class AuthModule {}
