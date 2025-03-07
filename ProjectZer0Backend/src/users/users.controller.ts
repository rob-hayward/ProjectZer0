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
import { VisibilityService } from './interactions/visibility.service';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private userAuthService: UserAuthService,
    private interactionService: InteractionService,
    private visibilityService: VisibilityService,
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

  @Get('visibility-preferences')
  @UseGuards(JwtAuthGuard)
  async getUserVisibilityPreferences(@Request() req: any) {
    this.logger.log(`Getting visibility preferences for user: ${req.user.sub}`);
    try {
      const preferences =
        await this.visibilityService.getUserVisibilityPreferences(req.user.sub);
      return preferences;
    } catch (error) {
      this.logger.error(
        `Error getting visibility preferences: ${error.message}`,
      );
      throw error;
    }
  }

  @Post('visibility-preferences')
  @UseGuards(JwtAuthGuard)
  async setUserVisibilityPreference(
    @Request() req: any,
    @Body() body: { nodeId: string; isVisible: boolean },
  ) {
    this.logger.log(
      `Setting visibility preference for user ${req.user.sub}, node ${body.nodeId}: ${body.isVisible}`,
    );
    try {
      return await this.visibilityService.setUserVisibilityPreference(
        req.user.sub,
        body.nodeId,
        body.isVisible,
      );
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
      );
      throw error;
    }
  }
}
