import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const token = request?.cookies?.jwt;
          if (!token) {
            console.log('No JWT token found in cookies');
            return null;
          }
          console.log('JWT token found:', token);
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('AUTH0_CLIENT_SECRET'),
    });
  }

  async validate(payload: any) {
    console.log('JWT payload:', payload);
    if (!payload) {
      throw new UnauthorizedException('Invalid token');
    }
    return payload;
  }
}
