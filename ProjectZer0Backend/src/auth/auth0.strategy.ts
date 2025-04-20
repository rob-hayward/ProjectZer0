import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
  private readonly logger = new Logger(Auth0Strategy.name);

  constructor(configService: ConfigService) {
    super({
      domain: configService.get<string>('AUTH0_DOMAIN'),
      clientID: configService.get<string>('AUTH0_CLIENT_ID'),
      clientSecret: configService.get<string>('AUTH0_CLIENT_SECRET'),
      callbackURL: configService.get<string>('AUTH0_CALLBACK_URL'),
      audience: configService.get<string>('AUTH0_AUDIENCE'),
      scope: 'openid profile email',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    extraParams: any,
    profile: any,
  ): Promise<any> {
    try {
      this.logger.debug(
        `Auth0 profile validated for user: ${profile.id || profile.sub}`,
      );
      return profile;
    } catch (error) {
      this.logger.error(
        `Error in Auth0Strategy validate: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error fetching user profile from Auth0',
      );
    }
  }
}
