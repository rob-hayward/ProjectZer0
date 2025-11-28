import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { UserAuthService } from '../users/user-auth.service';
import { UserProfile } from '../users/user.model';
import { JwtService } from '@nestjs/jwt';

// Define a proper type for the authenticated request
export interface AuthenticatedRequest extends Request {
  user: UserProfile;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private configService: ConfigService,
    private userAuthService: UserAuthService,
    private jwtService: JwtService,
  ) {}

  @Get('login')
  @UseGuards(AuthGuard('auth0'))
  async login(@Req() req: Request) {
    this.logger.log('Auth0 login initiated');
    this.logger.debug(`Session ID at login: ${req.sessionID}`);
    this.logger.debug(`Session data at login: ${JSON.stringify(req.session)}`);

    // Ensure session is saved before redirecting
    req.session.save((err) => {
      if (err) {
        this.logger.error('Error saving session at login:', err);
      } else {
        this.logger.debug('Session saved successfully at login');
      }
    });

    // Auth0 will handle the redirect
  }

  @Get('callback')
  @UseGuards(AuthGuard('auth0'))
  async callback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    // Add debug logs at the very beginning
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request query params:', JSON.stringify(req.query, null, 2));
    console.log('Request user exists:', !!req.user);
    console.log('Request user data:', JSON.stringify(req.user, null, 2));
    console.log('Request session ID:', req.sessionID);
    console.log('Request session:', JSON.stringify(req.session, null, 2));
    console.log('Request cookies:', JSON.stringify(req.cookies, null, 2));
    const auth0Profile = req.user;

    if (!auth0Profile) {
      this.logger.error('No user profile found in callback request');
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      return res.redirect(`${frontendUrl}?auth_error=no_profile`);
    }

    try {
      this.logger.log(`Auth0 callback received for user: ${auth0Profile.sub}`);

      const { user, isNewUser } =
        await this.userAuthService.findOrCreateUser(auth0Profile);

      const payload = { sub: user.sub, email: user.email };
      const token = this.jwtService.sign(payload);

      this.logger.debug(`JWT token created for user: ${user.sub}`);

      // Get environment configuration
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');

      // Determine if we're in production
      const isProduction = nodeEnv === 'production';

      console.log(`Environment: ${nodeEnv}, Frontend URL: ${frontendUrl}`);

      // Set cookie with enhanced configuration
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? ('none' as const) : ('lax' as const),
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        // Remove domain setting for Render
        // domain: isProduction ? '.onrender.com' : undefined,
      };

      this.logger.debug(
        `Setting cookie with options: ${JSON.stringify(cookieOptions)}`,
      );

      res.cookie('jwt', token, cookieOptions);

      // Use environment-based frontend URL
      const baseUrl = frontendUrl || 'http://localhost:5173';

      if (isNewUser) {
        this.logger.log(
          `New user registered: ${user.sub}, redirecting to profile edit`,
        );
        res.redirect(`${baseUrl}/edit-profile`);
      } else {
        this.logger.log(
          `Existing user logged in: ${user.sub}, redirecting to universal graph`,
        );
        res.redirect(`${baseUrl}/graph/universal`);
      }
    } catch (error) {
      this.logger.error(`Error in callback: ${error.message}`, error.stack);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      // Redirect to frontend with error for better UX
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      res.redirect(`${frontendUrl}?auth_error=callback_failed`);
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: AuthenticatedRequest) {
    if (!req.user) {
      this.logger.warn('Profile request without authenticated user');
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      // Fetch the full user profile from the database
      const userProfile = await this.userAuthService.getUserProfile(
        req.user.sub,
      );
      this.logger.debug(`Profile retrieved for user: ${req.user.sub}`);
      return userProfile;
    } catch (error) {
      this.logger.error(
        `Error fetching user profile: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch user profile');
    }
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    try {
      // Safely access user.sub with optional chaining
      const userSub = (req.user as any)?.sub;
      this.logger.log(
        `Logout request received for user: ${userSub || 'unknown'}`,
      );

      // Clear JWT cookie
      res.clearCookie('jwt', {
        // Remove domain setting for Render
        // domain: this.configService.get<string>('NODE_ENV') === 'production' ? '.onrender.com' : undefined,
        path: '/',
      });

      req.session.destroy((err) => {
        if (err) {
          this.logger.error('Error destroying session:', err);
          throw new InternalServerErrorException(
            'Error during logout: ' + err.message,
          );
        }

        // Use environment-based frontend URL
        const frontendUrl =
          this.configService.get<string>('FRONTEND_URL') ||
          'http://localhost:5173';
        const returnTo = encodeURIComponent(frontendUrl);
        const domain = this.configService.get<string>('AUTH0_DOMAIN');
        const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');

        this.logger.log('Session destroyed, redirecting to Auth0 logout');
        res.redirect(
          `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`,
        );
      });
    } catch (error) {
      this.logger.error(`Error in logout: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Error during logout: ' + error.message,
      );
    }
  }

  @Get('test')
  test() {
    this.logger.debug('Backend reachability test');
    return { message: 'Backend is reachable' };
  }

  @Get('debug')
  debug(@Req() req: Request) {
    const domain = this.configService.get<string>('AUTH0_DOMAIN');
    const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
    const callbackUrl = this.configService.get<string>('AUTH0_CALLBACK_URL');
    const audience = this.configService.get<string>('AUTH0_AUDIENCE');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    return {
      environment: nodeEnv,
      frontendUrl,
      sessionId: req.sessionID,
      sessionData: req.session,
      cookies: req.cookies,
      auth0: {
        domain,
        clientId: clientId ? clientId.substring(0, 8) + '...' : 'NOT SET',
        callbackUrl,
        audience,
        hasClientSecret: !!this.configService.get<string>(
          'AUTH0_CLIENT_SECRET',
        ),
      },
    };
  }
}
