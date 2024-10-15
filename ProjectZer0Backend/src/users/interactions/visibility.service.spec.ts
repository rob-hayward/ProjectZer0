import { Test, TestingModule } from '@nestjs/testing';
import { VisibilityService } from './visibility.service';
import { InteractionSchema } from '../../neo4j/schemas/interaction.schema';

describe('VisibilityService', () => {
  let service: VisibilityService;
  let interactionSchema: jest.Mocked<InteractionSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisibilityService,
        {
          provide: InteractionSchema,
          useValue: {
            getVisibilityPreference: jest.fn(),
            setVisibilityPreference: jest.fn(),
            getVisibilityPreferences: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VisibilityService>(VisibilityService);
    interactionSchema = module.get(InteractionSchema);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getObjectVisibility', () => {
    it('should return user preference when it exists', async () => {
      interactionSchema.getVisibilityPreference.mockResolvedValue(false);
      const result = await service.getObjectVisibility(
        'user1',
        'object1',
        true,
      );
      expect(result).toBe(false);
      expect(interactionSchema.getVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
      );
    });

    it('should return object visibility status when user preference does not exist', async () => {
      interactionSchema.getVisibilityPreference.mockResolvedValue(undefined);
      const result = await service.getObjectVisibility(
        'user1',
        'object1',
        true,
      );
      expect(result).toBe(true);
      expect(interactionSchema.getVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
      );
    });
  });

  describe('setUserVisibilityPreference', () => {
    it('should set user visibility preference', async () => {
      interactionSchema.setVisibilityPreference.mockResolvedValue(true);
      const result = await service.setUserVisibilityPreference(
        'user1',
        'object1',
        true,
      );
      expect(result).toBe(true);
      expect(interactionSchema.setVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
        true,
      );
    });
  });

  describe('getUserVisibilityPreferences', () => {
    it('should get user visibility preferences', async () => {
      const mockPreferences = { object1: true, object2: false };
      interactionSchema.getVisibilityPreferences.mockResolvedValue(
        mockPreferences,
      );
      const result = await service.getUserVisibilityPreferences('user1');
      expect(result).toEqual(mockPreferences);
      expect(interactionSchema.getVisibilityPreferences).toHaveBeenCalledWith(
        'user1',
      );
    });
  });
});
