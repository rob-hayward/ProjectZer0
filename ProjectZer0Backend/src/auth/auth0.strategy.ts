import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
  private readonly logger = new Logger(Auth0Strategy.name);

  constructor(configService: ConfigService) {
    const domain = configService.get<string>('AUTH0_DOMAIN');
    const clientID = configService.get<string>('AUTH0_CLIENT_ID');
    const clientSecret = configService.get<string>('AUTH0_CLIENT_SECRET');
    const callbackURL = configService.get<string>('AUTH0_CALLBACK_URL');
    const audience = configService.get<string>('AUTH0_AUDIENCE');

    // Log configuration (without sensitive data)
    console.log('AUTH0_DOMAIN:', domain);
    console.log(
      'AUTH0_CLIENT_ID:',
      clientID ? clientID.substring(0, 8) + '...' : 'NOT SET',
    );
    console.log(
      'AUTH0_CLIENT_SECRET:',
      clientSecret ? 'SET (length: ' + clientSecret.length + ')' : 'NOT SET',
    );
    console.log('AUTH0_CALLBACK_URL:', callbackURL);
    console.log('AUTH0_AUDIENCE:', audience);
    if (!domain || !clientID || !clientSecret || !callbackURL) {
      const missing = [];
      if (!domain) missing.push('AUTH0_DOMAIN');
      if (!clientID) missing.push('AUTH0_CLIENT_ID');
      if (!clientSecret) missing.push('AUTH0_CLIENT_SECRET');
      if (!callbackURL) missing.push('AUTH0_CALLBACK_URL');

      const errorMsg = `❌ Missing Auth0 configuration: ${missing.join(', ')}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Call super() with enhanced configuration for production
    super({
      domain,
      clientID,
      clientSecret,
      callbackURL,
      audience,
      scope: 'openid profile email',
      state: true, // Explicitly enable state parameter
      store: true, // Use session store for state
      passReqToCallback: true, // Enable access to request object
    });

    // Post-initialization logging
    this.logger.log('Auth0Strategy initialized successfully');
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    extraParams: any,
    profile: any,
  ): Promise<any> {
    try {
      console.log('Request session ID:', req.sessionID);
      console.log(
        'Request session data:',
        JSON.stringify(req.session, null, 2),
      );
      console.log('Request cookies:', JSON.stringify(req.cookies, null, 2));
      console.log('Access Token exists:', !!accessToken);
      console.log('Profile ID:', profile.id || profile.sub);
      console.log('Profile provider:', profile.provider);
      console.log('Profile emails:', profile.emails);
      console.log('Raw profile data:', JSON.stringify(profile, null, 2));
      console.log('Extra params:', JSON.stringify(extraParams, null, 2));
      this.logger.log(
        `Auth0 validate called for user: ${profile.id || profile.sub}`,
      );
      this.logger.debug(
        `Profile data: ${JSON.stringify({
          id: profile.id,
          sub: profile.sub,
          email: profile.emails?.[0]?.value,
          name: profile.displayName,
          provider: profile.provider,
        })}`,
      );

      // Ensure we have a valid user identifier
      const userId = profile.id || profile.sub || profile._json?.sub;
      if (!userId) {
        this.logger.error('No user ID found in Auth0 profile');
        throw new Error('No user identifier found in Auth0 profile');
      }

      // Return normalized profile data
      const normalizedProfile = {
        sub: userId,
        email:
          profile.emails?.[0]?.value || profile.email || profile._json?.email,
        name: profile.displayName || profile.name || profile._json?.name,
        picture: profile.picture || profile._json?.picture,
        provider: profile.provider || 'auth0',
        ...profile._json, // Include the raw Auth0 profile data
      };
      console.log(JSON.stringify(normalizedProfile, null, 2));
      return normalizedProfile;
    } catch (error) {
      console.error('❌ AUTH0 STRATEGY VALIDATE ERROR:', error.message);
      console.error('Error stack:', error.stack);

      this.logger.error(
        `Error in Auth0Strategy validate: ${error.message}`,
        error.stack,
      );

      // Don't throw InternalServerErrorException here as it might interfere with passport
      // Instead, return null to indicate authentication failure
      return null;
    }
  }
}
