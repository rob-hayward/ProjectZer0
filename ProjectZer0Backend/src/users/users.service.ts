import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Injectable()
export class UsersService {
  constructor(private neo4jService: Neo4jService) {}

  async findOrCreateUser(auth0Id: string, email: string): Promise<any> {
    const session = this.neo4jService.getWriteSession();
    try {
      const result = await session.run(
        `
        MERGE (u:User {auth0Id: $auth0Id})
        ON CREATE SET u.email = $email, u.createdAt = datetime()
        ON MATCH SET u.lastLogin = datetime()
        RETURN u
        `,
        { auth0Id, email },
      );
      return result.records[0].get('u').properties;
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw new Error('Failed to find or create user');
    } finally {
      await session.close();
    }
  }

  async testConnection(): Promise<string> {
    try {
      return await this.neo4jService.testConnection();
    } catch (error) {
      console.error('Error in testConnection:', error);
      throw new Error('Failed to test database connection');
    }
  }

  async getAllUsers(): Promise<any[]> {
    const session = this.neo4jService.getReadSession();
    try {
      const result = await session.run('MATCH (u:User) RETURN u');
      return result.records.map((record) => record.get('u').properties);
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw new Error('Failed to retrieve users');
    } finally {
      await session.close();
    }
  }

  async getUserByAuth0Id(auth0Id: string): Promise<any> {
    const session = this.neo4jService.getReadSession();
    try {
      const result = await session.run(
        'MATCH (u:User {auth0Id: $auth0Id}) RETURN u',
        { auth0Id },
      );
      if (result.records.length === 0) {
        return null;
      }
      return result.records[0].get('u').properties;
    } catch (error) {
      console.error('Error in getUserByAuth0Id:', error);
      throw new Error('Failed to retrieve user');
    } finally {
      await session.close();
    }
  }
}
