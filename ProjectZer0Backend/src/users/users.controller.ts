import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Logger,
} from '@nestjs/common';
import { UserAuthService } from './user-auth.service';
import { InteractionService } from './interactions/interaction.service';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private userAuthService: UserAuthService,
    private interactionService: InteractionService,
    private userSchema: UserSchema,
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
    this.logger.log(`Getting activity stats for user: ${req.user.sub}`);

    try {
      const stats = await this.userSchema.getUserActivityStats(req.user.sub);

      // Get comments from interaction service (until migrated)
      const interactions = await this.interactionService.getAllInteractions(
        req.user.sub,
      );
      const commentCount = interactions.commented
        ? Object.values(interactions.commented).reduce(
            (total, comment) => total + comment.commentIds.length,
            0,
          )
        : 0;

      // Ensure we return plain numbers
      return {
        nodesCreated: Number(stats.nodesCreated || 0),
        votesCast: Number(stats.votesCast || 0),
        commentsMade: commentCount,
        creationsByType: {
          word: Number(stats.creationsByType.word || 0),
          definition: Number(stats.creationsByType.definition || 0),
          statement: Number(stats.creationsByType.statement || 0),
        },
      };
    } catch (error) {
      this.logger.error(`Error getting user activity: ${error.message}`);
      throw error;
    }
  }

  @Get(':userId/details')
  @UseGuards(JwtAuthGuard)
  async getUserDetails(@Param('userId') userId: string) {
    return this.userAuthService.getUserProfile(userId);
  }
}
