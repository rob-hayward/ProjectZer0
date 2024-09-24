import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(private configService: ConfigService) {}

  @Get('login')
  @UseGuards(AuthGuard('auth0'))
  async login() {
    // auth0.strategy.ts will handle the redirect
  }

  @Get('callback')
  @UseGuards(AuthGuard('auth0'))
  async callback(@Req() req: Request, @Res() res: Response) {
    res.redirect('http://localhost:5173/dashboard');
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    req.logout(() => {
      const returnTo = encodeURIComponent('http://localhost:5173');
      const domain = this.configService.get<string>('AUTH0_DOMAIN');
      const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
      res.redirect(
        `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`,
      );
    });
  }

  @Get('profile')
  @UseGuards(AuthGuard('auth0'))
  getProfile(@Req() req: Request) {
    return req.user;
  }
}
