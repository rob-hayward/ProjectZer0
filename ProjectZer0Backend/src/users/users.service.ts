import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Injectable()
export class UsersService {
  constructor(private neo4jService: Neo4jService) {}

  async findOrCreateUser(
    auth0Id: string,
    email: string,
  ): Promise<{ user: any; isNewUser: boolean }> {
    try {
      const result = await this.neo4jService.write(
        `
        MERGE (u:User {auth0Id: $auth0Id})
        ON CREATE SET u.email = $email, u.createdAt = datetime()
        ON MATCH SET u.lastLogin = datetime()
        RETURN u, u.createdAt = datetime() as isNewUser
        `,
        { auth0Id, email },
      );
      const user = result.records[0].get('u').properties;
      const isNewUser = result.records[0].get('isNewUser');
      return { user, isNewUser };
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw new Error('Failed to find or create user');
    }
  }

  async checkUserExists(auth0Id: string): Promise<boolean> {
    try {
      const result = await this.neo4jService.run(
        'MATCH (u:User {auth0Id: $auth0Id}) RETURN u',
        { auth0Id },
      );
      return result.records.length > 0;
    } catch (error) {
      console.error('Error in checkUserExists:', error);
      throw new Error('Failed to check user existence');
    }
  }
}
