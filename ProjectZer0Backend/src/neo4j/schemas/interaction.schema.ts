import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VisibilityPreference } from '../../users/interactions/interaction.model';

@Injectable()
export class InteractionSchema {
  private readonly logger = new Logger(InteractionSchema.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createOrUpdateInteraction(userId: string, interactionData: any) {
    const query = `
      MATCH (u:User {sub: $userId})
      MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
      SET i += $interactionData
      RETURN i
    `;
    const result = await this.neo4jService.write(query, {
      userId,
      interactionData,
    });
    return result.records[0].get('i').properties;
  }

  async addCommentInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    commentId: string,
  ) {
    const query = `
      MATCH (u:User {sub: $userId})
      MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
      SET i.commented = COALESCE(i.commented, {}) + {
        $objectId: {
          type: $objectType,
          commentIds: COALESCE(i.commented[$objectId].commentIds, []) + $commentId,
          lastCommentTimestamp: datetime()
        }
      }
      RETURN i.commented[$objectId] as commentInteraction
    `;
    const result = await this.neo4jService.write(query, {
      userId,
      objectId,
      objectType,
      commentId,
    });
    return result.records[0].get('commentInteraction');
  }

  async getInteractions(userId: string) {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN i
    `;
    const result = await this.neo4jService.read(query, { userId });
    return result.records[0]?.get('i').properties || {};
  }

  async getInteractedObjects(userId: string, interactionType: string) {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN keys(i[$interactionType]) as objectIds
    `;
    const result = await this.neo4jService.read(query, {
      userId,
      interactionType,
    });
    return result.records[0]?.get('objectIds') || [];
  }

  async setVisibilityPreference(
    userId: string,
    objectId: string,
    isVisible: boolean,
  ): Promise<VisibilityPreference> {
    this.logger.log(
      `Setting visibility preference for user ${userId}, object ${objectId}: ${isVisible}`,
    );

    try {
      // Step 1: First get the existing interaction node or create if not exists
      const getQuery = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
        RETURN i.visibilityPreferences as prefs
      `;

      const getResult = await this.neo4jService.read(getQuery, { userId });

      // Get existing preferences or initialize empty object
      let prefs =
        getResult.records.length > 0 && getResult.records[0].get('prefs')
          ? getResult.records[0].get('prefs')
          : {};

      // Step 2: Create or update the preference with enhanced data
      const preference: VisibilityPreference = {
        isVisible: isVisible,
        source: 'user',
        timestamp: Date.now(),
      };

      prefs = { ...prefs, [objectId]: preference };

      // Step 3: Save the updated preferences object back to Neo4j
      const setQuery = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
        SET i.visibilityPreferences = $prefs
        RETURN $preference as updatedPref
      `;

      const result = await this.neo4jService.write(setQuery, {
        userId,
        prefs,
        preference,
      });

      // Return the specific preference we just set
      return result.records[0]?.get('updatedPref') || preference;
    } catch (error) {
      this.logger.error(
        `Error setting visibility preference: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getVisibilityPreference(
    userId: string,
    objectId: string,
  ): Promise<boolean | undefined> {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN i.visibilityPreferences as prefs
    `;
    const result = await this.neo4jService.read(query, { userId });

    if (result.records.length === 0 || !result.records[0].get('prefs')) {
      return undefined;
    }

    const prefs = result.records[0].get('prefs');

    // Handle both boolean and object formats
    if (typeof prefs[objectId] === 'boolean') {
      return prefs[objectId];
    } else if (
      prefs[objectId] &&
      typeof prefs[objectId] === 'object' &&
      'isVisible' in prefs[objectId]
    ) {
      return prefs[objectId].isVisible;
    }

    return undefined;
  }

  async getVisibilityPreferences(
    userId: string,
  ): Promise<Record<string, boolean | VisibilityPreference>> {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN i.visibilityPreferences as prefs
    `;
    const result = await this.neo4jService.read(query, { userId });

    if (result.records.length === 0 || !result.records[0].get('prefs')) {
      return {};
    }

    return result.records[0].get('prefs');
  }
}
