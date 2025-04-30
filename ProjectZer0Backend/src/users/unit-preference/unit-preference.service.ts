// src/users/unit-preference/unit-preference.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { UnitPreferenceSchema } from '../../neo4j/schemas/unitPreference.schema';
import { UnitPreference } from '../dto/unitPreference.dto';

@Injectable()
export class UnitPreferenceService {
  private readonly logger = new Logger(UnitPreferenceService.name);

  constructor(private readonly unitPreferenceSchema: UnitPreferenceSchema) {}

  /**
   * Set a unit preference for a user on a specific node
   */
  async setUnitPreference(
    userId: string,
    nodeId: string,
    unitId: string,
  ): Promise<UnitPreference> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!nodeId) {
      throw new BadRequestException('Node ID is required');
    }

    if (!unitId) {
      throw new BadRequestException('Unit ID is required');
    }

    this.logger.log(
      `Setting unit preference for user ${userId} on node ${nodeId}: ${unitId}`,
    );

    try {
      return await this.unitPreferenceSchema.setUnitPreference(
        userId,
        nodeId,
        unitId,
      );
    } catch (error) {
      this.logger.error(
        `Error setting unit preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a unit preference for a user on a specific node
   */
  async getUnitPreference(
    userId: string,
    nodeId: string,
  ): Promise<UnitPreference | undefined> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!nodeId) {
      throw new BadRequestException('Node ID is required');
    }

    this.logger.debug(
      `Getting unit preference for user ${userId} on node ${nodeId}`,
    );

    try {
      return await this.unitPreferenceSchema.getUnitPreference(userId, nodeId);
    } catch (error) {
      this.logger.error(
        `Error getting unit preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all unit preferences for a user
   */
  async getAllUnitPreferences(
    userId: string,
  ): Promise<Record<string, UnitPreference>> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    this.logger.debug(`Getting all unit preferences for user ${userId}`);

    try {
      return await this.unitPreferenceSchema.getAllUnitPreferences(userId);
    } catch (error) {
      this.logger.error(
        `Error getting all unit preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
