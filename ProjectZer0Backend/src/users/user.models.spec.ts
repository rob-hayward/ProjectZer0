import { UserProfile } from './user.model';

describe('User Models', () => {
  it('should have correct types for UserProfile with all possible fields', () => {
    const profile: UserProfile = {
      sub: 'auth0|123',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      middle_name: 'Middle',
      nickname: 'testuser',
      preferred_username: 'test.user',
      profile: 'https://example.com/profile',
      picture: 'https://example.com/picture.jpg',
      website: 'https://example.com',
      email: 'test@example.com',
      email_verified: true,
      gender: 'not specified',
      birthdate: '1990-01-01',
      zoneinfo: 'America/New_York',
      locale: 'en-US',
      phone_number: '+1234567890',
      phone_number_verified: false,
      address: {
        street_address: '123 Main St',
        locality: 'Anytown',
        region: 'ST',
        postal_code: '12345',
        country: 'USA',
      },
      updated_at: '2023-01-01T00:00:00.000Z',
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      lastLogin: new Date('2023-01-01T00:00:00.000Z'),
    };

    expect(profile).toBeDefined();
    expect(profile.sub).toBe('auth0|123');
    expect(profile.name).toBe('Test User');
    expect(profile.email).toBe('test@example.com');
    expect(profile.email_verified).toBe(true);
    expect(profile.picture).toBe('https://example.com/picture.jpg');
    expect(profile.address).toEqual({
      street_address: '123 Main St',
      locality: 'Anytown',
      region: 'ST',
      postal_code: '12345',
      country: 'USA',
    });
    expect(profile.createdAt).toBeInstanceOf(Date);
    expect(profile.lastLogin).toBeInstanceOf(Date);
  });

  it('should allow UserProfile with minimal required fields', () => {
    const minimalProfile: UserProfile = {
      sub: 'auth0|456',
    };

    expect(minimalProfile).toBeDefined();
    expect(minimalProfile.sub).toBe('auth0|456');
  });

  it('should allow additional properties on UserProfile', () => {
    const profileWithAdditionalProps: UserProfile = {
      sub: 'auth0|789',
      customField1: 'custom value',
      customField2: 42,
    };

    expect(profileWithAdditionalProps).toBeDefined();
    expect(profileWithAdditionalProps.sub).toBe('auth0|789');
    expect(profileWithAdditionalProps.customField1).toBe('custom value');
    expect(profileWithAdditionalProps.customField2).toBe(42);
  });
});
