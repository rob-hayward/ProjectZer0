export interface Auth0Profile {
  sub: string; // Auth0 user ID, always present
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
  // Add any other fields that Auth0 might return
}
