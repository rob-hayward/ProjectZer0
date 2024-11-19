import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { UserAuthService } from './user-auth.service';
import { InteractionService } from './interactions/interaction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

@Controller('users')
export class UsersController {
  constructor(
    private userAuthService: UserAuthService,
    private interactionService: InteractionService,
  ) {}

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

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  async getUserActivity(@Request() req: any) {
    const userId = req.user.sub;
    const interactions =
      await this.interactionService.getAllInteractions(userId);

    return {
      nodesCreated: Object.keys(interactions.created || {}).length,
      votesCast: Object.keys(interactions.voted || {}).length,
      commentsMade: interactions.commented
        ? Object.values(interactions.commented).reduce(
            (total, comment) => total + comment.commentIds.length,
            0,
          )
        : 0,
    };
  }

  @Get(':userId/details')
  @UseGuards(JwtAuthGuard)
  async getUserDetails(@Param('userId') userId: string) {
    return this.userAuthService.getUserProfile(userId);
  }
}
