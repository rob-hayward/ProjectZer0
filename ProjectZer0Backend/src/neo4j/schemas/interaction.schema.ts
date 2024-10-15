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
    const query = `
      MATCH (u:User {sub: $userId})
      MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
      SET i.visibilityPreferences = COALESCE(i.visibilityPreferences, {}) + {$objectId: $isVisible}
      RETURN i.visibilityPreferences[$objectId] as visibilityStatus
    `;
    const result = await this.neo4jService.write(query, {
      userId,
      objectId,
      isVisible,
    });
    return result.records[0].get('visibilityStatus');
  }

  async getVisibilityPreference(userId: string, objectId: string) {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN i.visibilityPreferences[$objectId] as visibilityStatus
    `;
    const result = await this.neo4jService.read(query, { userId, objectId });
    return result.records[0]?.get('visibilityStatus');
  }

  async getVisibilityPreferences(userId: string) {
    const query = `
      MATCH (u:User {sub: $userId})-[:HAS_INTERACTIONS]->(i:InteractionNode)
      RETURN i.visibilityPreferences as visibilityStatuses
    `;
    const result = await this.neo4jService.read(query, { userId });
    return result.records[0]?.get('visibilityStatuses') || {};
  }
}
