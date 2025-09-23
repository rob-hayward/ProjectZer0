// src/neo4j/schemas/comment.schema.ts - CONVERTED TO BaseNodeSchema

import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { TEXT_LIMITS } from '../../constants/validation';
import { Record } from 'neo4j-driver';

// Comment-specific data interface extending BaseNodeData
export interface CommentData extends BaseNodeData {
  createdBy: string;
  discussionId: string;
  commentText: string;
  parentCommentId?: string; // For hierarchical structure
}

@Injectable()
export class CommentSchema extends BaseNodeSchema<CommentData> {
  protected readonly nodeLabel = 'CommentNode';
  protected readonly idField = 'id'; // Comments use standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, CommentSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return true; // Comments support content voting (quality assessment)
  }

  protected mapNodeFromRecord(record: Record): CommentData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      discussionId: props.discussionId,
      commentText: props.commentText,
      parentCommentId: props.parentCommentId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Comments don't have inclusion voting (all comments are included by default)
      inclusionPositiveVotes: 0,
      inclusionNegativeVotes: 0,
      inclusionNetVotes: 0,
      // Comments have content voting for quality assessment
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNegativeVotes: this.toNumber(props.contentNegativeVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<CommentData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id') // Don't update the id field
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:CommentNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // COMMENT-SPECIFIC METHODS - Keep all unique functionality

  async createComment(commentData: {
    id: string;
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }): Promise<CommentData> {
    // Validate comment text length
    if (commentData.commentText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    this.logger.debug(`Creating comment: ${commentData.id}`);

    try {
      const query = `
        MATCH (d:DiscussionNode {id: $discussionId})
        CREATE (c:CommentNode {
          id: $id,
          createdBy: $createdBy,
          discussionId: $discussionId,
          commentText: $commentText,
          parentCommentId: $parentCommentId,
          createdAt: datetime(),
          updatedAt: datetime(),
          // Content voting only (no inclusion voting)
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
        CREATE (d)-[:HAS_COMMENT]->(c)
        WITH c
        OPTIONAL MATCH (parent:CommentNode {id: $parentCommentId})
        FOREACH (p IN CASE WHEN parent IS NOT NULL THEN [1] ELSE [] END |
          CREATE (parent)-[:HAS_REPLY]->(c)
        )
        RETURN c
      `;

      const queryParams = {
        ...commentData,
        parentCommentId: commentData.parentCommentId || null,
      };

      const result = await this.neo4jService.write(query, queryParams);
      const createdComment = this.mapNodeFromRecord(result.records[0]);

      this.logger.log(`Successfully created comment: ${commentData.id}`);

      if (commentData.parentCommentId) {
        this.logger.debug(
          `Reply comment created with parent: ${commentData.parentCommentId}`,
        );
      }

      return createdComment;
    } catch (error) {
      this.logger.error(
        `Error creating comment: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create comment', error);
    }
  }

  async getCommentsByDiscussionId(
    discussionId: string,
  ): Promise<CommentData[]> {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(`Getting comments for discussion: ${discussionId}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
        RETURN c
        ORDER BY c.createdAt ASC
        `,
        { discussionId },
      );

      const comments = result.records.map((record) => {
        return this.mapNodeFromRecord(record);
      });

      this.logger.debug(
        `Retrieved ${comments.length} comments for discussion: ${discussionId}`,
      );
      return comments;
    } catch (error) {
      this.logger.error(
        `Error getting comments for discussion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get comments for discussion', error);
    }
  }

  async getRepliesForComment(commentId: string): Promise<CommentData[]> {
    if (!commentId || commentId.trim() === '') {
      throw new BadRequestException('Comment ID is required');
    }

    this.logger.debug(`Getting replies for comment: ${commentId}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (reply:CommentNode)
        WHERE reply.parentCommentId = $commentId
        RETURN reply
        ORDER BY reply.createdAt ASC
        `,
        { commentId },
      );

      const replies = result.records.map((record) => {
        // Need to adjust the record mapping since we're selecting 'reply', not 'n'
        const adjustedRecord = {
          get: (key: string) => {
            if (key === 'n') {
              return record.get('reply');
            }
            return record.get(key);
          },
        } as Record;
        return this.mapNodeFromRecord(adjustedRecord);
      });

      this.logger.debug(
        `Retrieved ${replies.length} replies for comment: ${commentId}`,
      );
      return replies;
    } catch (error) {
      this.logger.error(
        `Error getting replies for comment: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get replies for comment', error);
    }
  }

  async getCommentHierarchy(discussionId: string): Promise<
    {
      comment: CommentData;
      replies: CommentData[];
    }[]
  > {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    this.logger.debug(
      `Getting comment hierarchy for discussion: ${discussionId}`,
    );

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
        WHERE c.parentCommentId IS NULL
        OPTIONAL MATCH (reply:CommentNode)
        WHERE reply.parentCommentId = c.id
        RETURN c, collect(reply) as replies
        ORDER BY c.createdAt ASC
        `,
        { discussionId },
      );

      const hierarchy = result.records.map((record) => {
        // Map the main comment
        const commentRecord = {
          get: (key: string) => {
            if (key === 'n') {
              return record.get('c');
            }
            return record.get(key);
          },
        } as Record;
        const comment = this.mapNodeFromRecord(commentRecord);

        // Map the replies
        const replyNodes = record.get('replies');
        const replies = replyNodes.map((replyNode: any) => {
          const replyRecord = {
            get: (key: string) => {
              if (key === 'n') {
                return { properties: replyNode.properties };
              }
              return null;
            },
          } as Record;
          return this.mapNodeFromRecord(replyRecord);
        });

        return { comment, replies };
      });

      this.logger.debug(
        `Retrieved comment hierarchy with ${hierarchy.length} root comments`,
      );
      return hierarchy;
    } catch (error) {
      this.logger.error(
        `Error getting comment hierarchy: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get comment hierarchy', error);
    }
  }

  async getCommentCount(discussionId: string): Promise<number> {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
        RETURN COUNT(c) as count
        `,
        { discussionId },
      );

      return this.toNumber(result.records[0].get('count'));
    } catch (error) {
      this.logger.error(
        `Error getting comment count: ${error.message}`,
        error.stack,
      );
      return 0; // Return 0 on error rather than throwing
    }
  }

  // ❌ REMOVED: All voting methods now inherited from BaseNodeSchema
  // - voteComment() -> use inherited voteContent()
  // - getCommentVoteStatus() -> use inherited getVoteStatus()
  // - removeCommentVote() -> use inherited removeVote()
  // - getCommentVotes() -> use inherited getVotes()

  // ❌ REMOVED: All visibility methods now delegated to VisibilityService
  // - setVisibilityStatus() -> VisibilityService.setUserVisibilityPreference()
  // - getVisibilityStatus() -> VisibilityService.getObjectVisibility()

  // ❌ REMOVED: Legacy voting methods that bypassed VoteSchema
  // - updateVisibilityBasedOnVotes() -> handled by VisibilityService
  // - getUserCommentVotes() -> use inherited getVoteStatus() per comment

  /**
   * Check if a comment can be edited (by original author within time limit)
   */
  async canEditComment(commentId: string, userId: string): Promise<boolean> {
    try {
      const comment = await this.findById(commentId);
      if (!comment) return false;

      // Only original author can edit
      if (comment.createdBy !== userId) return false;

      // Check if within edit time limit (e.g., 15 minutes)
      const EDIT_TIME_LIMIT_MINUTES = 15;
      const createdAt = new Date(comment.createdAt);
      const now = new Date();
      const timeDiff = now.getTime() - createdAt.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      return minutesDiff <= EDIT_TIME_LIMIT_MINUTES;
    } catch (error) {
      this.logger.error(
        `Error checking edit permission: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Update comment text (with edit restrictions)
   */
  async updateCommentText(
    commentId: string,
    userId: string,
    newText: string,
  ): Promise<CommentData> {
    if (newText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    const canEdit = await this.canEditComment(commentId, userId);
    if (!canEdit) {
      throw new BadRequestException('Comment cannot be edited');
    }

    try {
      const updatedComment = await this.update(commentId, {
        commentText: newText,
      });

      if (!updatedComment) {
        throw new Error(`Comment with ID ${commentId} not found`);
      }

      this.logger.log(`Updated comment text: ${commentId}`);
      return updatedComment;
    } catch (error) {
      this.logger.error(
        `Error updating comment text: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update comment text', error);
    }
  }

  /**
   * Get comment statistics for a discussion
   */
  async getDiscussionCommentStats(discussionId: string): Promise<{
    totalComments: number;
    rootComments: number;
    replies: number;
    averageContentScore: number;
  }> {
    if (!discussionId || discussionId.trim() === '') {
      throw new BadRequestException('Discussion ID is required');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
        RETURN 
          COUNT(c) as totalComments,
          COUNT(CASE WHEN c.parentCommentId IS NULL THEN 1 END) as rootComments,
          COUNT(CASE WHEN c.parentCommentId IS NOT NULL THEN 1 END) as replies,
          AVG(c.contentNetVotes) as averageContentScore
        `,
        { discussionId },
      );

      const record = result.records[0];
      return {
        totalComments: this.toNumber(record.get('totalComments')),
        rootComments: this.toNumber(record.get('rootComments')),
        replies: this.toNumber(record.get('replies')),
        averageContentScore: this.toNumber(record.get('averageContentScore')),
      };
    } catch (error) {
      this.logger.error(
        `Error getting discussion comment stats: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get discussion comment stats', error);
    }
  }
}
