import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
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
      console.log('Auth0 profile:', JSON.stringify(profile, null, 2));
      return profile;
    } catch (error) {
      console.error('Error in Auth0Strategy validate:', error);
      throw new InternalServerErrorException(
        'Error fetching user profile from Auth0',
      );
    }
  }
}
