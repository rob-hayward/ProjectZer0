import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class InteractionSchema {
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
  ) {
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

    // Step 2: Update the specific preference value in JavaScript
    prefs = { ...prefs, [objectId]: isVisible };

    // Step 3: Save the updated preferences object back to Neo4j
    const setQuery = `
      MATCH (u:User {sub: $userId})
      MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
      SET i.visibilityPreferences = $prefs
      RETURN i.visibilityPreferences as updatedPrefs
    `;

    // Execute the query but don't assign to an unused variable
    await this.neo4jService.write(setQuery, {
      userId,
      prefs,
    });

    // Return the specific value we just set
    return isVisible;
  }

  async getVisibilityPreference(userId: string, objectId: string) {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN i.visibilityPreferences as prefs
    `;
    const result = await this.neo4jService.read(query, { userId });

    if (result.records.length === 0 || !result.records[0].get('prefs')) {
      return undefined;
    }

    const prefs = result.records[0].get('prefs');
    return prefs[objectId]; // Return the specific preference
  }

  async getVisibilityPreferences(userId: string) {
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
