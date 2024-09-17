import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('verify')
  async verifyUser(@Body() userData: { auth0Id: string; email: string }) {
    return this.usersService.findOrCreateUser(userData.auth0Id, userData.email);
  }
}
