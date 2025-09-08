// src/neo4j/schemas/discussion.schema.ts - SIMPLIFIED CONTAINER

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

export interface DiscussionData {
  id: string;
  createdBy: string;
  associatedNodeId: string;
  associatedNodeType: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DiscussionSchema {
  private readonly logger = new Logger(DiscussionSchema.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  private standardError(operation: string, error: any): Error {
    return new Error(`Failed to ${operation} Discussion: ${error.message}`);
  }

  async createDiscussion(discussionData: {
    id: string;
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
  }): Promise<DiscussionData> {
    this.logger.log(`Creating discussion: ${discussionData.id}`);

    try {
      const result = await this.neo4jService.write(
        `
        CREATE (d:DiscussionNode {
          id: $id,
          createdBy: $createdBy,
          associatedNodeId: $associatedNodeId,
          associatedNodeType: $associatedNodeType,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN d
        `,
        discussionData,
      );

      const createdDiscussion = result.records[0].get('d').properties;
      this.logger.log(`Successfully created discussion: ${discussionData.id}`);

      return {
        id: createdDiscussion.id,
        createdBy: createdDiscussion.createdBy,
        associatedNodeId: createdDiscussion.associatedNodeId,
        associatedNodeType: createdDiscussion.associatedNodeType,
        createdAt: createdDiscussion.createdAt,
        updatedAt: createdDiscussion.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error creating discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create', error);
    }
  }

  async getDiscussion(id: string): Promise<DiscussionData | null> {
    if (!id || id.trim() === '') {
      throw new Error('Discussion ID is required');
    }

    this.logger.debug(`Getting discussion: ${id}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $id})
        RETURN d
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.debug(`Discussion not found: ${id}`);
        return null;
      }

      const discussionNode = result.records[0].get('d').properties;
      return {
        id: discussionNode.id,
        createdBy: discussionNode.createdBy,
        associatedNodeId: discussionNode.associatedNodeId,
        associatedNodeType: discussionNode.associatedNodeType,
        createdAt: discussionNode.createdAt,
        updatedAt: discussionNode.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error getting discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get', error);
    }
  }

  async updateDiscussion(
    id: string,
    updateData: Partial<DiscussionData>,
  ): Promise<DiscussionData> {
    if (!id || id.trim() === '') {
      throw new Error('Discussion ID is required');
    }

    this.logger.debug(`Updating discussion: ${id}`);

    try {
      const setClause = Object.keys(updateData)
        .filter((key) => key !== 'id') // Don't update the ID
        .map((key) => `d.${key} = $updateData.${key}`)
        .join(', ');

      const result = await this.neo4jService.write(
        `
        MATCH (d:DiscussionNode {id: $id})
        SET ${setClause}, d.updatedAt = datetime()
        RETURN d
        `,
        { id, updateData },
      );

      if (result.records.length === 0) {
        throw new Error(`Discussion with ID ${id} not found`);
      }

      const updatedDiscussion = result.records[0].get('d').properties;
      return {
        id: updatedDiscussion.id,
        createdBy: updatedDiscussion.createdBy,
        associatedNodeId: updatedDiscussion.associatedNodeId,
        associatedNodeType: updatedDiscussion.associatedNodeType,
        createdAt: updatedDiscussion.createdAt,
        updatedAt: updatedDiscussion.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error updating discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update', error);
    }
  }

  async deleteDiscussion(id: string): Promise<{ success: boolean }> {
    if (!id || id.trim() === '') {
      throw new Error('Discussion ID is required');
    }

    this.logger.debug(`Deleting discussion: ${id}`);

    try {
      // Delete discussion and cascade to comments
      await this.neo4jService.write(
        `
        MATCH (d:DiscussionNode {id: $id})
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        DETACH DELETE d, c
        `,
        { id },
      );

      this.logger.log(`Successfully deleted discussion: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error deleting discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('delete', error);
    }
  }

  async getDiscussionsByAssociatedNode(
    nodeId: string,
    nodeType: string,
  ): Promise<DiscussionData[]> {
    if (!nodeId || !nodeType) {
      throw new Error('Node ID and type are required');
    }

    this.logger.debug(`Getting discussions for ${nodeType}: ${nodeId}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {associatedNodeId: $nodeId, associatedNodeType: $nodeType})
        RETURN d
        ORDER BY d.createdAt DESC
        `,
        { nodeId, nodeType },
      );

      return result.records.map((record) => {
        const discussion = record.get('d').properties;
        return {
          id: discussion.id,
          createdBy: discussion.createdBy,
          associatedNodeId: discussion.associatedNodeId,
          associatedNodeType: discussion.associatedNodeType,
          createdAt: discussion.createdAt,
          updatedAt: discussion.updatedAt,
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting discussions for node: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get discussions for node', error);
    }
  }

  async getDiscussionCommentCount(id: string): Promise<number> {
    if (!id || id.trim() === '') {
      throw new Error('Discussion ID is required');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $id})-[:HAS_COMMENT]->(c:CommentNode)
        RETURN COUNT(c) as commentCount
        `,
        { id },
      );

      return parseInt(result.records[0].get('commentCount').toString());
    } catch (error) {
      this.logger.error(
        `Error getting comment count: ${error.message}`,
        error.stack,
      );
      return 0; // Return 0 on error rather than throwing
    }
  }

  // ❌ REMOVED: All voting methods - discussions don't need voting
  // - voteDiscussion()
  // - getDiscussionVoteStatus()
  // - removeDiscussionVote()
  // - getDiscussionVotes()

  // ❌ REMOVED: All visibility methods - discussions don't need user visibility preferences
  // - setVisibilityStatus()
  // - getVisibilityStatus()
}
