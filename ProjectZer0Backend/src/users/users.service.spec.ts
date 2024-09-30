import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Neo4jService } from '../neo4j/neo4j.service';
import { UserProfile } from './user.model';

describe('UsersService', () => {
  let service: UsersService;
  let neo4jServiceMock: Partial<Neo4jService>;

  beforeEach(async () => {
    neo4jServiceMock = {
      read: jest.fn(),
      write: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: Neo4jService, useValue: neo4jServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateUser', () => {
    it('should return existing user if found', async () => {
      const mockAuth0Profile = {
        _json: {
          sub: 'auth0|123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      const mockUserProfile: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      neo4jServiceMock.read = jest.fn().mockResolvedValueOnce({
        records: [{ get: () => ({ properties: mockUserProfile }) }],
      });

      const result = await service.findOrCreateUser(mockAuth0Profile);
      expect(result).toEqual({ user: mockUserProfile, isNewUser: false });
      expect(neo4jServiceMock.read).toHaveBeenCalledTimes(1);
    });

    it('should create a new user if not found', async () => {
      const mockAuth0Profile = {
        _json: {
          sub: 'auth0|123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      const mockCreatedUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: expect.any(Date),
        lastLogin: expect.any(Date),
      };

      neo4jServiceMock.read = jest.fn().mockResolvedValueOnce({ records: [] });
      neo4jServiceMock.write = jest.fn().mockResolvedValueOnce({
        records: [{ get: () => ({ properties: mockCreatedUser }) }],
      });

      const result = await service.findOrCreateUser(mockAuth0Profile);
      expect(result).toEqual({
        user: expect.objectContaining(mockCreatedUser),
        isNewUser: true,
      });
      expect(neo4jServiceMock.read).toHaveBeenCalledTimes(1);
      expect(neo4jServiceMock.write).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
      const mockAuth0Profile = {
        _json: {
          sub: 'auth0|123',
          email: 'test@example.com',
        },
      };

      neo4jServiceMock.read = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(service.findOrCreateUser(mockAuth0Profile)).rejects.toThrow(
        'Failed to find or create user',
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update an existing user', async () => {
      const mockUserProfile: Partial<UserProfile> = {
        sub: 'auth0|123',
        preferred_username: 'updatedUser',
        email: 'updated@example.com',
        mission_statement: 'Updated mission statement',
      };

      const mockUpdatedUser: UserProfile = {
        ...mockUserProfile,
        name: 'Test User',
        updated_at: expect.any(String),
      } as UserProfile;

      neo4jServiceMock.write = jest.fn().mockResolvedValueOnce({
        records: [{ get: () => ({ properties: mockUpdatedUser }) }],
      });

      const result = await service.updateUserProfile(mockUserProfile);
      expect(result).toEqual(mockUpdatedUser);
      expect(neo4jServiceMock.write).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if user is not found', async () => {
      const mockUserProfile: Partial<UserProfile> = {
        sub: 'auth0|nonexistent',
        preferred_username: 'nonexistentUser',
      };

      neo4jServiceMock.write = jest.fn().mockResolvedValueOnce({
        records: [],
      });

      await expect(service.updateUserProfile(mockUserProfile)).rejects.toThrow(
        'Failed to update user profile',
      );
    });

    it('should handle database errors', async () => {
      const mockUserProfile: Partial<UserProfile> = {
        sub: 'auth0|123',
        preferred_username: 'errorUser',
      };

      neo4jServiceMock.write = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(service.updateUserProfile(mockUserProfile)).rejects.toThrow(
        'Failed to update user profile',
      );
    });
  });
});
