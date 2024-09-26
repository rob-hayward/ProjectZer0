export interface Auth0UserProfile {
  // Auth0 fields
  sub: string; // Auth0 user ID, always present
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;

  // Custom fields
  createdAt?: Date;
  lastLogin?: Date;
  // Add any other custom fields here
}

// Helper type for database operations
export type UserProfile = Auth0UserProfile;
