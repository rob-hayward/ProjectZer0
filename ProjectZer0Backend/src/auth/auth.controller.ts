import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { UserAuthService } from '../users/user-auth.service';
import { UserProfile } from '../users/user.model';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private configService: ConfigService,
    private userAuthService: UserAuthService,
    private jwtService: JwtService,
  ) {}

  @Get('login')
  @UseGuards(AuthGuard('auth0'))
  async login() {
    // Auth0 will handle the redirect
  }

  @Get('callback')
  @UseGuards(AuthGuard('auth0'))
  async callback(@Req() req: Request, @Res() res: Response) {
    console.log('Raw Auth0 profile:', JSON.stringify(req.user, null, 2));
    const auth0Profile = req.user as UserProfile;
    try {
      const { user, isNewUser } =
        await this.userAuthService.findOrCreateUser(auth0Profile);

      const payload = { sub: user.sub, email: user.email };
      const token = this.jwtService.sign(payload);

      res.cookie('jwt', token, {
        httpOnly: true,
        secure: false, // set to false for HTTP in development
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      console.log('JWT Token set in cookie:', token);

      if (isNewUser) {
        res.redirect('http://localhost:5173/edit-profile');
      } else {
        res.redirect('http://localhost:5173/graph/dashboard');
      }
    } catch (error) {
      console.error('Error in callback:', error);
      throw new InternalServerErrorException(
        'Error during authentication callback: ' + error.message,
      );
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {
    console.log('Getting profile, user:', req.user);
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    // Fetch the full user profile from the database
    const userProfile = await this.userAuthService.getUserProfile(
      req.user['sub'],
    );
    return userProfile;
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    try {
      res.clearCookie('jwt');
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          throw new InternalServerErrorException(
            'Error during logout: ' + err.message,
          );
        }
        const returnTo = encodeURIComponent('http://localhost:5173');
        const domain = this.configService.get<string>('AUTH0_DOMAIN');
        const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
        res.redirect(
          `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`,
        );
      });
    } catch (error) {
      console.error('Error in logout:', error);
      throw new InternalServerErrorException(
        'Error during logout: ' + error.message,
      );
    }
  }

  @Get('test')
  test() {
    return { message: 'Backend is reachable' };
  }
}
