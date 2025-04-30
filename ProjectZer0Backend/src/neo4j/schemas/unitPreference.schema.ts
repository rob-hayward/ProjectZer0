// src/neo4j/schemas/unitPreference.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UnitPreference } from '../../users/dto/unitPreference.dto';

@Injectable()
export class UnitPreferenceSchema {
  private readonly logger = new Logger(UnitPreferenceSchema.name);
  private readonly PROPERTY_PREFIX = 'unit_pref_';

  constructor(private readonly neo4jService: Neo4jService) {}

  /**
   * Sets a unit preference for a user on a specific node
   */
  async setUnitPreference(
    userId: string,
    nodeId: string,
    unitId: string,
  ): Promise<UnitPreference> {
    this.logger.log(
      `Setting unit preference - User: ${userId}, Node: ${nodeId}, Unit: ${unitId}`,
    );

    try {
      // First ensure the user exists
      await this.ensureUserExists(userId);

      // Create a preference object
      const preference: UnitPreference = {
        unitId,
        lastUpdated: Date.now(),
      };

      // Create a safe property name
      const safeProperty = this.getSafePropertyName(nodeId);

      // Store preference as a string (JSON) to avoid Neo4j nested object limitations
      const preferenceJson = JSON.stringify(preference);

      // Use direct property access for reliable Neo4j operations
      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_UNIT_PREFERENCES]->(up:UnitPreferencesNode)
        SET up.${safeProperty} = $preferenceJson
        RETURN up.${safeProperty} as preferenceJson
      `;

      const result = await this.neo4jService.write(query, {
        userId,
        preferenceJson,
      });

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to set unit preference - no records returned');
      }

      return preference; // Return the original preference object we created
    } catch (error) {
      this.logger.error(
        `Error setting unit preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Gets a unit preference for a user on a specific node
   */
  async getUnitPreference(
    userId: string,
    nodeId: string,
  ): Promise<UnitPreference | undefined> {
    try {
      this.logger.log(
        `Getting unit preference for user ${userId}, node ${nodeId}`,
      );

      const safeProperty = this.getSafePropertyName(nodeId);

      // Use direct property access
      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_UNIT_PREFERENCES]->(up:UnitPreferencesNode)
        RETURN up.${safeProperty} as preferenceJson
      `;

      const result = await this.neo4jService.read(query, { userId });

      if (
        result.records.length === 0 ||
        result.records[0].get('preferenceJson') === null
      ) {
        this.logger.log(`No unit preference found for node ${nodeId}`);
        return undefined;
      }

      // Parse the JSON to get the preference
      const preferenceString = result.records[0].get('preferenceJson');

      try {
        return JSON.parse(preferenceString);
      } catch (e) {
        this.logger.error(`Error parsing preference JSON: ${e.message}`);
        return undefined;
      }
    } catch (error) {
      this.logger.error(
        `Error getting unit preference: ${error.message}`,
        error.stack,
      );
      return undefined;
    }
  }

  /**
   * Gets all unit preferences for a user
   */
  async getAllUnitPreferences(
    userId: string,
  ): Promise<Record<string, UnitPreference>> {
    try {
      this.logger.log(`Getting all unit preferences for user ${userId}`);

      // Get the entire unit preferences node
      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_UNIT_PREFERENCES]->(up:UnitPreferencesNode)
        RETURN up
      `;

      const result = await this.neo4jService.read(query, { userId });

      if (result.records.length === 0 || !result.records[0].get('up')) {
        this.logger.log(`No unit preferences found for user ${userId}`);
        return {};
      }

      const upNode = result.records[0].get('up');
      const preferences: Record<string, UnitPreference> = {};

      // Process each property with our prefix
      for (const [propName, value] of Object.entries(upNode.properties)) {
        if (propName.startsWith(this.PROPERTY_PREFIX)) {
          // Extract the node ID from the property name
          const nodeId = this.getNodeIdFromProperty(propName);

          try {
            // Try to parse the JSON value
            const parsedValue = JSON.parse(value as string);
            preferences[nodeId] = parsedValue;
          } catch (e) {
            this.logger.error(
              `Error parsing preference JSON for ${propName}: ${e.message}`,
            );
            // Skip this preference
          }
        }
      }

      return preferences;
    } catch (error) {
      this.logger.error(
        `Error getting all unit preferences: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  /**
   * Ensures a user exists in the database
   */
  private async ensureUserExists(userId: string): Promise<void> {
    try {
      const query = `
        MERGE (u:User {sub: $userId})
        RETURN u
      `;

      await this.neo4jService.write(query, { userId });
    } catch (error) {
      this.logger.error(
        `Error ensuring user exists: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Converts a node ID to a Neo4j-safe property name
   * with a consistent prefix
   */
  private getSafePropertyName(nodeId: string): string {
    return this.PROPERTY_PREFIX + nodeId.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Extracts the original node ID from a property name
   */
  private getNodeIdFromProperty(propName: string): string {
    // Remove the prefix
    return propName.substring(this.PROPERTY_PREFIX.length);
  }
}
