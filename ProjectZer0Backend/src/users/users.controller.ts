import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('exists/:auth0Id')
  async checkUserExists(@Param('auth0Id') auth0Id: string) {
    return this.usersService.checkUserExists(auth0Id);
  }
}
