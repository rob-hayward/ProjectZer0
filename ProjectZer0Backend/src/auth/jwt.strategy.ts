import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const token = request?.cookies?.jwt;
          if (!token) {
            this.logger.debug('No JWT token found in cookies');
            return null;
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('AUTH0_CLIENT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (!payload) {
      this.logger.warn('Invalid token payload');
      throw new UnauthorizedException('Invalid token');
    }

    this.logger.debug(`JWT validated for user: ${payload.sub}`);
    return payload;
  }
}
