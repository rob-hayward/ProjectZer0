import { Test, TestingModule } from '@nestjs/testing';
import { InteractionService } from './interaction.service';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';

describe('InteractionService', () => {
  let service: InteractionService;
  let schema: jest.Mocked<InteractionSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionService,
        {
          provide: InteractionSchema,
          useValue: {
            createOrUpdateInteraction: jest.fn(),
            addCommentInteraction: jest.fn(),
            setVisibilityPreference: jest.fn(),
            getVisibilityPreference: jest.fn(),
            getInteractions: jest.fn(),
            getInteractedObjects: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InteractionService>(InteractionService);
    schema = module.get(InteractionSchema);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addCreatedInteraction', () => {
    it('should add a created interaction', async () => {
      const mockInteraction = { type: 'test', timestamp: expect.any(String) };
      schema.createOrUpdateInteraction.mockResolvedValue(mockInteraction);

      const result = await service.addCreatedInteraction(
        'user1',
        'object1',
        'test',
      );

      expect(schema.createOrUpdateInteraction).toHaveBeenCalledWith('user1', {
        created: { object1: mockInteraction },
      });
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('addVoteInteraction', () => {
    it('should add a vote interaction', async () => {
      const mockInteraction = {
        type: 'test',
        value: 1,
        timestamp: expect.any(String),
      };
      schema.createOrUpdateInteraction.mockResolvedValue(mockInteraction);

      const result = await service.addVoteInteraction(
        'user1',
        'object1',
        'test',
        1,
      );

      expect(schema.createOrUpdateInteraction).toHaveBeenCalledWith('user1', {
        voted: { object1: mockInteraction },
      });
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('addCommentInteraction', () => {
    it('should add a comment interaction', async () => {
      const mockInteraction = {
        type: 'test',
        commentIds: ['comment1'],
        lastCommentTimestamp: expect.any(String),
      };
      schema.addCommentInteraction.mockResolvedValue(mockInteraction);

      const result = await service.addCommentInteraction(
        'user1',
        'object1',
        'test',
        'comment1',
      );

      expect(schema.addCommentInteraction).toHaveBeenCalledWith(
        'user1',
        'object1',
        'test',
        'comment1',
      );
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('setVisibilityPreference', () => {
    it('should set visibility preference', async () => {
      schema.setVisibilityPreference.mockResolvedValue({ isVisible: true });

      const result = await service.setVisibilityPreference(
        'user1',
        'object1',
        true,
      );

      expect(schema.setVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
        true,
      );
      expect(result).toEqual({ isVisible: true });
    });
  });

  describe('getVisibilityPreference', () => {
    it('should get visibility preference', async () => {
      schema.getVisibilityPreference.mockResolvedValue(true);

      const result = await service.getVisibilityPreference('user1', 'object1');

      expect(schema.getVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
      );
      expect(result).toBe(true);
    });
  });

  describe('getAllInteractions', () => {
    it('should get all interactions', async () => {
      const mockInteractions = { created: {}, voted: {}, commented: {} };
      schema.getInteractions.mockResolvedValue(mockInteractions);

      const result = await service.getAllInteractions('user1');

      expect(schema.getInteractions).toHaveBeenCalledWith('user1');
      expect(result).toEqual(mockInteractions);
    });
  });

  describe('getInteractedObjects', () => {
    it('should get interacted objects', async () => {
      const mockObjects = ['object1', 'object2'];
      schema.getInteractedObjects.mockResolvedValue(mockObjects);

      const result = await service.getInteractedObjects('user1', 'created');

      expect(schema.getInteractedObjects).toHaveBeenCalledWith(
        'user1',
        'created',
      );
      expect(result).toEqual(mockObjects);
    });
  });
});
