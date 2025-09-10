// src/neo4j/schemas/discussion.schema.ts - FIXED VALIDATION ISSUES

import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { Record } from 'neo4j-driver';

// Discussion-specific data interface extending BaseNodeData
export interface DiscussionData extends BaseNodeData {
  createdBy: string;
  associatedNodeId: string; // The node this discussion is attached to
  associatedNodeType: string; // Type: WordNode, DefinitionNode, etc.
}

@Injectable()
export class DiscussionSchema extends BaseNodeSchema<DiscussionData> {
  protected readonly nodeLabel = 'DiscussionNode';
  protected readonly idField = 'id'; // Discussions use standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, DiscussionSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return false; // Discussions don't support content voting
  }

  protected mapNodeFromRecord(record: Record): DiscussionData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      associatedNodeId: props.associatedNodeId,
      associatedNodeType: props.associatedNodeType,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Discussions don't have any voting
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0,
      inclusionNetVotes: 0,
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<DiscussionData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id') // Don't update the id field
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:DiscussionNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // DISCUSSION-SPECIFIC METHODS - Keep all unique container functionality

  async createDiscussion(discussionData: {
    id: string;
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
  }): Promise<DiscussionData> {
    // ✅ FIXED: Proper validation with BadRequestException
    if (!discussionData.id || discussionData.id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }
    if (!discussionData.createdBy || discussionData.createdBy.trim() === '') {
      throw new BadRequestException('Created by is required');
    }
    if (
      !discussionData.associatedNodeId ||
      discussionData.associatedNodeId.trim() === ''
    ) {
      throw new BadRequestException('Associated node ID is required');
    }
    if (
      !discussionData.associatedNodeType ||
      discussionData.associatedNodeType.trim() === ''
    ) {
      throw new BadRequestException('Associated node type is required');
    }

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
          updatedAt: datetime(),
          // Discussions don't have voting
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0
        })
        RETURN d as n
        `,
        discussionData,
      );

      const createdDiscussion = this.mapNodeFromRecord(result.records[0]);
      this.logger.log(`Successfully created discussion: ${discussionData.id}`);
      return createdDiscussion;
    } catch (error) {
      this.logger.error(
        `Error creating discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create discussion', error);
    }
  }

  async getDiscussionsByAssociatedNode(
    nodeId: string,
    nodeType: string,
  ): Promise<DiscussionData[]> {
    // ✅ FIXED: Proper validation with BadRequestException
    if (!nodeId || nodeId.trim() === '') {
      throw new BadRequestException('Node ID is required');
    }
    if (!nodeType || nodeType.trim() === '') {
      throw new BadRequestException('Node type is required');
    }

    this.logger.debug(`Getting discussions for ${nodeType}: ${nodeId}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {associatedNodeId: $nodeId, associatedNodeType: $nodeType})
        RETURN d as n
        ORDER BY d.createdAt DESC
        `,
        { nodeId, nodeType },
      );

      return result.records.map((record) => {
        const discussion = record.get('n').properties;
        return {
          id: discussion.id,
          createdBy: discussion.createdBy,
          associatedNodeId: discussion.associatedNodeId,
          associatedNodeType: discussion.associatedNodeType,
          createdAt: discussion.createdAt,
          updatedAt: discussion.updatedAt,
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
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
    // ✅ FIXED: Proper validation with BadRequestException
    if (!id || id.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $id})-[:HAS_COMMENT]->(c:CommentNode)
        RETURN COUNT(c) as commentCount
        `,
        { id }, // ✅ FIXED: Parameter name should be 'id', not 'discussionId'
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

  // ✅ INHERITED FROM BaseNodeSchema (No need to implement):
  // - findById() -> replaces getDiscussion()
  // - update() -> replaces updateDiscussion()
  // - delete() -> replaces deleteDiscussion()
  // - Standard validation, error handling, Neo4j utilities
  // - voteInclusion() and voteContent() will throw BadRequestException automatically because supportsContentVoting() = false

  // ❌ INTENTIONALLY REMOVED (handled by VisibilityService):
  // - setVisibilityStatus()
  // - getVisibilityStatus()
}
