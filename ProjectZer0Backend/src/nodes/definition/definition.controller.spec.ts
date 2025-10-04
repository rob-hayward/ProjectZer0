// src/nodes/definition/definition.controller.spec.ts - REFACTORED ARCHITECTURE TESTS

import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DefinitionController - Refactored Architecture', () => {
  let controller: DefinitionController;
  let definitionService: jest.Mocked<DefinitionService>;

  // Mock data
  const mockDefinitionData = {
    id: 'def-123',
    word: 'test',
    definitionText: 'A test definition',
    createdBy: 'user-123',
    publicCredit: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 4,
    contentNegativeVotes: 1,
    contentNetVotes: 3,
    discussionId: 'discussion-123',
    isApiDefinition: false,
    isAICreated: false,
  };

  const mockVoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 4,
    contentNegativeVotes: 1,
    contentNetVotes: 3,
  };

  const mockVoteStatus = {
    inclusionStatus: 'agree' as const,
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentStatus: 'agree' as const,
    contentPositiveVotes: 4,
    contentNegativeVotes: 1,
    contentNetVotes: 3,
  };

  const mockReq = { user: { sub: 'user-456' } };

  beforeEach(async () => {
    const mockDefinitionService = {
      createDefinition: jest.fn(),
      getDefinition: jest.fn(),
      updateDefinition: jest.fn(),
      deleteDefinition: jest.fn(),
      voteInclusion: jest.fn(),
      voteContent: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
      getVotes: jest.fn(),
      getDefinitionsByWord: jest.fn(),
      getTopDefinitionForWord: jest.fn(),
      canCreateDefinitionForWord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DefinitionController],
      providers: [
        {
          provide: DefinitionService,
          useValue: mockDefinitionService,
        },
      ],
    }).compile();

    controller = module.get<DefinitionController>(DefinitionController);
    definitionService = module.get(
      DefinitionService,
    ) as jest.Mocked<DefinitionService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CRUD ENDPOINTS
  // ============================================

  describe('POST /definitions', () => {
    const createDto = {
      word: 'test',
      createdBy: 'user-123',
      definitionText: 'A test definition',
      publicCredit: true,
    };

    it('should create definition with all fields', async () => {
      definitionService.createDefinition.mockResolvedValue(mockDefinitionData);

      const result = await controller.createDefinition(createDto, mockReq);

      expect(definitionService.createDefinition).toHaveBeenCalledWith({
        word: 'test',
        createdBy: 'user-456', // From req.user.sub
        definitionText: 'A test definition',
        publicCredit: true,
        initialComment: undefined,
        isApiDefinition: undefined,
        isAICreated: undefined,
      });
      expect(result).toEqual(mockDefinitionData);
    });

    it('should create definition with minimal fields', async () => {
      definitionService.createDefinition.mockResolvedValue(mockDefinitionData);
      const minimalDto = {
        word: 'test',
        createdBy: 'ignored',
        definitionText: 'Test',
      };

      const result = await controller.createDefinition(minimalDto, mockReq);

      expect(definitionService.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'test',
          createdBy: 'user-456',
          definitionText: 'Test',
        }),
      );
      expect(result).toEqual(mockDefinitionData);
    });

    it('should create definition with initial comment', async () => {
      definitionService.createDefinition.mockResolvedValue(mockDefinitionData);
      const dtoWithComment = {
        ...createDto,
        initialComment: 'Initial comment',
      };

      await controller.createDefinition(dtoWithComment, mockReq);

      expect(definitionService.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          initialComment: 'Initial comment',
        }),
      );
    });

    it('should extract user ID from req.user.sub', async () => {
      definitionService.createDefinition.mockResolvedValue(mockDefinitionData);

      await controller.createDefinition(createDto, mockReq);

      expect(definitionService.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'user-456',
        }),
      );
    });

    it('should throw BadRequestException if word is missing', async () => {
      await expect(
        controller.createDefinition(
          { word: '', createdBy: 'user', definitionText: 'test' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createDefinition(
          { word: '', createdBy: 'user', definitionText: 'test' },
          mockReq,
        ),
      ).rejects.toThrow('Word is required');
    });

    it('should throw BadRequestException if definitionText is missing', async () => {
      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: '' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: '' },
          mockReq,
        ),
      ).rejects.toThrow('Definition text is required');
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.createDefinition(createDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createDefinition(createDto, { user: null }),
      ).rejects.toThrow('User ID is required');
    });

    it('should re-throw service exceptions', async () => {
      definitionService.createDefinition.mockRejectedValue(
        new BadRequestException('Service error'),
      );

      await expect(
        controller.createDefinition(createDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /definitions/:id', () => {
    it('should get definition by ID', async () => {
      definitionService.getDefinition.mockResolvedValue(mockDefinitionData);

      const result = await controller.getDefinition('def-123');

      expect(definitionService.getDefinition).toHaveBeenCalledWith('def-123');
      expect(result).toEqual(mockDefinitionData);
    });

    it('should throw NotFoundException if definition not found', async () => {
      definitionService.getDefinition.mockResolvedValue(null);

      await expect(controller.getDefinition('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getDefinition('nonexistent')).rejects.toThrow(
        'Definition with ID nonexistent not found',
      );
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(controller.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getDefinition('  ')).rejects.toThrow(
        'Definition ID is required',
      );
    });
  });

  describe('PUT /definitions/:id', () => {
    const updateDto = { definitionText: 'Updated definition' };

    it('should update definition', async () => {
      const updatedDefinition = { ...mockDefinitionData, ...updateDto };
      definitionService.updateDefinition.mockResolvedValue(updatedDefinition);

      const result = await controller.updateDefinition(
        'def-123',
        updateDto,
        mockReq,
      );

      expect(definitionService.updateDefinition).toHaveBeenCalledWith(
        'def-123',
        updateDto,
      );
      expect(result).toEqual(updatedDefinition);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(
        controller.updateDefinition('', updateDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.updateDefinition('def-123', updateDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw service exceptions', async () => {
      definitionService.updateDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.updateDefinition('def-123', updateDto, mockReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /definitions/:id', () => {
    it('should delete definition', async () => {
      definitionService.deleteDefinition.mockResolvedValue(undefined);

      await controller.deleteDefinition('def-123', mockReq);

      expect(definitionService.deleteDefinition).toHaveBeenCalledWith(
        'def-123',
      );
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(controller.deleteDefinition('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.deleteDefinition('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw service exceptions', async () => {
      definitionService.deleteDefinition.mockRejectedValue(
        new NotFoundException('Definition not found'),
      );

      await expect(
        controller.deleteDefinition('def-123', mockReq),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // VOTING ENDPOINTS (DUAL VOTING)
  // ============================================

  describe('POST /definitions/:id/vote-inclusion', () => {
    const voteDto = { isPositive: true };

    it('should vote on inclusion', async () => {
      definitionService.voteInclusion.mockResolvedValue(mockVoteResult);

      const result = await controller.voteInclusion(
        'def-123',
        voteDto,
        mockReq,
      );

      expect(definitionService.voteInclusion).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle negative votes', async () => {
      definitionService.voteInclusion.mockResolvedValue(mockVoteResult);
      const negativeVote = { isPositive: false };

      await controller.voteInclusion('def-123', negativeVote, mockReq);

      expect(definitionService.voteInclusion).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        false,
      );
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(
        controller.voteInclusion('', voteDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.voteInclusion('def-123', voteDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if isPositive is not boolean', async () => {
      await expect(
        controller.voteInclusion(
          'def-123',
          { isPositive: 'true' as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion(
          'def-123',
          { isPositive: 'true' as any },
          mockReq,
        ),
      ).rejects.toThrow('isPositive must be a boolean');
    });
  });

  describe('POST /definitions/:id/vote-content', () => {
    const voteDto = { isPositive: true };

    it('should vote on content', async () => {
      definitionService.voteContent.mockResolvedValue(mockVoteResult);

      const result = await controller.voteContent('def-123', voteDto, mockReq);

      expect(definitionService.voteContent).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle negative votes', async () => {
      definitionService.voteContent.mockResolvedValue(mockVoteResult);
      const negativeVote = { isPositive: false };

      await controller.voteContent('def-123', negativeVote, mockReq);

      expect(definitionService.voteContent).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        false,
      );
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(
        controller.voteContent('', voteDto, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is missing', async () => {
      await expect(
        controller.voteContent('def-123', voteDto, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if isPositive is not boolean', async () => {
      await expect(
        controller.voteContent(
          'def-123',
          { isPositive: 'true' as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /definitions/:id/vote-status', () => {
    it('should get vote status', async () => {
      definitionService.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await controller.getVoteStatus('def-123', mockReq);

      expect(definitionService.getVoteStatus).toHaveBeenCalledWith(
        'def-123',
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null if no vote', async () => {
      definitionService.getVoteStatus.mockResolvedValue(null);

      const result = await controller.getVoteStatus('def-123', mockReq);

      expect(result).toBeNull();
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(controller.getVoteStatus('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require authentication', async () => {
      await expect(
        controller.getVoteStatus('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('DELETE /definitions/:id/vote-inclusion', () => {
    it('should remove inclusion vote', async () => {
      definitionService.removeVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeInclusionVote('def-123', mockReq);

      expect(definitionService.removeVote).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        'INCLUSION',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(controller.removeInclusionVote('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require authentication', async () => {
      await expect(
        controller.removeInclusionVote('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('DELETE /definitions/:id/vote-content', () => {
    it('should remove content vote', async () => {
      definitionService.removeVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeContentVote('def-123', mockReq);

      expect(definitionService.removeVote).toHaveBeenCalledWith(
        'def-123',
        'user-456',
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(controller.removeContentVote('', mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should require authentication', async () => {
      await expect(
        controller.removeContentVote('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /definitions/:id/votes', () => {
    it('should get vote totals', async () => {
      definitionService.getVotes.mockResolvedValue(mockVoteResult);

      const result = await controller.getVotes('def-123');

      expect(definitionService.getVotes).toHaveBeenCalledWith('def-123');
      expect(result).toEqual(mockVoteResult);
    });

    it('should return null if no votes', async () => {
      definitionService.getVotes.mockResolvedValue(null);

      const result = await controller.getVotes('def-123');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException if id is empty', async () => {
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // QUERY ENDPOINTS
  // ============================================

  describe('GET /definitions/word/:word', () => {
    it('should get definitions by word', async () => {
      const mockDefinitions = [mockDefinitionData];
      definitionService.getDefinitionsByWord.mockResolvedValue(mockDefinitions);

      const result = await controller.getDefinitionsByWord('test');

      expect(definitionService.getDefinitionsByWord).toHaveBeenCalledWith(
        'test',
      );
      expect(result).toEqual({ definitions: mockDefinitions });
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(controller.getDefinitionsByWord('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /definitions/word/:word/top', () => {
    it('should get top definition for word', async () => {
      definitionService.getTopDefinitionForWord.mockResolvedValue(
        mockDefinitionData,
      );

      const result = await controller.getTopDefinitionForWord('test');

      expect(definitionService.getTopDefinitionForWord).toHaveBeenCalledWith(
        'test',
      );
      expect(result).toEqual(mockDefinitionData);
    });

    it('should throw NotFoundException if no definition found', async () => {
      definitionService.getTopDefinitionForWord.mockResolvedValue(null);

      await expect(controller.getTopDefinitionForWord('test')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getTopDefinitionForWord('test')).rejects.toThrow(
        'No approved definition found for word: test',
      );
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(controller.getTopDefinitionForWord('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('GET /definitions/word/:word/can-create', () => {
    it('should check if definitions can be created', async () => {
      definitionService.canCreateDefinitionForWord.mockResolvedValue(true);

      const result = await controller.canCreateDefinitionForWord('test');

      expect(definitionService.canCreateDefinitionForWord).toHaveBeenCalledWith(
        'test',
      );
      expect(result).toEqual({ canCreate: true });
    });

    it('should return false if word not eligible', async () => {
      definitionService.canCreateDefinitionForWord.mockResolvedValue(false);

      const result = await controller.canCreateDefinitionForWord('test');

      expect(result).toEqual({ canCreate: false });
    });

    it('should throw BadRequestException if word is empty', async () => {
      await expect(controller.canCreateDefinitionForWord('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // VALIDATION
  // ============================================

  describe('Input Validation', () => {
    it('should validate all required fields in createDefinition', async () => {
      await expect(
        controller.createDefinition(
          { word: '', createdBy: 'user', definitionText: 'test' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: '' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: 'test' },
          { user: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate parameter formats', async () => {
      await expect(controller.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );

      await expect(controller.getDefinitionsByWord('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate body DTOs', async () => {
      await expect(
        controller.voteInclusion(
          'def-123',
          { isPositive: 'not-bool' as any },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.voteContent('def-123', { isPositive: 123 as any }, mockReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // AUTHENTICATION
  // ============================================

  describe('Authentication', () => {
    it('should require authentication for createDefinition', async () => {
      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: 'test' },
          { user: null },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for updateDefinition', async () => {
      await expect(
        controller.updateDefinition('def-123', {}, { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for deleteDefinition', async () => {
      await expect(
        controller.deleteDefinition('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require authentication for voting', async () => {
      await expect(
        controller.voteInclusion(
          'def-123',
          { isPositive: true },
          { user: null },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.voteContent('def-123', { isPositive: true }, { user: null }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getVoteStatus('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.removeInclusionVote('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.removeContentVote('def-123', { user: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow anonymous access for getDefinition', async () => {
      definitionService.getDefinition.mockResolvedValue(mockDefinitionData);

      const result = await controller.getDefinition('def-123');

      expect(result).toEqual(mockDefinitionData);
    });

    it('should allow anonymous access for query endpoints', async () => {
      definitionService.getDefinitionsByWord.mockResolvedValue([
        mockDefinitionData,
      ]);

      const result = await controller.getDefinitionsByWord('test');

      expect(result).toEqual({ definitions: [mockDefinitionData] });
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('Error Handling', () => {
    it('should re-throw BadRequestException from service', async () => {
      definitionService.createDefinition.mockRejectedValue(
        new BadRequestException('Invalid input'),
      );

      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: 'test' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw NotFoundException from service', async () => {
      definitionService.getDefinition.mockResolvedValue(null);

      await expect(controller.getDefinition('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate all service errors', async () => {
      const serviceError = new Error('Service error');
      definitionService.createDefinition.mockRejectedValue(serviceError);

      await expect(
        controller.createDefinition(
          { word: 'test', createdBy: 'user', definitionText: 'test' },
          mockReq,
        ),
      ).rejects.toThrow(serviceError);
    });

    it('should handle validation errors before calling service', async () => {
      // Empty word should be caught by controller
      await expect(
        controller.createDefinition(
          { word: '', createdBy: 'user', definitionText: 'test' },
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);

      // Service should not be called
      expect(definitionService.createDefinition).not.toHaveBeenCalled();
    });
  });
});
