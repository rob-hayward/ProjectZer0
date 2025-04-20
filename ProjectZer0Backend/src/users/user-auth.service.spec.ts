// src/users/user-auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserAuthService } from './user-auth.service';
import { UserSchema } from '../neo4j/schemas/user.schema';
import { NotFoundException } from '@nestjs/common';

describe('UserAuthService', () => {
  let service: UserAuthService;
  let userSchemaMock: jest.Mocked<UserSchema>;

  beforeEach(async () => {
    userSchemaMock = {
      findUser: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      updateUserLogin: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAuthService,
        {
          provide: UserSchema,
          useValue: userSchemaMock,
        },
      ],
    }).compile();

    service = module.get<UserAuthService>(UserAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateUser', () => {
    it('should return existing user if found', async () => {
      const mockUser = { sub: 'auth0|123', email: 'test@example.com' };
      userSchemaMock.findUser.mockResolvedValue(mockUser);

      const result = await service.findOrCreateUser({ _json: mockUser });

      expect(result).toEqual({ user: mockUser, isNewUser: false });
      expect(userSchemaMock.findUser).toHaveBeenCalledWith('auth0|123');
      expect(userSchemaMock.updateUserLogin).toHaveBeenCalledWith('auth0|123');
    });

    it('should create a new user if not found', async () => {
      const mockAuth0Profile = {
        _json: { sub: 'auth0|123', email: 'test@example.com' },
      };
      userSchemaMock.findUser.mockResolvedValue(null);
      userSchemaMock.createUser.mockResolvedValue(mockAuth0Profile._json);

      const result = await service.findOrCreateUser(mockAuth0Profile);

      expect(result).toEqual({ user: mockAuth0Profile._json, isNewUser: true });
      expect(userSchemaMock.findUser).toHaveBeenCalledWith('auth0|123');
      expect(userSchemaMock.createUser).toHaveBeenCalled();
    });

    it('should handle profile without _json property', async () => {
      const mockProfile = { sub: 'auth0|123', email: 'test@example.com' };
      userSchemaMock.findUser.mockResolvedValue(null);
      userSchemaMock.createUser.mockResolvedValue(mockProfile);

      const result = await service.findOrCreateUser(mockProfile);

      expect(result).toEqual({ user: mockProfile, isNewUser: true });
      expect(userSchemaMock.findUser).toHaveBeenCalledWith('auth0|123');
    });

    it('should handle errors from database operations', async () => {
      userSchemaMock.findUser.mockRejectedValue(new Error('Database error'));

      await expect(
        service.findOrCreateUser({ _json: { sub: 'auth0|123' } }),
      ).rejects.toThrow('Failed to find or create user');
    });

    it('should throw error if no sub is found in profile', async () => {
      await expect(
        service.findOrCreateUser({ _json: { name: 'Test User' } }),
      ).rejects.toThrow('No sub found in Auth0 profile');
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile when found', async () => {
      const mockUser = { sub: 'auth0|123', email: 'test@example.com' };
      userSchemaMock.findUser.mockResolvedValue(mockUser);

      const result = await service.getUserProfile('auth0|123');

      expect(result).toEqual(mockUser);
      expect(userSchemaMock.findUser).toHaveBeenCalledWith('auth0|123');
    });

    it('should throw NotFoundException when user not found', async () => {
      userSchemaMock.findUser.mockResolvedValue(null);

      await expect(service.getUserProfile('auth0|123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile with allowed fields', async () => {
      const mockUserData = {
        sub: 'auth0|123',
        preferred_username: 'testuser',
        email: 'test@example.com',
        mission_statement: 'Test mission',
      };

      userSchemaMock.updateUser.mockResolvedValue(mockUserData);

      const result = await service.updateUserProfile(mockUserData);

      expect(result).toEqual(mockUserData);
      expect(userSchemaMock.updateUser).toHaveBeenCalledWith(
        'auth0|123',
        expect.objectContaining({
          preferred_username: 'testuser',
          email: 'test@example.com',
          mission_statement: 'Test mission',
        }),
      );
    });

    it('should throw error when sub is missing', async () => {
      const userData = { preferred_username: 'testuser' };

      await expect(service.updateUserProfile(userData)).rejects.toThrow(
        'User ID (sub) is required for profile updates',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      userSchemaMock.updateUser.mockResolvedValue(null);

      await expect(
        service.updateUserProfile({ sub: 'auth0|nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
