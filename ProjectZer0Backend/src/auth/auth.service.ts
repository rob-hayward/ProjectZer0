import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(private configService: ConfigService) {}

  initiateAuth0Login() {
    const auth0Domain = this.configService.get<string>('auth0.domain');
    const clientId = this.configService.get<string>('auth0.clientId');
    const redirectUri = this.configService.get<string>('auth0.callbackURL');
    const audience = this.configService.get<string>('auth0.audience');

    if (!auth0Domain || !clientId || !redirectUri || !audience) {
      throw new Error('Missing Auth0 configuration');
    }

    const authorizationUrl =
      `https://${auth0Domain}/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `audience=${encodeURIComponent(audience)}&` +
      `scope=openid%20profile%20email`;

    return { redirectUrl: authorizationUrl };
  }
}
