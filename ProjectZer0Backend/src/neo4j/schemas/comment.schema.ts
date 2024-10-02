// src/neo4j/schemas/comment.schema.ts

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
        negativeVotes: 0
      })
      CREATE (d)-[:HAS_COMMENT]->(c)
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

  async voteComment(id: string, voteType: 'positive' | 'negative') {
    const result = await this.neo4jService.write(
      `
      MATCH (c:CommentNode {id: $id})
      SET c.${voteType}Votes = c.${voteType}Votes + 1
      RETURN c
      `,
      { id },
    );
    return result.records[0].get('c').properties;
  }
}
