// src/users/interactions/interaction.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { InteractionService } from './interaction.service';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';
import { UserInteractions } from './interaction.model';

describe('InteractionService', () => {
  let service: InteractionService;
  let schemaMock: jest.Mocked<InteractionSchema>;

  beforeEach(async () => {
    schemaMock = {
      createOrUpdateInteraction: jest.fn(),
      addCommentInteraction: jest.fn(),
      getInteractions: jest.fn(),
      getInteractedObjects: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionService,
        {
          provide: InteractionSchema,
          useValue: schemaMock,
        },
      ],
    }).compile();

    service = module.get<InteractionService>(InteractionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addCreatedInteraction', () => {
    it('should create interaction with correct data', async () => {
      const mockInteraction = { type: 'test', timestamp: expect.any(String) };
      schemaMock.createOrUpdateInteraction.mockResolvedValue(mockInteraction);

      const result = await service.addCreatedInteraction(
        'user1',
        'object1',
        'test',
      );

      expect(schemaMock.createOrUpdateInteraction).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          created: expect.objectContaining({
            object1: expect.objectContaining({
              type: 'test',
              timestamp: expect.any(String),
            }),
          }),
        }),
      );
      expect(result).toEqual(mockInteraction);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(
        service.addCreatedInteraction('', 'object1', 'test'),
      ).rejects.toThrow('Missing required parameters');
    });
  });

  describe('addVoteInteraction', () => {
    it('should create vote interaction with correct data', async () => {
      const mockInteraction = {
        type: 'test',
        value: 1,
        timestamp: expect.any(String),
      };
      schemaMock.createOrUpdateInteraction.mockResolvedValue(mockInteraction);

      const result = await service.addVoteInteraction(
        'user1',
        'object1',
        'test',
        1,
      );

      expect(schemaMock.createOrUpdateInteraction).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          voted: expect.objectContaining({
            object1: expect.objectContaining({
              type: 'test',
              value: 1,
              timestamp: expect.any(String),
            }),
          }),
        }),
      );
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('addCommentInteraction', () => {
    it('should add comment interaction with correct data', async () => {
      const mockInteraction = {
        type: 'test',
        commentIds: ['comment1'],
        lastCommentTimestamp: expect.any(String),
      };
      schemaMock.addCommentInteraction.mockResolvedValue(mockInteraction);

      const result = await service.addCommentInteraction(
        'user1',
        'object1',
        'test',
        'comment1',
      );

      expect(schemaMock.addCommentInteraction).toHaveBeenCalledWith(
        'user1',
        'object1',
        'test',
        'comment1',
      );
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('getAllInteractions', () => {
    it('should get all interactions for a user', async () => {
      const mockInteractions: UserInteractions = {
        created: {
          obj1: { type: 'test', timestamp: '2023-01-01' },
        },
        voted: {
          obj2: { type: 'test', value: 1, timestamp: '2023-01-01' },
        },
      };
      schemaMock.getInteractions.mockResolvedValue(mockInteractions);

      const result = await service.getAllInteractions('user1');

      expect(schemaMock.getInteractions).toHaveBeenCalledWith('user1');
      expect(result).toEqual(mockInteractions);
    });

    it('should handle error gracefully', async () => {
      schemaMock.getInteractions.mockRejectedValue(new Error('DB error'));

      const result = await service.getAllInteractions('user1');

      expect(result).toEqual({});
    });

    it('should return empty object for empty userId', async () => {
      const result = await service.getAllInteractions('');

      expect(result).toEqual({});
      expect(schemaMock.getInteractions).not.toHaveBeenCalled();
    });
  });

  describe('getInteractedObjects', () => {
    it('should get objects for a specific interaction type', async () => {
      const mockObjects = ['obj1', 'obj2'];
      schemaMock.getInteractedObjects.mockResolvedValue(mockObjects);

      const result = await service.getInteractedObjects('user1', 'created');

      expect(schemaMock.getInteractedObjects).toHaveBeenCalledWith(
        'user1',
        'created',
      );
      expect(result).toEqual(mockObjects);
    });
  });

  describe('countUserInteractions', () => {
    it('should count interactions by type', async () => {
      const mockInteractions: UserInteractions = {
        created: {
          obj1: { type: 'test', timestamp: '2023-01-01' },
          obj2: { type: 'test', timestamp: '2023-01-01' },
        },
        voted: {
          obj3: { type: 'test', value: 1, timestamp: '2023-01-01' },
        },
        commented: {},
      };

      jest
        .spyOn(service, 'getAllInteractions')
        .mockResolvedValue(mockInteractions);

      const result = await service.countUserInteractions('user1');

      expect(result).toEqual({
        created: 2,
        voted: 1,
        commented: 0,
      });
    });

    it('should handle missing interaction types', async () => {
      const mockInteractions: UserInteractions = {
        // No created or commented
        voted: {
          obj1: { type: 'test', value: 1, timestamp: '2023-01-01' },
        },
      };

      jest
        .spyOn(service, 'getAllInteractions')
        .mockResolvedValue(mockInteractions);

      const result = await service.countUserInteractions('user1');

      expect(result).toEqual({
        created: 0,
        voted: 1,
        commented: 0,
      });
    });
  });
});
