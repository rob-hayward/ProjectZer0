import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { UserProfile } from './user.model';

@Injectable()
export class UsersService {
  constructor(private neo4jService: Neo4jService) {}

  async findOrCreateUser(
    auth0Profile: any,
  ): Promise<{ user: UserProfile; isNewUser: boolean }> {
    try {
      console.log(
        'Auth0 profile received in UsersService:',
        JSON.stringify(auth0Profile, null, 2),
      );

      const profile = auth0Profile._json || auth0Profile;
      const sub = profile.sub || auth0Profile.id || auth0Profile.user_id;

      if (!sub) {
        throw new Error('No sub found in Auth0 profile');
      }

      console.log('Using sub:', sub);

      // First, try to find the user
      const findResult = await this.neo4jService.read(
        `
        MATCH (u:User {sub: $sub})
        RETURN u
        `,
        { sub },
      );

      if (findResult.records.length > 0) {
        // User exists, return the existing user
        const existingUser: UserProfile =
          findResult.records[0].get('u').properties;
        return { user: existingUser, isNewUser: false };
      } else {
        // User doesn't exist, create a new user
        const userProperties: UserProfile = {
          sub,
          name: profile.name || auth0Profile.displayName || null,
          given_name:
            profile.given_name || auth0Profile.name?.givenName || null,
          family_name:
            profile.family_name || auth0Profile.name?.familyName || null,
          middle_name: profile.middle_name || null,
          nickname: profile.nickname || auth0Profile.nickname || null,
          preferred_username: profile.preferred_username || null,
          profile: profile.profile || null,
          picture: profile.picture || auth0Profile.picture || null,
          website: profile.website || null,
          email:
            profile.email ||
            (auth0Profile.emails && auth0Profile.emails[0]?.value) ||
            null,
          email_verified: profile.email_verified || false,
          gender: profile.gender || null,
          birthdate: profile.birthdate || null,
          zoneinfo: profile.zoneinfo || null,
          locale: profile.locale || null,
          phone_number: profile.phone_number || null,
          phone_number_verified: profile.phone_number_verified || false,
          address: profile.address || null,
          updated_at: profile.updated_at || new Date().toISOString(),
          createdAt: new Date(),
          lastLogin: new Date(),
        };

        // Add any additional fields from profile that we didn't explicitly list
        Object.keys(profile).forEach((key) => {
          if (!(key in userProperties)) {
            userProperties[key] = profile[key];
          }
        });

        // Ensure all properties are of primitive types
        Object.keys(userProperties).forEach((key) => {
          if (
            typeof userProperties[key] === 'object' &&
            userProperties[key] !== null
          ) {
            userProperties[key] = JSON.stringify(userProperties[key]);
          }
        });

        const createResult = await this.neo4jService.write(
          `
          CREATE (u:User $userProperties)
          RETURN u
          `,
          { userProperties },
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

  // src/users/users.service.ts

  async updateUserProfile(
    userData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    try {
      console.log('Received update request for user:', userData.sub);
      console.log('Update data:', userData);

      const result = await this.neo4jService.write(
        `
      MATCH (u:User {sub: $sub})
      SET u += $updates
      RETURN u
      `,
        {
          sub: userData.sub,
          updates: {
            preferred_username: userData.preferred_username,
            email: userData.email,
            mission_statement: userData.mission_statement,
            updated_at: new Date().toISOString(),
          },
        },
      );

      if (result.records.length === 0) {
        console.log('User not found:', userData.sub);
        throw new Error('User not found');
      }

      const updatedUser = result.records[0].get('u').properties as UserProfile;
      console.log('User profile updated successfully:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }
}
