import { Auth0UserProfile } from './user.model';
import { UserProfile } from './user.model';

describe('User Models', () => {
  it('should have correct types for Auth0Profile', () => {
    const profile: Auth0UserProfile = {
      sub: 'auth0|123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      nickname: 'testuser',
      picture: 'https://example.com/picture.jpg',
      updated_at: '2023-01-01T00:00:00.000Z',
    };

    expect(profile).toBeDefined();
    expect(profile.sub).toBe('auth0|123');
  });

  it('should have correct types for UserProfile', () => {
    const profile: UserProfile = {
      sub: 'auth0|123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      nickname: 'testuser',
      picture: 'https://example.com/picture.jpg',
      createdAt: new Date(),
      lastLogin: new Date(),
    };

    expect(profile).toBeDefined();
    expect(profile.sub).toBe('auth0|123');
  });
});
