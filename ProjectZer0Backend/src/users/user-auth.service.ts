// src/users/user-auth.service.ts

import { Injectable } from '@nestjs/common';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { UserProfile } from './user.model';

@Injectable()
export class UserAuthService {
  constructor(private userSchema: UserSchema) {}

  async findOrCreateUser(
    auth0Profile: any,
  ): Promise<{ user: UserProfile; isNewUser: boolean }> {
    try {
      console.log(
        'Auth0 profile received in UserAuthService:',
        JSON.stringify(auth0Profile, null, 2),
      );

      const profile = auth0Profile._json || auth0Profile;
      const sub = profile.sub || auth0Profile.id || auth0Profile.user_id;

      if (!sub) {
        throw new Error('No sub found in Auth0 profile');
      }

      console.log('Using sub:', sub);

      // First, try to find the user
      let user = await this.userSchema.findUser(sub);
      let isNewUser = false;

      if (!user) {
        // User doesn't exist, create a new user
        const userProperties = this.mapAuth0ProfileToUserProfile(
          profile,
          auth0Profile,
        );
        user = await this.userSchema.createUser(userProperties);
        isNewUser = true;
      } else {
        // User exists, update last login
        await this.userSchema.updateUserLogin(sub);
      }

      return { user, isNewUser };
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw new Error('Failed to find or create user');
    }
  }

  async getUserProfile(sub: string): Promise<UserProfile> {
    try {
      const userProfile = await this.userSchema.findUser(sub);
      if (!userProfile) {
        throw new Error('User not found');
      }
      console.log('Fetched user profile:', userProfile);
      return userProfile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  async updateUserProfile(
    userData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    try {
      console.log('Received update request for user:', userData.sub);
      console.log('Update data:', userData);

      const updatedUser = await this.userSchema.updateUser(userData.sub, {
        preferred_username: userData.preferred_username,
        email: userData.email,
        mission_statement: userData.mission_statement,
      });

      if (!updatedUser) {
        console.log('User not found:', userData.sub);
        throw new Error('User not found');
      }

      console.log('User profile updated successfully:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  private mapAuth0ProfileToUserProfile(
    profile: any,
    auth0Profile: any,
  ): UserProfile {
    const userProperties: UserProfile = {
      sub: profile.sub || auth0Profile.id || auth0Profile.user_id,
      name: profile.name || auth0Profile.displayName || null,
      given_name: profile.given_name || auth0Profile.name?.givenName || null,
      family_name: profile.family_name || auth0Profile.name?.familyName || null,
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

    return userProperties;
  }
}
