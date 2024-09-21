import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('auth0Login')
  auth0Login(@Res() res: Response) {
    const { redirectUrl } = this.authService.initiateAuth0Login();
    res.json({ redirectUrl });
  }
}
