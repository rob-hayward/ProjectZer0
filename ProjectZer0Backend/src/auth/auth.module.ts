import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { Auth0Strategy } from './auth0.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('AUTH0_CLIENT_SECRET'),
        signOptions: {
          expiresIn: '1h',
          audience: configService.get<string>('AUTH0_AUDIENCE'),
          issuer: `https://${configService.get<string>('AUTH0_DOMAIN')}/`,
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  providers: [Auth0Strategy, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
