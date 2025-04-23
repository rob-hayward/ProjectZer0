// src/units/unit.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { UnitService } from './unit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Measurement } from './interfaces/unit.interface';

@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitController {
  private readonly logger = new Logger(UnitController.name);

  constructor(private readonly unitService: UnitService) {}

  @Get('categories')
  async getAllCategories() {
    this.logger.debug('Getting all unit categories');
    return this.unitService.getAllCategories();
  }

  @Get('categories/:categoryId')
  async getCategory(@Param('categoryId') categoryId: string) {
    this.logger.debug(`Getting category: ${categoryId}`);
    return this.unitService.getCategory(categoryId);
  }

  @Get('categories/:categoryId/units')
  async getUnitsForCategory(@Param('categoryId') categoryId: string) {
    this.logger.debug(`Getting units for category: ${categoryId}`);
    return this.unitService.getUnitsForCategory(categoryId);
  }

  @Get('categories/:categoryId/default')
  async getDefaultUnit(@Param('categoryId') categoryId: string) {
    this.logger.debug(`Getting default unit for category: ${categoryId}`);
    return this.unitService.getDefaultUnit(categoryId);
  }

  @Post('convert')
  async convertUnit(
    @Body()
    conversionData: {
      categoryId: string;
      value: number;
      fromUnitId: string;
      toUnitId: string;
    },
  ) {
    this.logger.debug(
      `Converting ${conversionData.value} from ${conversionData.fromUnitId} to ${conversionData.toUnitId}`,
    );

    if (
      !conversionData.categoryId ||
      !conversionData.fromUnitId ||
      !conversionData.toUnitId
    ) {
      throw new BadRequestException('Missing required fields for conversion');
    }

    if (
      typeof conversionData.value !== 'number' ||
      isNaN(conversionData.value)
    ) {
      throw new BadRequestException('Value must be a valid number');
    }

    const convertedValue = this.unitService.convert(
      conversionData.categoryId,
      conversionData.value,
      conversionData.fromUnitId,
      conversionData.toUnitId,
    );

    return {
      originalValue: conversionData.value,
      originalUnitId: conversionData.fromUnitId,
      convertedValue,
      convertedUnitId: conversionData.toUnitId,
    };
  }

  @Post('normalize')
  async normalizeToBase(
    @Body() measurementData: { categoryId: string; measurement: Measurement },
  ) {
    this.logger.debug(
      `Normalizing measurement to base unit: ${JSON.stringify(measurementData)}`,
    );

    if (!measurementData.categoryId || !measurementData.measurement) {
      throw new BadRequestException(
        'Missing required fields for normalization',
      );
    }

    if (
      typeof measurementData.measurement.value !== 'number' ||
      isNaN(measurementData.measurement.value)
    ) {
      throw new BadRequestException('Measurement value must be a valid number');
    }

    return this.unitService.normalizeToBase(
      measurementData.categoryId,
      measurementData.measurement,
    );
  }

  @Post('format')
  async formatMeasurement(
    @Body() formatData: { categoryId: string; measurement: Measurement },
  ) {
    this.logger.debug(`Formatting measurement: ${JSON.stringify(formatData)}`);

    if (!formatData.categoryId || !formatData.measurement) {
      throw new BadRequestException('Missing required fields for formatting');
    }

    if (
      typeof formatData.measurement.value !== 'number' ||
      isNaN(formatData.measurement.value)
    ) {
      throw new BadRequestException('Measurement value must be a valid number');
    }

    const formatted = this.unitService.formatMeasurement(
      formatData.categoryId,
      formatData.measurement,
    );

    return {
      measurement: formatData.measurement,
      formatted,
    };
  }

  @Post('validate')
  async validateUnit(
    @Body() validateData: { categoryId: string; unitId: string },
  ) {
    this.logger.debug(
      `Validating unit ${validateData.unitId} in category ${validateData.categoryId}`,
    );

    if (!validateData.categoryId || !validateData.unitId) {
      throw new BadRequestException('Missing required fields for validation');
    }

    const isValid = this.unitService.validateUnitInCategory(
      validateData.categoryId,
      validateData.unitId,
    );

    return { isValid };
  }
}
