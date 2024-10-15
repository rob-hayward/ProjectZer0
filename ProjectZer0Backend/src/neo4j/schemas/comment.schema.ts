import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class CommentSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createComment(commentData: {
    id: string;
    createdBy: string;
    discussionId: string;
    commentText: string;
    parentCommentId?: string;
  }) {
    const result = await this.neo4jService.write(
      `
      MATCH (d:DiscussionNode {id: $discussionId})
      CREATE (c:CommentNode {
        id: $id,
        createdBy: $createdBy,
        commentText: $commentText,
        createdAt: datetime(),
        updatedAt: datetime(),
        positiveVotes: 0,
        negativeVotes: 0,
        visibilityStatus: true
      })
      CREATE (d)-[:HAS_COMMENT]->(c)
      WITH c, d
      OPTIONAL MATCH (parent:CommentNode {id: $parentCommentId})
      FOREACH (p IN CASE WHEN parent IS NOT NULL THEN [1] ELSE [] END |
        CREATE (parent)-[:HAS_REPLY]->(c)
      )
      RETURN c
      `,
      commentData,
    );
    return result.records[0].get('c').properties;
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
}
