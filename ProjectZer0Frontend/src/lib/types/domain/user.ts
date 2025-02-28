// ProjectZer0Frontend/src/lib/types/domain/user.ts

export interface UserProfile {
  // Required Auth0 field
  sub: string;

  // Standard Auth0 fields
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  updated_at?: string;

  // Custom fields
  createdAt?: Date;
  lastLogin?: Date;
  mission_statement?: string;

  // This allows for any additional fields that Auth0 might send
  [key: string]: unknown;
}