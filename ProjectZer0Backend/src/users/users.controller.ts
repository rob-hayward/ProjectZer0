import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UserAuthService } from './user-auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

@Controller('users')
export class UsersController {
  constructor(private userAuthService: UserAuthService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async findOrCreateUser(@Body() userData: UserProfile) {
    return this.userAuthService.findOrCreateUser(userData);
  }

  @Post('update-profile')
  @UseGuards(JwtAuthGuard)
  async updateUserProfile(@Body() userData: Partial<UserProfile>) {
    return this.userAuthService.updateUserProfile(userData);
  }
}
