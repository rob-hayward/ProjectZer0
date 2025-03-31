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
  HttpException,
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
  async getUserVisibilityPreferences(@Request() req) {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Getting visibility preferences for user: ${userId}`);
      const preferences =
        await this.visibilityService.getUserVisibilityPreferences(userId);
      return preferences;
    } catch (error) {
      this.logger.error(
        `Error getting visibility preferences: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to retrieve visibility preferences: ${error.message}`,
      );
    }
  }

  @Post('visibility-preferences')
  async setUserVisibilityPreference(
    @Request() req,
    @Body() preference: VisibilityPreferenceDto,
  ): Promise<VisibilityPreferenceResponseDto> {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
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

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to set visibility preference: ${error.message}`,
      );
    }
  }

  // Test endpoint to check connection
  @Get('visibility-preferences/test')
  async testEndpoint(@Request() req) {
    const userId = req.user?.sub || 'unknown';
    this.logger.log(`Test endpoint called by user: ${userId}`);

    return {
      status: 'success',
      message: 'Test endpoint is working',
      userId: userId,
      timestamp: new Date().toISOString(),
    };
  }
}
