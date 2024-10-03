import { Test, TestingModule } from '@nestjs/testing';
import { UserSchema } from '../user.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserProfile } from '../../../users/user.model';
import { Record, Result } from 'neo4j-driver';

describe('UserSchema', () => {
  let userSchema: UserSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSchema,
        {
          provide: Neo4jService,
          useValue: {
            read: jest.fn(),
            write: jest.fn(),
          },
        },
      ],
    }).compile();

    userSchema = module.get<UserSchema>(UserSchema);
    neo4jService = module.get(Neo4jService);
  });

  describe('findUser', () => {
    it('should return a user when found', async () => {
      const mockUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUser }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await userSchema.findUser('auth0|123');
      expect(result).toEqual(mockUser);
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $sub})'),
        { sub: 'auth0|123' },
      );
    });

    it('should return null when user is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await userSchema.findUser('auth0|123');
      expect(result).toBeNull();
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const mockUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        name: 'Test User',
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUser }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockResult);

      const result = await userSchema.createUser(mockUser);
      expect(result).toEqual(mockUser);
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (u:User $userProperties)'),
        expect.objectContaining({ userProperties: mockUser }),
      );
    });
  });

  // ... (update other test cases similarly)

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        nodesCreated: 5,
        participations: 10,
        actualNodesCreated: 5,
        actualParticipations: 10,
      };
      const mockRecord = {
        toObject: jest.fn().mockReturnValue(mockStats),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await userSchema.getUserStats('auth0|123');
      expect(result).toEqual(mockStats);
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        { userId: 'auth0|123' },
      );
    });
  });

  // ... (update other test cases similarly)
});
