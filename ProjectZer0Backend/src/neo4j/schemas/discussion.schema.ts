// src/neo4j/schemas/discussion.schema.ts - REFACTORED

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { Record } from 'neo4j-driver';

/**
 * Discussion data interface
 */
export interface DiscussionData extends BaseNodeData {
  createdBy: string;
  associatedNodeId: string;
  associatedNodeType: string;
}

/**
 * Options for creating a discussion with an associated node
 */
export interface CreateDiscussionForNodeOptions {
  nodeId: string;
  nodeType: string;
  nodeIdField?: string; // 'id' or 'word' depending on node type
  createdBy: string;
  initialComment?: string;
}

/**
 * Result of discussion creation
 */
export interface DiscussionCreationResult {
  discussionId: string;
  commentId?: string;
}

/**
 * Schema for managing discussions and their relationships to content nodes.
 * Provides centralized discussion creation that can be used by any discussable node.
 */
@Injectable()
export class DiscussionSchema extends BaseNodeSchema<DiscussionData> {
  protected readonly nodeLabel = 'DiscussionNode';
  protected readonly idField = 'id';
  private readonly discussionLogger = new Logger('DiscussionSchema');

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, DiscussionSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return false; // Discussions don't support any voting
  }

  protected mapNodeFromRecord(record: Record): DiscussionData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit || false,
      associatedNodeId: props.associatedNodeId,
      associatedNodeType: props.associatedNodeType,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
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
      .filter((key) => key !== 'id')
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

  // ============================================
  // CENTRALIZED DISCUSSION CREATION
  // ============================================

  /**
   * Creates a discussion for any node type with optional initial comment.
   * This is the main method that should be called by other schemas.
   *
   * @param options Creation options including node details and optional initial comment
   * @returns The created discussion ID and optional comment ID
   */
  // src/neo4j/schemas/discussion.schema.ts
  // FIXED: Line 139-180 - Prevent duplicate discussions

  async createDiscussionForNode(
    options: CreateDiscussionForNodeOptions,
  ): Promise<DiscussionCreationResult> {
    // Validate inputs
    if (!options.nodeId || options.nodeId.trim() === '') {
      throw new BadRequestException(
        'Node ID is required for discussion creation',
      );
    }
    if (!options.nodeType || options.nodeType.trim() === '') {
      throw new BadRequestException(
        'Node type is required for discussion creation',
      );
    }
    if (!options.createdBy || options.createdBy.trim() === '') {
      throw new BadRequestException(
        'Creator is required for discussion creation',
      );
    }

    const discussionId = `discussion-${options.nodeId}-${Date.now()}`;
    const idField = options.nodeIdField || 'id';

    this.discussionLogger.log(
      `Creating discussion for ${options.nodeType} with ${idField}: ${options.nodeId}`,
    );

    try {
      // ✅ CRITICAL FIX: Check if discussion already exists
      const existingDiscussionId = await this.getDiscussionIdForNode(
        options.nodeType,
        options.nodeId,
        idField,
      );

      if (existingDiscussionId) {
        this.discussionLogger.warn(
          `Discussion already exists for ${options.nodeType}: ${options.nodeId}, returning existing: ${existingDiscussionId}`,
        );

        // If there's an initial comment, still create it
        let commentId: string | undefined;
        if (options.initialComment && options.initialComment.trim() !== '') {
          commentId = await this.createInitialComment(
            existingDiscussionId,
            options.createdBy,
            options.initialComment,
            options.nodeType,
            options.nodeId,
            idField,
          );
        }

        return {
          discussionId: existingDiscussionId,
          commentId,
        };
      }

      // ✅ FIXED: Use MERGE instead of CREATE for the relationship
      let query = `
      // Verify the node exists
      MATCH (n:${options.nodeType} {${idField}: $nodeId})
      
      // Create the discussion node
      CREATE (d:DiscussionNode {
        id: $discussionId,
        createdBy: $createdBy,
        associatedNodeId: $nodeId,
        associatedNodeType: $nodeType,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      
      // ✅ CRITICAL FIX: Use MERGE for HAS_DISCUSSION relationship
      // This prevents duplicate relationships even in race conditions
      MERGE (n)-[:HAS_DISCUSSION]->(d)
    `;

      const params: any = {
        nodeId: options.nodeId,
        nodeType: options.nodeType,
        discussionId,
        createdBy: options.createdBy,
      };

      let commentId: string | undefined;

      // Add initial comment if provided
      if (options.initialComment && options.initialComment.trim() !== '') {
        commentId = `comment-${discussionId}-${Date.now()}`;

        query += `
      // Create the initial comment
      CREATE (c:CommentNode {
        id: $commentId,
        createdBy: $createdBy,
        discussionId: $discussionId,
        commentText: $initialComment,
        parentCommentId: null,
        createdAt: datetime(),
        updatedAt: datetime(),
        // Comments only have content voting
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0
      })
      
      // Link comment to discussion
      CREATE (d)-[:HAS_COMMENT]->(c)
      
      // Link user to comment
      WITH d, c, n
      MATCH (u:User {sub: $createdBy})
      CREATE (u)-[:COMMENTED {
        createdAt: datetime(),
        commentId: c.id
      }]->(n)
      `;

        params.commentId = commentId;
        params.initialComment = options.initialComment;
      }

      query += `
      RETURN d.id as discussionId
    `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          `Failed to create discussion for ${options.nodeType}: Node may not exist`,
        );
      }

      this.discussionLogger.log(
        `Successfully created discussion ${discussionId} for ${options.nodeType}: ${options.nodeId}`,
      );

      return {
        discussionId: result.records[0].get('discussionId'),
        commentId,
      };
    } catch (error) {
      this.discussionLogger.error(
        `Error creating discussion for ${options.nodeType}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create discussion: ${error.message}`,
      );
    }
  }

  /**
   * ✅ NEW HELPER METHOD: Create initial comment for existing discussion
   */
  private async createInitialComment(
    discussionId: string,
    createdBy: string,
    commentText: string,
    nodeType: string,
    nodeId: string,
    idField: string,
  ): Promise<string> {
    const commentId = `comment-${discussionId}-${Date.now()}`;

    try {
      await this.neo4jService.write(
        `
      MATCH (d:DiscussionNode {id: $discussionId})
      MATCH (n:${nodeType} {${idField}: $nodeId})
      
      CREATE (c:CommentNode {
        id: $commentId,
        createdBy: $createdBy,
        discussionId: $discussionId,
        commentText: $commentText,
        parentCommentId: null,
        createdAt: datetime(),
        updatedAt: datetime(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0
      })
      
      CREATE (d)-[:HAS_COMMENT]->(c)
      
      WITH c, n
      MATCH (u:User {sub: $createdBy})
      CREATE (u)-[:COMMENTED {
        createdAt: datetime(),
        commentId: c.id
      }]->(n)
      
      RETURN c.id as commentId
      `,
        {
          discussionId,
          nodeId,
          commentId,
          createdBy,
          commentText,
        },
      );

      return commentId;
    } catch (error) {
      this.discussionLogger.error(
        `Error creating initial comment: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Gets the discussion ID for a given node if it exists
   *
   * @param nodeType The type/label of the node
   * @param nodeId The ID of the node
   * @param idField The field used as ID (default: 'id', but 'word' for WordNode)
   * @returns The discussion ID or null if no discussion exists
   */
  async getDiscussionIdForNode(
    nodeType: string,
    nodeId: string,
    idField: string = 'id',
  ): Promise<string | null> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (n:${nodeType} {${idField}: $nodeId})-[:HAS_DISCUSSION]->(d:DiscussionNode)
        RETURN d.id as discussionId
        `,
        { nodeId },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      return result.records[0].get('discussionId');
    } catch {
      this.discussionLogger.debug(
        `No discussion found for ${nodeType}: ${nodeId}`,
      );
      return null;
    }
  }

  /**
   * Checks if a node already has a discussion
   *
   * @param nodeType The type/label of the node
   * @param nodeId The ID of the node
   * @param idField The field used as ID
   * @returns True if the node has a discussion
   */
  async hasDiscussion(
    nodeType: string,
    nodeId: string,
    idField: string = 'id',
  ): Promise<boolean> {
    const discussionId = await this.getDiscussionIdForNode(
      nodeType,
      nodeId,
      idField,
    );
    return discussionId !== null;
  }

  // ============================================
  // LEGACY METHODS (kept for compatibility)
  // ============================================

  /**
   * Creates a standalone discussion not attached to any node.
   * This method is kept for backward compatibility but should not be used for new code.
   *
   * @deprecated Use createDiscussionForNode instead
   */
  async createStandaloneDiscussion(discussionData: {
    id: string;
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
  }): Promise<DiscussionData> {
    // Validation
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

    this.logger.log(`Creating standalone discussion: ${discussionData.id}`);

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

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Get all discussions for a specific node
   */
  async getDiscussionsByAssociatedNode(
    nodeId: string,
    nodeType: string,
  ): Promise<DiscussionData[]> {
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

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting discussions: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get discussions', error);
    }
  }

  /**
   * Get comment count for a discussion
   */
  async getDiscussionCommentCount(discussionId: string): Promise<number> {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $id})
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        RETURN COUNT(c) as commentCount
        `,
        { id: discussionId },
      );

      return this.toNumber(result.records[0].get('commentCount'));
    } catch (error) {
      this.logger.error(
        `Error getting comment count: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  /**
   * Get all comments for a discussion with hierarchical structure
   */
  async getDiscussionComments(discussionId: string): Promise<any[]> {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $id})
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        OPTIONAL MATCH (c)<-[:COMMENTED]-(u:User)
        RETURN c, u.sub as userId, u.username as username
        ORDER BY c.createdAt ASC
        `,
        { id: discussionId },
      );

      return result.records
        .map((record) => {
          const comment = record.get('c');
          if (!comment) return null;

          return {
            ...comment.properties,
            userId: record.get('userId'),
            username: record.get('username'),
          };
        })
        .filter((c) => c !== null);
    } catch (error) {
      this.logger.error(
        `Error getting discussion comments: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get comments', error);
    }
  }
}
