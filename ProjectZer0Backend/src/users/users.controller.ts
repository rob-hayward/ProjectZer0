// src/users/users.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserAuthService } from './user-auth.service';
import { InteractionService } from './interactions/interaction.service';
import { VisibilityService } from './visibility/visibility.service';
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
    this.logger.log(`Finding or creating user with ID: ${userData.sub}`);
    return this.userAuthService.findOrCreateUser(userData);
  }

  @Post('update-profile')
  @UseGuards(JwtAuthGuard)
  async updateUserProfile(@Body() userData: Partial<UserProfile>) {
    if (!userData.sub) {
      this.logger.warn('Attempt to update profile without user ID');
      throw new BadRequestException('User ID (sub) is required');
    }

    this.logger.log(`Updating profile for user: ${userData.sub}`);
    return this.userAuthService.updateUserProfile(userData);
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  async getUserActivity(@Request() req: any) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    this.logger.log(`Getting activity stats for user: ${userId}`);

    try {
      // Get user stats from Neo4j
      const stats = await this.userSchema.getUserActivityStats(userId);

      // Get interactions from interaction service
      const interactions =
        await this.interactionService.getAllInteractions(userId);

      // Count comments from interaction data
      const commentCount = interactions.commented
        ? Object.values(interactions.commented).reduce(
            (total, comment) => total + (comment.commentIds?.length || 0),
            0,
          )
        : 0;

      // Return consolidated stats
      return {
        nodesCreated: Number(stats.nodesCreated || 0),
        votesCast: Number(stats.votesCast || 0),
        commentsMade: commentCount,
        creationsByType: {
          word: Number(stats.creationsByType?.word || 0),
          definition: Number(stats.creationsByType?.definition || 0),
          statement: Number(stats.creationsByType?.statement || 0),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting user activity: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve user activity: ${error.message}`,
      );
    }
  }

  @Get(':userId/details')
  @UseGuards(JwtAuthGuard)
  async getUserDetails(@Param('userId') userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.log(`Getting details for user: ${userId}`);

    try {
      const userProfile = await this.userAuthService.getUserProfile(userId);
      if (!userProfile) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error fetching user details: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve user details: ${error.message}`,
      );
    }
  }

  @Get('visibility-preferences')
  @UseGuards(JwtAuthGuard)
  async getUserVisibilityPreferences(@Request() req: any) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    this.logger.log(`Getting visibility preferences for user: ${userId}`);

    try {
      const preferences =
        await this.visibilityService.getUserVisibilityPreferences(userId);
      return preferences;
    } catch (error) {
      this.logger.error(
        `Error getting visibility preferences: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve visibility preferences: ${error.message}`,
      );
    }
  }

  @Post('visibility-preferences')
  @UseGuards(JwtAuthGuard)
  async setUserVisibilityPreference(
    @Request() req: any,
    @Body() body: { nodeId: string; isVisible: boolean },
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    if (!body.nodeId) {
      throw new BadRequestException('Node ID is required');
    }

    this.logger.log(
      `Setting visibility preference for user ${userId}, node ${body.nodeId}: ${body.isVisible}`,
    );

    try {
      return await this.visibilityService.setUserVisibilityPreference(
        userId,
        body.nodeId,
        body.isVisible,
      );
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to set visibility preference: ${error.message}`,
      );
    }
  }
}
