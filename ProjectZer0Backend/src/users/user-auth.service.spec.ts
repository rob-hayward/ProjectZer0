// src/users/user-auth.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UserAuthService } from './user-auth.service';
import { UserSchema } from '../neo4j/schemas/user.schema';

describe('UserAuthService', () => {
  let service: UserAuthService;
  let userSchemaMock: Partial<UserSchema>;

  beforeEach(async () => {
    userSchemaMock = {
      findUser: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      updateUserLogin: jest.fn(),
    };

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
      userSchemaMock.findUser = jest.fn().mockResolvedValue(mockUser);

      const result = await service.findOrCreateUser({ _json: mockUser });

      expect(result).toEqual({ user: mockUser, isNewUser: false });
      expect(userSchemaMock.findUser).toHaveBeenCalledWith('auth0|123');
      expect(userSchemaMock.updateUserLogin).toHaveBeenCalledWith('auth0|123');
    });

    it('should create a new user if not found', async () => {
      const mockAuth0Profile = {
        _json: { sub: 'auth0|123', email: 'test@example.com' },
      };
      userSchemaMock.findUser = jest.fn().mockResolvedValue(null);
      userSchemaMock.createUser = jest
        .fn()
        .mockResolvedValue(mockAuth0Profile._json);

      const result = await service.findOrCreateUser(mockAuth0Profile);

      expect(result).toEqual({ user: mockAuth0Profile._json, isNewUser: true });
      expect(userSchemaMock.findUser).toHaveBeenCalledWith('auth0|123');
      expect(userSchemaMock.createUser).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      userSchemaMock.findUser = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(
        service.findOrCreateUser({ _json: { sub: 'auth0|123' } }),
      ).rejects.toThrow('Failed to find or create user');
    });
  });

  describe('updateUserProfile', () => {
    it('should update an existing user', async () => {
      const mockUserData = { sub: 'auth0|123', preferred_username: 'testuser' };
      const mockUpdatedUser = {
        ...mockUserData,
        updated_at: expect.any(String),
      };
      userSchemaMock.updateUser = jest.fn().mockResolvedValue(mockUpdatedUser);

      const result = await service.updateUserProfile(mockUserData);

      expect(result).toEqual(mockUpdatedUser);
      expect(userSchemaMock.updateUser).toHaveBeenCalledWith(
        'auth0|123',
        expect.objectContaining({
          preferred_username: 'testuser',
        }),
      );
    });

    it('should throw an error if user is not found', async () => {
      userSchemaMock.updateUser = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateUserProfile({ sub: 'auth0|nonexistent' }),
      ).rejects.toThrow('User not found');
    });

    it('should handle database errors', async () => {
      userSchemaMock.updateUser = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateUserProfile({ sub: 'auth0|123' }),
      ).rejects.toThrow('Database error');
    });
  });
});
