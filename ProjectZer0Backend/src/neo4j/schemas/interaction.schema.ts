// src/neo4j/schemas/interaction.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class InteractionSchema {
  private readonly logger = new Logger(InteractionSchema.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createOrUpdateInteraction(userId: string, interactionData: any) {
    try {
      this.logger.log(`Creating/updating interaction for user ${userId}`);

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

      return result.records[0]?.get('i')?.properties || {};
    } catch (error) {
      this.logger.error(
        `Error creating/updating interaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addCommentInteraction(
    userId: string,
    objectId: string,
    objectType: string,
    commentId: string,
  ) {
    try {
      this.logger.log(
        `Adding comment interaction for user ${userId}, object ${objectId}`,
      );

      // First ensure user exists
      await this.ensureUserExists(userId);

      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
        WITH u, i, COALESCE(i.commented, {}) as currentCommented
        
        // Handle the case where the object doesn't exist yet
        WITH u, i, currentCommented,
             CASE 
               WHEN $objectId IN keys(currentCommented) THEN currentCommented[$objectId]
               ELSE { type: $objectType, commentIds: [] }
             END as existingComment
        
        // Handle the case where commentIds is null
        WITH u, i, currentCommented, existingComment,
             CASE 
               WHEN existingComment.commentIds IS NULL THEN []
               ELSE existingComment.commentIds
             END as existingCommentIds
        
        // Create updated comment object
        WITH u, i, currentCommented, 
             {
               type: $objectType,
               commentIds: existingCommentIds + $commentId,
               lastCommentTimestamp: datetime()
             } as updatedComment
        
        // Update the interaction node
        SET i.commented = currentCommented + { $objectId: updatedComment }
        
        RETURN i.commented[$objectId] as commentInteraction
      `;

      const result = await this.neo4jService.write(query, {
        userId,
        objectId,
        objectType,
        commentId,
      });

      return result.records[0]?.get('commentInteraction') || null;
    } catch (error) {
      this.logger.error(
        `Error adding comment interaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getInteractions(userId: string) {
    try {
      this.logger.log(`Getting all interactions for user ${userId}`);

      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
        RETURN i
      `;

      const result = await this.neo4jService.read(query, { userId });
      const interactions =
        result.records.length > 0 ? result.records[0].get('i')?.properties : {};

      this.logger.log(`Retrieved interactions for user ${userId}`);
      return interactions || {};
    } catch (error) {
      this.logger.error(
        `Error getting interactions: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  async getInteractedObjects(userId: string, interactionType: string) {
    try {
      this.logger.log(`Getting ${interactionType} objects for user ${userId}`);

      const query = `
        MATCH (u:User {sub: $userId})
        OPTIONAL MATCH (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)
        RETURN CASE WHEN i IS NOT NULL AND i[$interactionType] IS NOT NULL 
                   THEN keys(i[$interactionType]) 
                   ELSE [] 
               END as objectIds
      `;

      const result = await this.neo4jService.read(query, {
        userId,
        interactionType,
      });

      const objectIds = result.records[0]?.get('objectIds') || [];
      this.logger.log(
        `Retrieved ${objectIds.length} ${interactionType} objects for user ${userId}`,
      );

      return objectIds;
    } catch (error) {
      this.logger.error(
        `Error getting interacted objects: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  // Helper method to ensure user exists before setting preferences
  private async ensureUserExists(userId: string): Promise<void> {
    try {
      this.logger.log(`Ensuring user ${userId} exists`);

      const query = `
        MERGE (u:User {sub: $userId})
        RETURN u
      `;

      await this.neo4jService.write(query, { userId });
      this.logger.log(`Confirmed user ${userId} exists`);
    } catch (error) {
      this.logger.error(
        `Error ensuring user exists: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
