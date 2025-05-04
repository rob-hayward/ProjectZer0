// src/neo4j/schemas/comment.schema.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { TEXT_LIMITS } from '../../constants/validation';
import { VoteSchema } from './vote.schema';
import type { VoteStatus, VoteResult } from './vote.schema';
import { NotFoundException, Logger } from '@nestjs/common';

@Injectable()
export class CommentSchema {
  private readonly logger = new Logger(CommentSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
  ) {}

  async createComment(commentData: {
    id: string;
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }) {
    if (commentData.commentText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    console.log(
      `Creating comment with data:`,
      JSON.stringify(commentData, null, 2),
    );
    const query = `
      MATCH (d:DiscussionNode {id: $discussionId})
      CREATE (c:CommentNode {
        id: $id,
        createdBy: $createdBy,
        commentText: $commentText,
        createdAt: datetime(),
        updatedAt: datetime(),
        positiveVotes: 0,
        negativeVotes: 0,
        netVotes: 0,
        visibilityStatus: true
      })
      CREATE (d)-[:HAS_COMMENT]->(c)
      WITH c, d
      OPTIONAL MATCH (parent:CommentNode {id: $parentCommentId})
      FOREACH (p IN CASE WHEN parent IS NOT NULL THEN [1] ELSE [] END |
        CREATE (parent)-[:HAS_REPLY]->(c)
      )
      RETURN c
    `;
    const result = await this.neo4jService.write(query, {
      ...commentData,
      parentCommentId: commentData.parentCommentId || null,
    });
    const createdComment = result.records[0].get('c').properties;
    console.log(`Created comment:`, JSON.stringify(createdComment, null, 2));
    return createdComment;
  }

  async getComment(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (c:CommentNode {id: $id})
      RETURN c
      `,
      { id },
    );
    return result.records.length > 0
      ? result.records[0].get('c').properties
      : null;
  }

  async updateComment(
    id: string,
    updateData: {
      commentText?: string;
    },
  ) {
    if (
      updateData.commentText &&
      updateData.commentText.length > TEXT_LIMITS.MAX_COMMENT_LENGTH
    ) {
      throw new BadRequestException(
        `Comment text must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }

    const result = await this.neo4jService.write(
      `
      MATCH (c:CommentNode {id: $id})
      SET c += $updateData, c.updatedAt = datetime()
      RETURN c
      `,
      { id, updateData },
    );
    return result.records[0].get('c').properties;
  }

  async deleteComment(id: string) {
    await this.neo4jService.write(
      `
      MATCH (c:CommentNode {id: $id})
      DETACH DELETE c
      `,
      { id },
    );
  }

  async getCommentsByDiscussionId(discussionId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
      RETURN c
      ORDER BY c.createdAt ASC
      `,
      { discussionId },
    );
    return result.records.map((record) => record.get('c').properties);
  }

  async getCommentsByDiscussionIdWithSorting(
    discussionId: string,
    sortBy: 'popularity' | 'newest' | 'oldest' = 'popularity',
  ): Promise<any[]> {
    let orderByClause: string;

    switch (sortBy) {
      case 'popularity':
        orderByClause = 'ORDER BY c.netVotes DESC, c.createdAt DESC';
        break;
      case 'newest':
        orderByClause = 'ORDER BY c.createdAt DESC';
        break;
      case 'oldest':
        orderByClause = 'ORDER BY c.createdAt ASC';
        break;
      default:
        orderByClause = 'ORDER BY c.netVotes DESC, c.createdAt DESC';
    }

    const result = await this.neo4jService.read(
      `
      MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
      WITH c
      OPTIONAL MATCH (c)<-[:HAS_REPLY*]-(parent:CommentNode)
      WITH c, collect(parent) as parents
      RETURN c {
        .*,
        isRootComment: size(parents) = 0,
        parentCommentId: CASE WHEN size(parents) > 0 THEN parents[0].id ELSE null END
      } as comment
      ${orderByClause}
      `,
      { discussionId },
    );

    return result.records.map((record) => record.get('comment'));
  }

  async getRepliesForComment(commentId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (c:CommentNode {id: $commentId})-[:HAS_REPLY]->(reply:CommentNode)
      RETURN reply
      ORDER BY reply.createdAt ASC
      `,
      { commentId },
    );
    return result.records.map((record) => record.get('reply').properties);
  }

  async getCommentHierarchy(discussionId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (d:DiscussionNode {id: $discussionId})-[:HAS_COMMENT]->(c:CommentNode)
      OPTIONAL MATCH (c)-[:HAS_REPLY*]->(reply:CommentNode)
      RETURN c, collect(reply) as replies
      ORDER BY c.createdAt ASC
      `,
      { discussionId },
    );
    return result.records.map((record) => ({
      comment: record.get('c').properties,
      replies: record.get('replies').map((r) => r.properties),
    }));
  }

  async setVisibilityStatus(commentId: string, isVisible: boolean) {
    const result = await this.neo4jService.write(
      `
      MATCH (c:CommentNode {id: $commentId})
      SET c.visibilityStatus = $isVisible,
          c.updatedAt = datetime()
      RETURN c
      `,
      { commentId, isVisible },
    );
    return result.records[0].get('c').properties;
  }

  async getVisibilityStatus(commentId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (c:CommentNode {id: $commentId})
      RETURN c.visibilityStatus
      `,
      { commentId },
    );
    return result.records[0]?.get('c.visibilityStatus') ?? true;
  }

  // Add new methods for vote handling
  async voteComment(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    return this.voteSchema.vote('CommentNode', { id }, sub, isPositive);
  }

  async getCommentVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    return this.voteSchema.getVoteStatus('CommentNode', { id }, sub);
  }

  async removeCommentVote(id: string, sub: string): Promise<VoteResult> {
    return this.voteSchema.removeVote('CommentNode', { id }, sub);
  }

  async getCommentVotes(id: string): Promise<VoteResult | null> {
    try {
      const voteStatus = await this.voteSchema.getVoteStatus(
        'CommentNode',
        { id },
        '', // Empty string as we don't need user-specific status
      );

      if (!voteStatus) {
        return null;
      }

      return {
        positiveVotes: voteStatus.positiveVotes,
        negativeVotes: voteStatus.negativeVotes,
        netVotes: voteStatus.netVotes,
      };
    } catch (error) {
      this.logger.error(
        `Error getting votes for comment ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get comment votes: ${error.message}`);
    }
  }

  async updateVisibilityBasedOnVotes(
    commentId: string,
    voteThreshold: number = -5,
  ): Promise<boolean> {
    try {
      this.logger.debug(
        `Updating visibility based on votes for comment ${commentId}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (c:CommentNode {id: $commentId})
        WITH c, c.netVotes < $voteThreshold as shouldHide
        SET c.visibilityStatus = NOT shouldHide,
            c.updatedAt = datetime()
        RETURN c.visibilityStatus as visibilityStatus
        `,
        { commentId, voteThreshold },
      );

      if (!result.records || result.records.length === 0) {
        this.logger.warn(
          `Comment not found for visibility update: ${commentId}`,
        );
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      const visibilityStatus = result.records[0].get('visibilityStatus');
      this.logger.debug(
        `Updated comment ${commentId} visibility status to: ${visibilityStatus} based on votes`,
      );
      return visibilityStatus;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error updating visibility based on votes for comment ${commentId}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to update comment visibility based on votes: ${error.message}`,
      );
    }
  }
}
