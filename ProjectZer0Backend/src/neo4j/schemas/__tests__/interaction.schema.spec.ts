// src/neo4j/schemas/__tests__/interaction.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { InteractionSchema } from '../interaction.schema';
import { Neo4jService } from '../../neo4j.service';
import { Logger } from '@nestjs/common';

describe('InteractionSchema', () => {
  let schema: InteractionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<InteractionSchema>(InteractionSchema);
    neo4jService = module.get(Neo4jService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  describe('createOrUpdateInteraction', () => {
    it('should create or update an interaction', async () => {
      const mockInteraction = {
        created: { object1: { type: 'test', timestamp: '2023-01-01' } },
      };
      const mockResult = {
        records: [
          { get: jest.fn().mockReturnValue({ properties: mockInteraction }) },
        ],
      };
      neo4jService.write.mockResolvedValue(mockResult as any);

      const result = await schema.createOrUpdateInteraction(
        'user1',
        mockInteraction,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining(
          'MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)',
        ),
        {
          userId: 'user1',
          interactionData: mockInteraction,
        },
      );
      expect(result).toEqual(mockInteraction);
    });

    it('should return empty object when no records are returned', async () => {
      const mockResult = { records: [] };
      neo4jService.write.mockResolvedValue(mockResult as any);

      const result = await schema.createOrUpdateInteraction('user1', {
        created: {},
      });

      expect(result).toEqual({});
    });

    it('should throw error when write operation fails', async () => {
      neo4jService.write.mockRejectedValue(new Error('Database error'));

      await expect(
        schema.createOrUpdateInteraction('user1', { created: {} }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('addCommentInteraction', () => {
    it('should add a comment interaction', async () => {
      // Mock the ensureUserExists method call
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn() }],
      } as any);

      // Mock the addCommentInteraction result
      const mockCommentInteraction = {
        type: 'test',
        commentIds: ['comment1'],
        lastCommentTimestamp: '2023-01-01',
      };
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockCommentInteraction) }],
      };
      neo4jService.write.mockResolvedValueOnce(mockResult as any);

      const result = await schema.addCommentInteraction(
        'user1',
        'object1',
        'test',
        'comment1',
      );

      // Check first call - ensure user exists
      expect(neo4jService.write).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('MERGE (u:User {sub: $userId})'),
        { userId: 'user1' },
      );

      // Check second call - add comment interaction
      expect(neo4jService.write).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'MERGE (u)-[:HAS_INTERACTIONS]->(i:InteractionNode)',
        ),
        {
          userId: 'user1',
          objectId: 'object1',
          objectType: 'test',
          commentId: 'comment1',
        },
      );
      expect(result).toEqual(mockCommentInteraction);
    });

    it('should return null when no records are returned', async () => {
      // Mock the ensureUserExists method call
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn() }],
      } as any);

      // Mock empty result
      const mockResult = { records: [] };
      neo4jService.write.mockResolvedValueOnce(mockResult as any);

      const result = await schema.addCommentInteraction(
        'user1',
        'object1',
        'test',
        'comment1',
      );

      expect(result).toBeNull();
    });

    it('should throw error when user check fails', async () => {
      // Mock user check failure
      neo4jService.write.mockRejectedValueOnce(new Error('User not found'));

      await expect(
        schema.addCommentInteraction('user1', 'object1', 'test', 'comment1'),
      ).rejects.toThrow('User not found');
    });

    it('should throw error when comment interaction fails', async () => {
      // Mock the ensureUserExists method success
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn() }],
      } as any);

      // Mock interaction failure
      neo4jService.write.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        schema.addCommentInteraction('user1', 'object1', 'test', 'comment1'),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getInteractions', () => {
    it('should return all interactions for a user', async () => {
      const mockInteractions = { created: {}, voted: {}, commented: {} };
      const mockResult = {
        records: [
          { get: jest.fn().mockReturnValue({ properties: mockInteractions }) },
        ],
      };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractions('user1');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        {
          userId: 'user1',
        },
      );
      expect(result).toEqual(mockInteractions);
    });

    it('should return empty object when no interactions exist', async () => {
      const mockResult = { records: [] };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractions('user1');

      expect(result).toEqual({});
    });

    it('should return empty object when interaction node is null', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(null) }],
      };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractions('user1');

      expect(result).toEqual({});
    });

    it('should handle database errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      const result = await schema.getInteractions('user1');

      expect(result).toEqual({});
    });
  });

  describe('getInteractedObjects', () => {
    it('should return interacted object ids for a specific interaction type', async () => {
      const mockObjectIds = ['object1', 'object2'];
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockObjectIds) }],
      };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractedObjects('user1', 'created');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        {
          userId: 'user1',
          interactionType: 'created',
        },
      );
      expect(result).toEqual(mockObjectIds);
    });

    it('should return empty array when no interacted objects exist', async () => {
      const mockResult = { records: [] };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractedObjects('user1', 'created');

      expect(result).toEqual([]);
    });

    it('should return empty array when get returns null', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(null) }],
      };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractedObjects('user1', 'created');

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      const result = await schema.getInteractedObjects('user1', 'created');

      expect(result).toEqual([]);
    });
  });

  describe('ensureUserExists', () => {
    it('should create user if it does not exist', async () => {
      const mockResult = {
        records: [{ get: jest.fn() }],
      };
      neo4jService.write.mockResolvedValue(mockResult as any);

      // Access private method using type assertion
      await (schema as any).ensureUserExists('user1');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u:User {sub: $userId})'),
        { userId: 'user1' },
      );
    });

    it('should throw error when user creation fails', async () => {
      neo4jService.write.mockRejectedValue(new Error('Database error'));

      // Access private method using type assertion
      await expect((schema as any).ensureUserExists('user1')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
