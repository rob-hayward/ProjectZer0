import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { Auth0UserProfile, UserProfile } from './user.model';

@Injectable()
export class UsersService {
  constructor(private neo4jService: Neo4jService) {}

  async findOrCreateUser(
    auth0Profile: Auth0UserProfile,
  ): Promise<{ user: UserProfile; isNewUser: boolean }> {
    try {
      // First, try to find the user
      const findResult = await this.neo4jService.run(
        `
        MATCH (u:User {auth0Id: $sub})
        RETURN u
        `,
        { sub: auth0Profile.sub },
      );

      if (findResult.records.length > 0) {
        // User exists, return the existing user
        const existingUser: UserProfile =
          findResult.records[0].get('u').properties;
        return { user: existingUser, isNewUser: false };
      } else {
        // User doesn't exist, create a new user
        const createResult = await this.neo4jService.run(
          `
          CREATE (u:User {
            auth0Id: $sub,
            email: $email,
            emailVerified: $email_verified,
            name: $name,
            nickname: $nickname,
            picture: $picture,
            lastUpdatedAtAuth0: datetime($updated_at),
            createdAt: datetime()
          })
          RETURN u
          `,
          auth0Profile,
        );

        const newUser: UserProfile =
          createResult.records[0].get('u').properties;
        return { user: newUser, isNewUser: true };
      }
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw new Error('Failed to find or create user');
    }
  }
}
