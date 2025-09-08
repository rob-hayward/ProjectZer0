// src/users/visibility/visibility.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { VisibilityService } from './visibility.service';
import { VisibilitySchema } from '../../neo4j/schemas/visibility.schema';
import { VisibilityPreference } from '../dto/visibility.dto';

describe('VisibilityService', () => {
  let service: VisibilityService;
  let visibilitySchema: jest.Mocked<VisibilitySchema>;

  beforeEach(async () => {
    visibilitySchema = {
      getVisibilityPreference: jest.fn(),
      setVisibilityPreference: jest.fn(),
      getAllVisibilityPreferences: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisibilityService,
        {
          provide: VisibilitySchema,
          useValue: visibilitySchema,
        },
      ],
    }).compile();

    service = module.get<VisibilityService>(VisibilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getObjectVisibility', () => {
    it('should return user preference when it exists', async () => {
      visibilitySchema.getVisibilityPreference.mockResolvedValue(false);

      const result = await service.getObjectVisibility('user1', 'object1', {
        isVisible: true,
      });

      expect(result).toBe(false);
      expect(visibilitySchema.getVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
      );
    });

    describe('Anonymous Users', () => {
      it('should return community visibility for null userId', async () => {
        const result = await service.getObjectVisibility(null, 'object1', {
          isVisible: true,
        });

        expect(result).toBe(true);
        expect(visibilitySchema.getVisibilityPreference).not.toHaveBeenCalled();
      });

      it('should hide content with negative votes for anonymous users', async () => {
        const result = await service.getObjectVisibility(null, 'object1', {
          netVotes: -5,
        });

        expect(result).toBe(false);
        expect(visibilitySchema.getVisibilityPreference).not.toHaveBeenCalled();
      });

      it('should show content with positive votes for anonymous users', async () => {
        const result = await service.getObjectVisibility(null, 'object1', {
          netVotes: 3,
        });

        expect(result).toBe(true);
        expect(visibilitySchema.getVisibilityPreference).not.toHaveBeenCalled();
      });

      it('should show content with zero votes for anonymous users', async () => {
        const result = await service.getObjectVisibility(null, 'object1', {
          netVotes: 0,
        });

        expect(result).toBe(true);
        expect(visibilitySchema.getVisibilityPreference).not.toHaveBeenCalled();
      });

      it('should prioritize explicit isVisible over netVotes for anonymous users', async () => {
        // Explicit false should override positive votes
        let result = await service.getObjectVisibility(null, 'object1', {
          netVotes: 10,
          isVisible: false,
        });
        expect(result).toBe(false);

        // Explicit true should override negative votes
        result = await service.getObjectVisibility(null, 'object2', {
          netVotes: -10,
          isVisible: true,
        });
        expect(result).toBe(true);

        expect(visibilitySchema.getVisibilityPreference).not.toHaveBeenCalled();
      });

      it('should default to visible when no data provided for anonymous users', async () => {
        const result = await service.getObjectVisibility(null, 'object1', {});

        expect(result).toBe(true);
        expect(visibilitySchema.getVisibilityPreference).not.toHaveBeenCalled();
      });
    });

    it('should return community isVisible when user preference does not exist', async () => {
      visibilitySchema.getVisibilityPreference.mockResolvedValue(undefined);

      const result = await service.getObjectVisibility('user1', 'object1', {
        isVisible: false,
      });

      expect(result).toBe(false);
    });

    it('should use netVotes to determine visibility when no direct visibility flag', async () => {
      visibilitySchema.getVisibilityPreference.mockResolvedValue(undefined);

      // Negative votes - hidden
      let result = await service.getObjectVisibility('user1', 'object1', {
        netVotes: -5,
      });
      expect(result).toBe(false);

      // Positive votes - visible
      result = await service.getObjectVisibility('user1', 'object1', {
        netVotes: 5,
      });
      expect(result).toBe(true);
    });

    it('should default to visible when no visibility info provided', async () => {
      visibilitySchema.getVisibilityPreference.mockResolvedValue(undefined);

      const result = await service.getObjectVisibility('user1', 'object1', {});

      expect(result).toBe(true);
    });

    it('should handle errors gracefully and default to visible', async () => {
      visibilitySchema.getVisibilityPreference.mockRejectedValue(
        new Error('Test error'),
      );

      const result = await service.getObjectVisibility('user1', 'object1', {
        isVisible: false,
      });

      expect(result).toBe(true);
    });
  });

  describe('setUserVisibilityPreference', () => {
    it('should call schema with correct parameters', async () => {
      const mockPreference: VisibilityPreference = {
        isVisible: true,
        source: 'user',
        timestamp: 1234567890,
      };

      visibilitySchema.setVisibilityPreference.mockResolvedValue(
        mockPreference,
      );

      const result = await service.setUserVisibilityPreference(
        'user1',
        'object1',
        true,
      );

      expect(visibilitySchema.setVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'object1',
        true,
      );
      expect(result).toEqual(mockPreference);
    });

    it('should throw error when userId is missing', async () => {
      await expect(
        service.setUserVisibilityPreference('', 'object1', true),
      ).rejects.toThrow('User ID is required');
    });

    it('should throw error when nodeId is missing', async () => {
      await expect(
        service.setUserVisibilityPreference('user1', '', true),
      ).rejects.toThrow('Node ID is required');
    });
  });

  describe('getUserVisibilityPreferences', () => {
    it('should return preferences from schema', async () => {
      const mockPreferences: Record<string, VisibilityPreference> = {
        obj1: { isVisible: true, source: 'user', timestamp: 123 },
        obj2: { isVisible: false, source: 'community', timestamp: 456 },
      };

      visibilitySchema.getAllVisibilityPreferences.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getUserVisibilityPreferences('user1');

      expect(visibilitySchema.getAllVisibilityPreferences).toHaveBeenCalledWith(
        'user1',
      );
      expect(result).toEqual(mockPreferences);
    });

    it('should return empty object when userId is missing', async () => {
      const result = await service.getUserVisibilityPreferences('');

      expect(result).toEqual({});
      expect(
        visibilitySchema.getAllVisibilityPreferences,
      ).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      visibilitySchema.getAllVisibilityPreferences.mockRejectedValue(
        new Error('Test error'),
      );

      const result = await service.getUserVisibilityPreferences('user1');

      expect(result).toEqual({});
    });
  });
});
