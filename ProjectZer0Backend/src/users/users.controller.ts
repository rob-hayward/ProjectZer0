import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async findOrCreateUser(@Body() userData: { auth0Id: string; email: string }) {
    return this.usersService.findOrCreateUser(userData.auth0Id, userData.email);
  }
}
