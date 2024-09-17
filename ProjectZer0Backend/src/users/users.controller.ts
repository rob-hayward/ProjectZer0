import { Controller, Post, Body, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('verify')
  async verifyUser(@Body() userData: { auth0Id: string; email: string }) {
    return this.usersService.findOrCreateUser(userData.auth0Id, userData.email);
  }

  @Get('test')
  async testDbConnection() {
    return this.usersService.testConnection();
  }
}
