// src/users/visibility/visibility.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { VisibilityService } from './visibility.service';
import {
  VisibilityPreferenceDto,
  VisibilityPreferenceResponseDto,
} from '../dto/visibility.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class VisibilityController {
  private readonly logger = new Logger(VisibilityController.name);

  constructor(private readonly visibilityService: VisibilityService) {}

  @Get('visibility-preferences')
  async getUserVisibilityPreferences(@Request() req: any) {
    try {
      const userId = req.user?.sub;

      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.debug(`Getting visibility preferences for user: ${userId}`);
      const preferences =
        await this.visibilityService.getUserVisibilityPreferences(userId);

      return preferences;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

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
  async setUserVisibilityPreference(
    @Request() req: any,
    @Body() preference: VisibilityPreferenceDto,
  ): Promise<VisibilityPreferenceResponseDto> {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        this.logger.error(`No userId found in request`);
        throw new BadRequestException('User ID is required');
      }

      this.logger.debug(
        `Setting visibility preference for user: ${userId}, nodeId: ${preference.nodeId}, isVisible: ${preference.isVisible}`,
      );

      // Validate inputs
      if (!preference.nodeId) {
        throw new BadRequestException('Node ID is required');
      }

      // Call service to set the preference
      const result = await this.visibilityService.setUserVisibilityPreference(
        userId,
        preference.nodeId,
        preference.isVisible,
      );

      // Return a standardized response
      return {
        success: true,
        preference: {
          isVisible: result.isVisible,
          nodeId: preference.nodeId,
          source: result.source,
          timestamp: result.timestamp,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to set visibility preference: ${error.message}`,
      );
    }
  }
}
