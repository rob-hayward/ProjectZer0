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
  async login() {
    this.logger.log('Auth0 login initiated');
    // Auth0 will handle the redirect
  }

  @Get('callback')
  @UseGuards(AuthGuard('auth0'))
  async callback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const auth0Profile = req.user;
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

      res.cookie('jwt', token, {
        httpOnly: true,
        secure: isProduction, // Use secure cookies in production
        sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Use environment-based frontend URL
      const baseUrl = frontendUrl || 'http://localhost:5173';

      if (isNewUser) {
        this.logger.log(
          `New user registered: ${user.sub}, redirecting to profile edit`,
        );
        res.redirect(`${baseUrl}/edit-profile`);
      } else {
        this.logger.log(
          `Existing user logged in: ${user.sub}, redirecting to dashboard`,
        );
        res.redirect(`${baseUrl}/graph/dashboard`);
      }
    } catch (error) {
      this.logger.error(`Error in callback: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Error during authentication callback: ' + error.message,
      );
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
      res.clearCookie('jwt');

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
}
