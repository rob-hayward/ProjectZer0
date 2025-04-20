// src/users/user-auth.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { UserProfile } from './user.model';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  constructor(private userSchema: UserSchema) {}

  async findOrCreateUser(
    auth0Profile: any,
  ): Promise<{ user: UserProfile; isNewUser: boolean }> {
    try {
      this.logger.debug(
        `Processing Auth0 profile for user ID: ${auth0Profile?.id || auth0Profile?._json?.sub || 'unknown'}`,
      );

      const profile = auth0Profile._json || auth0Profile;
      const sub = profile.sub || auth0Profile.id || auth0Profile.user_id;

      if (!sub) {
        this.logger.error('No sub/id found in Auth0 profile', auth0Profile);
        throw new Error('No sub found in Auth0 profile');
      }

      this.logger.debug(`Looking up user with sub: ${sub}`);

      // First, try to find the user
      let user = await this.userSchema.findUser(sub);
      let isNewUser = false;

      if (!user) {
        // User doesn't exist, create a new user
        this.logger.log(`Creating new user with sub: ${sub}`);
        const userProperties = this.mapAuth0ProfileToUserProfile(
          profile,
          auth0Profile,
        );
        user = await this.userSchema.createUser(userProperties);
        isNewUser = true;
      } else {
        // User exists, update last login
        this.logger.debug(`Updating last login for user: ${sub}`);
        await this.userSchema.updateUserLogin(sub);
      }

      return { user, isNewUser };
    } catch (error) {
      this.logger.error(
        `Error in findOrCreateUser: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to find or create user: ${error.message}`);
    }
  }

  async getUserProfile(sub: string): Promise<UserProfile> {
    try {
      this.logger.debug(`Fetching user profile for: ${sub}`);
      const userProfile = await this.userSchema.findUser(sub);

      if (!userProfile) {
        this.logger.warn(`User not found: ${sub}`);
        throw new NotFoundException(`User with ID ${sub} not found`);
      }

      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error fetching user profile: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }
  }

  async updateUserProfile(
    userData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    try {
      if (!userData.sub) {
        this.logger.error(
          'Attempt to update user profile without sub ID',
          userData,
        );
        throw new Error('User ID (sub) is required for profile updates');
      }

      this.logger.debug(`Updating profile for user: ${userData.sub}`);

      // Create update object with only allowed fields
      const updates: Partial<UserProfile> = {
        preferred_username: userData.preferred_username,
        email: userData.email,
        mission_statement: userData.mission_statement,
        // Add other fields that are allowed to be updated
      };

      const updatedUser = await this.userSchema.updateUser(
        userData.sub,
        updates,
      );

      if (!updatedUser) {
        this.logger.warn(`User not found during update: ${userData.sub}`);
        throw new NotFoundException(`User with ID ${userData.sub} not found`);
      }

      this.logger.debug(`User profile updated: ${userData.sub}`);
      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error updating user profile: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to update user profile: ${error.message}`);
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
    for (const [key, value] of Object.entries(profile)) {
      if (!(key in userProperties)) {
        userProperties[key] = value;
      }
    }

    // Ensure all properties are of primitive types for Neo4j
    for (const key of Object.keys(userProperties)) {
      if (
        typeof userProperties[key] === 'object' &&
        userProperties[key] !== null &&
        key !== 'address' // Special handling for address object
      ) {
        userProperties[key] = JSON.stringify(userProperties[key]);
      }
    }

    return userProperties;
  }
}
