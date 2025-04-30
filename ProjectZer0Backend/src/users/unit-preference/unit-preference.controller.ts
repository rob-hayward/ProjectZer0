// src/users/unit-preference/unit-preference.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UnitPreferenceService } from './unit-preference.service';
import { SetUnitPreferenceDto } from '../dto/unitPreference.dto';

@Controller('users/unit-preferences')
@UseGuards(JwtAuthGuard)
export class UnitPreferenceController {
  private readonly logger = new Logger(UnitPreferenceController.name);

  constructor(private readonly unitPreferenceService: UnitPreferenceService) {}

  @Get()
  async getAllUnitPreferences(@Request() req: any) {
    this.logger.log(`Getting all unit preferences for user ${req.user.sub}`);
    return this.unitPreferenceService.getAllUnitPreferences(req.user.sub);
  }

  @Post()
  async setUnitPreference(
    @Body() setUnitPreferenceDto: SetUnitPreferenceDto,
    @Request() req: any,
  ) {
    this.logger.log(
      `Setting unit preference for user ${req.user.sub}, node: ${setUnitPreferenceDto.nodeId}, unit: ${setUnitPreferenceDto.unitId}`,
    );

    if (!setUnitPreferenceDto.nodeId) {
      throw new BadRequestException('Node ID is required');
    }

    if (!setUnitPreferenceDto.unitId) {
      throw new BadRequestException('Unit ID is required');
    }

    return this.unitPreferenceService.setUnitPreference(
      req.user.sub,
      setUnitPreferenceDto.nodeId,
      setUnitPreferenceDto.unitId,
    );
  }
}
