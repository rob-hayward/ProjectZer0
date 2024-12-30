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
      SET u.createdAt = datetime(),
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
    nodeType: 'word' | 'definition' | 'statement',
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MATCH (n {id: $nodeId})
      WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode
      CREATE (u)-[r:CREATED {
        createdAt: datetime(),
        type: $nodeType
      }]->(n)
      `,
      { userId, nodeId, nodeType },
    );
  }

  async getUserCreatedNodes(
    userId: string,
    nodeType?: 'word' | 'definition' | 'statement',
  ) {
    const query = nodeType
      ? `
        MATCH (u:User {sub: $userId})-[r:CREATED {type: $nodeType}]->(n)
        RETURN n
        ORDER BY r.createdAt DESC
        `
      : `
        MATCH (u:User {sub: $userId})-[r:CREATED]->(n)
        RETURN n, r.type as nodeType
        ORDER BY r.createdAt DESC
        `;

    const result = await this.neo4jService.read(query, { userId, nodeType });
    return result.records.map((record) => ({
      node: record.get('n').properties,
      type: nodeType || record.get('nodeType'),
    }));
  }

  async getUserActivityStats(userId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $userId})
      
      // Count nodes by type
      OPTIONAL MATCH (u)-[r:CREATED]->(n)
      WITH u, 
           toInteger(count(CASE WHEN r.type = 'word' THEN r END)) as wordCount,
           toInteger(count(CASE WHEN r.type = 'definition' THEN r END)) as definitionCount,
           toInteger(count(CASE WHEN r.type = 'statement' THEN r END)) as statementCount
      
      // Count votes
      OPTIONAL MATCH (u)-[v:VOTED_ON]->(target)
      WITH u, wordCount, definitionCount, statementCount,
           toInteger(count(v)) as voteCount
      
      // Get created node IDs by type
      OPTIONAL MATCH (u)-[cr:CREATED]->(createdNodes)
      WITH u, wordCount, definitionCount, statementCount, voteCount,
           collect({
             id: createdNodes.id,
             type: cr.type,
             createdAt: cr.createdAt
           }) as creations
      
      RETURN {
        nodesCreated: wordCount + definitionCount + statementCount,
        creationsByType: {
          word: wordCount,
          definition: definitionCount,
          statement: statementCount
        },
        votesCast: voteCount,
        createdNodes: creations
      } as stats
      `,
      { userId },
    );
    return result.records[0].get('stats');
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
