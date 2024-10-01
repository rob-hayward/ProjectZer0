// src/neo4j/schemas/user.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserProfile } from '../../users/user.model';

@Injectable()
export class UserSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  async findUser(sub: string): Promise<UserProfile | null> {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $sub})
      RETURN u
      `,
      { sub },
    );
    return result.records.length > 0
      ? (result.records[0].get('u').properties as UserProfile)
      : null;
  }

  async createUser(userProperties: UserProfile): Promise<UserProfile> {
    const result = await this.neo4jService.write(
      `
      CREATE (u:User $userProperties)
      SET u.totalNodesCreated = 0,
          u.totalParticipations = 0,
          u.createdAt = datetime(),
          u.lastLogin = datetime()
      RETURN u
      `,
      { userProperties },
    );
    return result.records[0].get('u').properties as UserProfile;
  }

  async updateUser(
    sub: string,
    updates: Partial<UserProfile>,
  ): Promise<UserProfile> {
    const result = await this.neo4jService.write(
      `
      MATCH (u:User {sub: $sub})
      SET u += $updates,
          u.updated_at = datetime()
      RETURN u
      `,
      { sub, updates },
    );
    return result.records[0].get('u').properties as UserProfile;
  }

  async addCreatedNode(
    userId: string,
    nodeId: string,
    nodeType: string,
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MATCH (n {id: $nodeId})
      CREATE (u)-[r:CREATED {createdAt: datetime(), type: $nodeType}]->(n)
      SET u.totalNodesCreated = COALESCE(u.totalNodesCreated, 0) + 1
      `,
      { userId, nodeId, nodeType },
    );
  }

  async addParticipation(
    userId: string,
    nodeId: string,
    participationType: 'voted' | 'commented',
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MATCH (n {id: $nodeId})
      MERGE (u)-[r:PARTICIPATED_IN]->(n)
      ON CREATE SET r.createdAt = datetime(), r.type = $participationType
      ON MATCH SET r.lastInteraction = datetime(), r.type = 
        CASE WHEN r.type = $participationType THEN r.type 
        ELSE 'both' END
      SET u.totalParticipations = COALESCE(u.totalParticipations, 0) + 1
      `,
      { userId, nodeId, participationType },
    );
  }

  async addUserPreference(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MERGE (p:UserPreference {key: $key})
      MERGE (u)-[r:HAS_PREFERENCE]->(p)
      SET p.value = $value, p.updatedAt = datetime()
      `,
      { userId, key, value },
    );
  }

  async getUserStats(userId: string): Promise<any> {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $userId})
      RETURN u.totalNodesCreated as nodesCreated,
             u.totalParticipations as participations,
             size((u)-[:CREATED]->()) as actualNodesCreated,
             size((u)-[:PARTICIPATED_IN]->()) as actualParticipations
      `,
      { userId },
    );
    return result.records[0].toObject();
  }

  async updateUserLogin(sub: string): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $sub})
      SET u.lastLogin = datetime()
      `,
      { sub },
    );
  }
}
