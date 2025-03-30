// src/users/visibility.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { VisibilityService } from '../interactions/visibility.service';

interface VisibilityPreferenceDto {
  nodeId: string;
  isVisible: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class VisibilityController {
  private readonly logger = new Logger(VisibilityController.name);

  constructor(private readonly visibilityService: VisibilityService) {}

  @Get('visibility-preferences')
  async getUserVisibilityPreferences(@Request() req) {
    this.logger.log(`Getting visibility preferences for user: ${req.user.sub}`);
    try {
      const preferences =
        await this.visibilityService.getUserVisibilityPreferences(req.user.sub);
      return preferences;
    } catch (error) {
      this.logger.error(
        `Error getting visibility preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('visibility-preferences')
  async setUserVisibilityPreference(
    @Request() req,
    @Body() preference: VisibilityPreferenceDto,
  ) {
    this.logger.log(
      `Setting visibility preference for user: ${req.user.sub}, nodeId: ${preference.nodeId}, isVisible: ${preference.isVisible}`,
    );

    try {
      const result = await this.visibilityService.setUserVisibilityPreference(
        req.user.sub,
        preference.nodeId,
        preference.isVisible,
      );

      return { success: true, preference: result };
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
