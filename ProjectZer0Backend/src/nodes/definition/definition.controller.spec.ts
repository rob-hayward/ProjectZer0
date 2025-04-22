import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import {
  BadRequestException,
  NotFoundException,
  HttpException,
  Logger,
} from '@nestjs/common';

// Define proper types for mocks
type MockedDefinitionService = {
  [K in keyof DefinitionService]: jest.Mock;
};

describe('DefinitionController', () => {
  let controller: DefinitionController;
  let service: MockedDefinitionService;

  beforeEach(async () => {
    // Create properly typed mock service
    const mockDefinitionService = {
      createDefinition: jest.fn(),
      getDefinition: jest.fn(),
      updateDefinition: jest.fn(),
      deleteDefinition: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
      voteDefinition: jest.fn(),
      getDefinitionVoteStatus: jest.fn(),
      removeDefinitionVote: jest.fn(),
      getDefinitionVotes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DefinitionController],
      providers: [
        {
          provide: DefinitionService,
          useValue: mockDefinitionService,
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

    controller = module.get<DefinitionController>(DefinitionController);
    service = module.get(DefinitionService) as MockedDefinitionService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDefinition', () => {
    const validDefinitionData = {
      word: 'test',
      createdBy: 'user1',
      definitionText: 'A test definition',
    };

    it('should create a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        ...validDefinitionData,
      };

      service.createDefinition.mockResolvedValue(expectedResult);

      const result = await controller.createDefinition(validDefinitionData);

      expect(service.createDefinition).toHaveBeenCalledWith(
        validDefinitionData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty word', async () => {
      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          word: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(service.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty creator ID', async () => {
      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          createdBy: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(service.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        controller.createDefinition({
          ...validDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(service.createDefinition).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      service.createDefinition.mockRejectedValue(new Error('Service error'));

      await expect(
        controller.createDefinition(validDefinitionData),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getDefinition', () => {
    it('should return a definition when found', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
      };
      service.getDefinition.mockResolvedValue(mockDefinition);

      const result = await controller.getDefinition('test-id');

      expect(service.getDefinition).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockDefinition);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.getDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      service.getDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(controller.getDefinition('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDefinition', () => {
    const validUpdateData = { definitionText: 'Updated definition' };

    it('should update a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        definitionText: 'Updated definition',
      };

      service.updateDefinition.mockResolvedValue(expectedResult);

      const result = await controller.updateDefinition(
        'test-id',
        validUpdateData,
      );

      expect(service.updateDefinition).toHaveBeenCalledWith(
        'test-id',
        validUpdateData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.updateDefinition('', validUpdateData),
      ).rejects.toThrow(BadRequestException);
      expect(service.updateDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        controller.updateDefinition('test-id', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(service.updateDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      service.updateDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.updateDefinition('test-id', validUpdateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Definition deleted successfully',
      };
      service.deleteDefinition.mockResolvedValue(mockResult);

      const result = await controller.deleteDefinition('test-id');

      expect(service.deleteDefinition).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(service.deleteDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException', async () => {
      service.deleteDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(controller.deleteDefinition('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('voteDefinition', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should process vote successfully', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      service.voteDefinition.mockResolvedValue(mockVoteResult);

      const result = await controller.voteDefinition(
        'test-id',
        { isPositive: true },
        mockRequest,
      );

      expect(service.voteDefinition).toHaveBeenCalledWith(
        'test-id',
        'user1',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.voteDefinition('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      expect(service.voteDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.voteDefinition(
          'test-id',
          { isPositive: true },
          { user: {} },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.voteDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for undefined vote value', async () => {
      await expect(
        controller.voteDefinition(
          'test-id',
          { isPositive: undefined },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.voteDefinition).not.toHaveBeenCalled();
    });
  });

  describe('getDefinitionVoteStatus', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should return vote status when found', async () => {
      const mockStatus = {
        status: 'agree' as 'agree' | 'disagree',
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      service.getDefinitionVoteStatus.mockResolvedValue(mockStatus);

      const result = await controller.getDefinitionVoteStatus(
        'test-id',
        mockRequest,
      );

      expect(service.getDefinitionVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockStatus);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.getDefinitionVoteStatus('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.getDefinitionVoteStatus('test-id', { user: {} }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeDefinitionVote', () => {
    const mockRequest = {
      user: { sub: 'user1' },
    };

    it('should remove vote successfully', async () => {
      const mockResult = {
        positiveVotes: 4,
        negativeVotes: 2,
        netVotes: 2,
      };
      service.removeDefinitionVote.mockResolvedValue(mockResult);

      const result = await controller.removeDefinitionVote(
        'test-id',
        mockRequest,
      );

      expect(service.removeDefinitionVote).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.removeDefinitionVote('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing user authentication', async () => {
      await expect(
        controller.removeDefinitionVote('test-id', { user: {} }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDefinitionVotes', () => {
    it('should return votes when found', async () => {
      const mockVotes = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      service.getDefinitionVotes.mockResolvedValue(mockVotes);

      const result = await controller.getDefinitionVotes('test-id');

      expect(service.getDefinitionVotes).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockVotes);
    });

    it('should return null when no votes exist', async () => {
      service.getDefinitionVotes.mockResolvedValue(null);

      const result = await controller.getDefinitionVotes('test-id');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(controller.getDefinitionVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status successfully', async () => {
      const mockResult = { id: 'test-id', visibilityStatus: true };
      service.setVisibilityStatus.mockResolvedValue(mockResult);

      const result = await controller.setVisibilityStatus('test-id', {
        isVisible: true,
      });

      expect(service.setVisibilityStatus).toHaveBeenCalledWith('test-id', true);
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        controller.setVisibilityStatus('', { isVisible: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined visibility status', async () => {
      await expect(
        controller.setVisibilityStatus('test-id', { isVisible: undefined }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should return visibility status successfully', async () => {
      service.getVisibilityStatus.mockResolvedValue(true);

      const result = await controller.getVisibilityStatus('test-id');

      expect(service.getVisibilityStatus).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ visibilityStatus: true });
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(controller.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
