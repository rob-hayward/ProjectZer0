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
      this.logger.log(`Request user object: ${JSON.stringify(req.user)}`);

      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(`Getting visibility preferences for user: ${userId}`);
      const preferences =
        await this.visibilityService.getUserVisibilityPreferences(userId);

      this.logger.log(`Retrieved preferences: ${JSON.stringify(preferences)}`);
      return preferences;
    } catch (error) {
      this.logger.error(
        `FULL ERROR getting visibility preferences: ${error}`,
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
      // Log everything about the request
      this.logger.log(`Request body: ${JSON.stringify(preference)}`);
      this.logger.log(`Request user object: ${JSON.stringify(req.user)}`);
      this.logger.log(`Request headers: ${JSON.stringify(req.headers)}`);

      const userId = req.user?.sub;
      if (!userId) {
        this.logger.error(
          `No userId found in request user object: ${JSON.stringify(req.user)}`,
        );
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
      this.logger.log(
        `About to call visibilityService.setUserVisibilityPreference`,
      );
      const result = await this.visibilityService.setUserVisibilityPreference(
        userId,
        preference.nodeId,
        preference.isVisible,
      );
      this.logger.log(
        `Service call completed successfully: ${JSON.stringify(result)}`,
      );

      // Return a standardized response
      const response = {
        success: true,
        preference: {
          isVisible: result.isVisible,
          nodeId: preference.nodeId,
          source: result.source,
          timestamp: result.timestamp,
        },
      };

      this.logger.log(`Returning response: ${JSON.stringify(response)}`);
      return response;
    } catch (error) {
      this.logger.error(
        `FULL ERROR setting visibility preference: ${error}`,
        error.stack,
      );

      // Log specific details if it's a Neo4j error
      if (error.code && error.message) {
        this.logger.error(
          `Neo4j error code: ${error.code}, message: ${error.message}`,
        );
      }

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
    this.logger.log(`Full request user object: ${JSON.stringify(req.user)}`);

    return {
      status: 'success',
      message: 'Test endpoint is working',
      userId: userId,
      timestamp: new Date().toISOString(),
    };
  }
}
