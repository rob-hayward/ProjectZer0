// src/neo4j/schemas/discussion.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class DiscussionSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async createDiscussion(discussionData: {
    id: string;
    createdBy: string;
    associatedNodeId: string;
    associatedNodeType: string;
  }) {
    const result = await this.neo4jService.write(
      `
      MATCH (n)
      WHERE n.id = $associatedNodeId AND (n:BeliefNode OR n:WordNode)
      CREATE (d:DiscussionNode {
        id: $id,
        createdBy: $createdBy,
        createdAt: datetime(),
        updatedAt: datetime(),
        visibilityStatus: true
      })
      CREATE (n)-[:HAS_DISCUSSION]->(d)
      RETURN d
      `,
      discussionData,
    );
    return result.records[0].get('d').properties;
  }

  async getDiscussion(id: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (d:DiscussionNode {id: $id})
      RETURN d
      `,
      { id },
    );
    return result.records.length > 0
      ? result.records[0].get('d').properties
      : null;
  }

  async updateDiscussion(id: string, updateData: any) {
    const result = await this.neo4jService.write(
      `
      MATCH (d:DiscussionNode {id: $id})
      SET d += $updateData, d.updatedAt = datetime()
      RETURN d
      `,
      { id, updateData },
    );
    return result.records[0].get('d').properties;
  }

  async deleteDiscussion(id: string) {
    await this.neo4jService.write(
      `
      MATCH (d:DiscussionNode {id: $id})
      DETACH DELETE d
      `,
      { id },
    );
  }

  async setVisibilityStatus(discussionId: string, isVisible: boolean) {
    const result = await this.neo4jService.write(
      `
      MATCH (d:DiscussionNode {id: $discussionId})
      SET d.visibilityStatus = $isVisible,
          d.updatedAt = datetime()
      RETURN d
      `,
      { discussionId, isVisible },
    );
    return result.records[0].get('d').properties;
  }

  async getVisibilityStatus(discussionId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (d:DiscussionNode {id: $discussionId})
      RETURN d.visibilityStatus
      `,
      { discussionId },
    );
    return result.records[0]?.get('d.visibilityStatus') ?? true;
  }
}
