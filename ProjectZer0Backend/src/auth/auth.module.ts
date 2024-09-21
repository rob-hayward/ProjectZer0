import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import auth0Config from './auth0.config';

@Module({
  imports: [ConfigModule.forFeature(auth0Config)],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
