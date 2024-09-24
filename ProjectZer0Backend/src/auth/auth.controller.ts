import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Auth0UserProfile, UserProfile } from '../users/user.model';

// Extend the Express.Session interface
declare module 'express-session' {
  interface Session {
    user?: UserProfile; // Use the DbUser type for better type safety
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  @Get('login')
  @UseGuards(AuthGuard('auth0'))
  async login() {
    // Auth0 will handle the redirect
  }

  @Get('callback')
  @UseGuards(AuthGuard('auth0'))
  async callback(@Req() req: Request, @Res() res: Response) {
    console.log('Auth0 profile:', JSON.stringify(req.user, null, 2));
    const auth0Profile = req.user as Auth0UserProfile;
    const { user, isNewUser } =
      await this.usersService.findOrCreateUser(auth0Profile);

    req.session.user = user;

    if (isNewUser) {
      // Redirect new users to the edit profile page
      res.redirect('http://localhost:5173/edit-profile');
    } else {
      // Redirect existing users to the dashboard
      res.redirect('http://localhost:5173/dashboard');
    }
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      const returnTo = encodeURIComponent('http://localhost:5173');
      const domain = this.configService.get<string>('AUTH0_DOMAIN');
      const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
      res.redirect(
        `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`,
      );
    });
  }

  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.session.user || null;
  }

  @Get('test')
  test() {
    return { message: 'Backend is reachable' };
  }
}
