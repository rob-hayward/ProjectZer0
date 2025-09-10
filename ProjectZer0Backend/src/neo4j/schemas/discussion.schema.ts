// src/neo4j/schemas/discussion.schema.ts - CONVERTED TO BaseNodeSchema

import { Injectable } from '@nestjs/common';
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
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0
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
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };
    } catch (error) {
      this.logger.error(
        `Error creating discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create', error);
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
