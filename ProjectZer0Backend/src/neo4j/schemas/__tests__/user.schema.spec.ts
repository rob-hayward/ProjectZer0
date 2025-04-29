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

  describe('updateUser', () => {
    it('should update a user', async () => {
      const mockUser: UserProfile = {
        sub: 'auth0|123',
        email: 'updated@example.com',
        name: 'Updated User',
      };
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUser }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockResult);

      const updates = {
        email: 'updated@example.com',
        name: 'Updated User',
      };
      const result = await userSchema.updateUser('auth0|123', updates);

      expect(result).toEqual(mockUser);
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $sub})'),
        { sub: 'auth0|123', updates },
      );
    });
  });

  describe('addCreatedNode', () => {
    it('should add a created node relationship', async () => {
      await userSchema.addCreatedNode('auth0|123', 'node-123', 'word');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        {
          userId: 'auth0|123',
          nodeId: 'node-123',
          nodeType: 'word',
        },
      );
    });
  });

  describe('getUserCreatedNodes', () => {
    it('should get nodes created by a user with type filter', async () => {
      const mockNodes = [{ properties: { id: 'node1', text: 'Test Node 1' } }];
      const mockRecords = mockNodes.map((node) => ({
        get: (key: string) => (key === 'n' ? node : 'word'),
      })) as unknown as Record[];

      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await userSchema.getUserCreatedNodes('auth0|123', 'word');

      expect(result).toEqual([
        {
          node: { id: 'node1', text: 'Test Node 1' },
          type: 'word',
        },
      ]);
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (u:User {sub: $userId})-[r:CREATED {type: $nodeType}]->(n)',
        ),
        { userId: 'auth0|123', nodeType: 'word' },
      );
    });

    it('should get all nodes created by a user without type filter', async () => {
      const mockNodes = [
        { properties: { id: 'node1', text: 'Test Node 1' } },
        { properties: { id: 'node2', text: 'Test Node 2' } },
      ];
      const mockRecords = mockNodes.map((node, index) => ({
        get: (key: string) => {
          if (key === 'n') return node;
          if (key === 'nodeType') return index === 0 ? 'word' : 'definition';
          return null;
        },
      })) as unknown as Record[];

      const mockResult = {
        records: mockRecords,
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await userSchema.getUserCreatedNodes('auth0|123');

      expect(result).toEqual([
        {
          node: { id: 'node1', text: 'Test Node 1' },
          type: 'word',
        },
        {
          node: { id: 'node2', text: 'Test Node 2' },
          type: 'definition',
        },
      ]);
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (u:User {sub: $userId})-[r:CREATED]->(n)',
        ),
        { userId: 'auth0|123', nodeType: undefined },
      );
    });
  });

  describe('getUserActivityStats', () => {
    it('should return user activity statistics', async () => {
      const mockStats = {
        nodesCreated: 5,
        creationsByType: {
          word: 2,
          definition: 1,
          statement: 2,
        },
        votesCast: 10,
        createdNodes: [
          { id: 'node1', type: 'word', createdAt: '2023-01-01' },
          { id: 'node2', type: 'definition', createdAt: '2023-01-02' },
        ],
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue(mockStats),
      } as unknown as Record;

      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await userSchema.getUserActivityStats('auth0|123');
      expect(result).toEqual(mockStats);
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        { userId: 'auth0|123' },
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        nodesCreated: 5,
        participations: 10,
        actualNodesCreated: 5,
        actualParticipations: 10,
      };

      const mockRecord = {
        toObject: jest.fn().mockReturnValue({ stats: mockStats }),
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

  describe('addParticipation', () => {
    it('should add a participation relationship', async () => {
      await userSchema.addParticipation('auth0|123', 'node-123', 'voted');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        {
          userId: 'auth0|123',
          nodeId: 'node-123',
          participationType: 'voted',
        },
      );
    });
  });

  describe('addUserPreference', () => {
    it('should add a user preference', async () => {
      await userSchema.addUserPreference('auth0|123', 'theme', 'dark');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        {
          userId: 'auth0|123',
          key: 'theme',
          value: 'dark',
        },
      );
    });
  });

  describe('updateUserLogin', () => {
    it('should update user login timestamp', async () => {
      await userSchema.updateUserLogin('auth0|123');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $sub})'),
        { sub: 'auth0|123' },
      );
    });
  });
});
