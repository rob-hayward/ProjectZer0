import { Test, TestingModule } from '@nestjs/testing';
import { InteractionSchema } from '../interaction.schema';
import { Neo4jService } from '../../neo4j.service';

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
      ],
    }).compile();

    schema = module.get<InteractionSchema>(InteractionSchema);
    neo4jService = module.get(Neo4jService);
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

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
        interactionData: mockInteraction,
      });
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('addCommentInteraction', () => {
    it('should add a comment interaction', async () => {
      const mockCommentInteraction = {
        type: 'test',
        commentIds: ['comment1'],
        lastCommentTimestamp: '2023-01-01',
      };
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockCommentInteraction) }],
      };
      neo4jService.write.mockResolvedValue(mockResult as any);

      const result = await schema.addCommentInteraction(
        'user1',
        'object1',
        'test',
        'comment1',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
        objectId: 'object1',
        objectType: 'test',
        commentId: 'comment1',
      });
      expect(result).toEqual(mockCommentInteraction);
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

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
      });
      expect(result).toEqual(mockInteractions);
    });

    it('should return an empty object when no interactions exist', async () => {
      const mockResult = { records: [] };
      neo4jService.read.mockResolvedValue(mockResult as any);

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

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
        interactionType: 'created',
      });
      expect(result).toEqual(mockObjectIds);
    });

    it('should return an empty array when no interacted objects exist', async () => {
      const mockResult = { records: [] };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getInteractedObjects('user1', 'created');

      expect(result).toEqual([]);
    });
  });

  describe('setVisibilityPreference', () => {
    it('should set visibility preference and return the status', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(true) }],
      };
      neo4jService.write.mockResolvedValue(mockResult as any);

      const result = await schema.setVisibilityPreference(
        'user1',
        'object1',
        true,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
        objectId: 'object1',
        isVisible: true,
      });
      expect(result).toBe(true);
    });
  });

  describe('getVisibilityPreference', () => {
    it('should return visibility preference when it exists', async () => {
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(true) }],
      };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
        objectId: 'object1',
      });
      expect(result).toBe(true);
    });

    it('should return undefined when visibility preference does not exist', async () => {
      const mockResult = { records: [] };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(result).toBeUndefined();
    });
  });

  describe('getVisibilityPreferences', () => {
    it('should return all visibility preferences for a user', async () => {
      const mockPreferences = { object1: true, object2: false };
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockPreferences) }],
      };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getVisibilityPreferences('user1');

      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        userId: 'user1',
      });
      expect(result).toEqual(mockPreferences);
    });

    it('should return an empty object when no preferences exist', async () => {
      const mockResult = { records: [] };
      neo4jService.read.mockResolvedValue(mockResult as any);

      const result = await schema.getVisibilityPreferences('user1');

      expect(result).toEqual({});
    });
  });
});
