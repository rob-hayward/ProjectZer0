import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Injectable()
export class UsersService {
  constructor(private neo4jService: Neo4jService) {}

  async findOrCreateUser(auth0Id: string, email: string): Promise<any> {
    try {
      const result = await this.neo4jService.write(
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
    try {
      const result = await this.neo4jService.run('MATCH (u:User) RETURN u');
      return result.records.map((record) => record.get('u').properties);
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw new Error('Failed to retrieve users');
    }
  }

  async getUserByAuth0Id(auth0Id: string): Promise<any> {
    try {
      const result = await this.neo4jService.run(
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
    }
  }

  async updateUser(auth0Id: string, updateData: any): Promise<any> {
    try {
      const setString = Object.keys(updateData)
        .map((key) => `u.${key} = $${key}`)
        .join(', ');
      const result = await this.neo4jService.write(
        `MATCH (u:User {auth0Id: $auth0Id}) SET ${setString} RETURN u`,
        { auth0Id, ...updateData },
      );
      if (result.records.length === 0) {
        throw new Error('User not found');
      }
      return result.records[0].get('u').properties;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(auth0Id: string): Promise<boolean> {
    try {
      const result = await this.neo4jService.write(
        'MATCH (u:User {auth0Id: $auth0Id}) DELETE u',
        { auth0Id },
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw new Error('Failed to delete user');
    }
  }
}
