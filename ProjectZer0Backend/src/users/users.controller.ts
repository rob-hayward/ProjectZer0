import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async findOrCreateUser(@Body() userData: UserProfile) {
    return this.usersService.findOrCreateUser(userData);
  }
}
