// src/nodes/openquestion/openquestion.controller.spec.ts - COMPREHENSIVE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { OpenQuestionController } from './openquestion.controller';
import { OpenQuestionService } from './openquestion.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OpenQuestionController - Comprehensive Tests', () => {
  let controller: OpenQuestionController;
  let openQuestionService: jest.Mocked<OpenQuestionService>;

  const mockOpenQuestionService = {
    createOpenQuestion: jest.fn(),
    getOpenQuestion: jest.fn(),
    updateOpenQuestion: jest.fn(),
    deleteOpenQuestion: jest.fn(),
    voteInclusion: jest.fn(),
    getVoteStatus: jest.fn(),
    removeVote: jest.fn(),
    getVotes: jest.fn(),
  };

  const mockRequest = {
    user: {
      sub: 'user-123',
      username: 'testuser',
    },
  };

  const mockRequestWithoutUser = {
    user: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenQuestionController],
      providers: [
        {
          provide: OpenQuestionService,
          useValue: mockOpenQuestionService,
        },
      ],
    }).compile();

    controller = module.get<OpenQuestionController>(OpenQuestionController);
    openQuestionService = module.get(OpenQuestionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CREATE OPEN QUESTION TESTS
  // ============================================
  describe('createOpenQuestion', () => {
    const validCreateDto = {
      questionText: 'What is the future of AI?',
      publicCredit: true,
      categoryIds: ['cat-1'],
      userKeywords: ['AI', 'future'],
      initialComment: 'Initial comment',
    };

    it('should create an open question successfully', async () => {
      const mockCreatedQuestion = {
        id: 'question-123',
        questionText: validCreateDto.questionText,
        createdBy: 'user-123',
        publicCredit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      openQuestionService.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion as any,
      );

      const result = await controller.createOpenQuestion(
        validCreateDto,
        mockRequest,
      );

      expect(openQuestionService.createOpenQuestion).toHaveBeenCalledWith({
        ...validCreateDto,
        createdBy: 'user-123',
        publicCredit: true,
      });
      expect(result).toEqual(mockCreatedQuestion);
    });

    it('should throw BadRequestException when questionText is empty', async () => {
      const invalidDto = {
        ...validCreateDto,
        questionText: '',
      };

      await expect(
        controller.createOpenQuestion(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when questionText is whitespace only', async () => {
      const invalidDto = {
        ...validCreateDto,
        questionText: '   ',
      };

      await expect(
        controller.createOpenQuestion(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when initialComment is empty', async () => {
      const invalidDto = {
        ...validCreateDto,
        initialComment: '',
      };

      await expect(
        controller.createOpenQuestion(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when initialComment is whitespace only', async () => {
      const invalidDto = {
        ...validCreateDto,
        initialComment: '   ',
      };

      await expect(
        controller.createOpenQuestion(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      const invalidDto = {
        ...validCreateDto,
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
      };

      await expect(
        controller.createOpenQuestion(invalidDto, mockRequest),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.createOpenQuestion(validCreateDto, mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should default publicCredit to true when not provided', async () => {
      const dtoWithoutPublicCredit = {
        questionText: 'Test question?',
        initialComment: 'Comment',
      };

      const mockCreatedQuestion = {
        id: 'question-123',
        questionText: dtoWithoutPublicCredit.questionText,
        publicCredit: true,
      };

      openQuestionService.createOpenQuestion.mockResolvedValue(
        mockCreatedQuestion as any,
      );

      await controller.createOpenQuestion(dtoWithoutPublicCredit, mockRequest);

      expect(openQuestionService.createOpenQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          publicCredit: true,
        }),
      );
    });

    it('should handle service errors gracefully', async () => {
      openQuestionService.createOpenQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.createOpenQuestion(validCreateDto, mockRequest),
      ).rejects.toThrow();
    });
  });

  // ============================================
  // GET OPEN QUESTION TESTS
  // ============================================
  describe('getOpenQuestion', () => {
    it('should retrieve an open question by ID', async () => {
      const mockQuestion = {
        id: 'question-123',
        questionText: 'What is AI?',
        createdBy: 'user-123',
        publicCredit: true,
      };

      openQuestionService.getOpenQuestion.mockResolvedValue(
        mockQuestion as any,
      );

      const result = await controller.getOpenQuestion('question-123');

      expect(openQuestionService.getOpenQuestion).toHaveBeenCalledWith(
        'question-123',
      );
      expect(result).toEqual(mockQuestion);
    });

    it('should throw NotFoundException when question does not exist', async () => {
      openQuestionService.getOpenQuestion.mockResolvedValue(null);

      await expect(
        controller.getOpenQuestion('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only ID', async () => {
      await expect(controller.getOpenQuestion('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // UPDATE OPEN QUESTION TESTS
  // ============================================
  describe('updateOpenQuestion', () => {
    const validUpdateDto = {
      questionText: 'Updated question?',
      publicCredit: false,
      userKeywords: ['updated'],
      categoryIds: ['cat-1'],
    };

    it('should update an open question successfully', async () => {
      const mockUpdatedQuestion = {
        id: 'question-123',
        questionText: 'Updated question?',
        publicCredit: false,
      };

      openQuestionService.updateOpenQuestion.mockResolvedValue(
        mockUpdatedQuestion as any,
      );

      const result = await controller.updateOpenQuestion(
        'question-123',
        validUpdateDto,
        mockRequest,
      );

      expect(openQuestionService.updateOpenQuestion).toHaveBeenCalledWith(
        'question-123',
        validUpdateDto,
      );
      expect(result).toEqual(mockUpdatedQuestion);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(
        controller.updateOpenQuestion('', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when ID is whitespace only', async () => {
      await expect(
        controller.updateOpenQuestion('   ', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.updateOpenQuestion(
          'question-123',
          validUpdateDto,
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');
    });

    it('should throw BadRequestException when no fields provided', async () => {
      await expect(
        controller.updateOpenQuestion('question-123', {}, mockRequest),
      ).rejects.toThrow('No update data provided');
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      const invalidDto = {
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
      };

      await expect(
        controller.updateOpenQuestion('question-123', invalidDto, mockRequest),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should allow updating questionText only', async () => {
      const updateDto = {
        questionText: 'New question text?',
      };

      openQuestionService.updateOpenQuestion.mockResolvedValue({
        id: 'question-123',
      } as any);

      await controller.updateOpenQuestion(
        'question-123',
        updateDto,
        mockRequest,
      );

      expect(openQuestionService.updateOpenQuestion).toHaveBeenCalledWith(
        'question-123',
        updateDto,
      );
    });

    it('should allow updating publicCredit only', async () => {
      const updateDto = {
        publicCredit: false,
      };

      openQuestionService.updateOpenQuestion.mockResolvedValue({
        id: 'question-123',
      } as any);

      await controller.updateOpenQuestion(
        'question-123',
        updateDto,
        mockRequest,
      );

      expect(openQuestionService.updateOpenQuestion).toHaveBeenCalledWith(
        'question-123',
        updateDto,
      );
    });

    it('should allow updating userKeywords only', async () => {
      const updateDto = {
        userKeywords: ['keyword1', 'keyword2'],
      };

      openQuestionService.updateOpenQuestion.mockResolvedValue({
        id: 'question-123',
      } as any);

      await controller.updateOpenQuestion(
        'question-123',
        updateDto,
        mockRequest,
      );

      expect(openQuestionService.updateOpenQuestion).toHaveBeenCalledWith(
        'question-123',
        updateDto,
      );
    });

    it('should allow updating categoryIds only', async () => {
      const updateDto = {
        categoryIds: ['cat-1', 'cat-2'],
      };

      openQuestionService.updateOpenQuestion.mockResolvedValue({
        id: 'question-123',
      } as any);

      await controller.updateOpenQuestion(
        'question-123',
        updateDto,
        mockRequest,
      );

      expect(openQuestionService.updateOpenQuestion).toHaveBeenCalledWith(
        'question-123',
        updateDto,
      );
    });
  });

  // ============================================
  // DELETE OPEN QUESTION TESTS
  // ============================================
  describe('deleteOpenQuestion', () => {
    it('should delete an open question successfully', async () => {
      openQuestionService.deleteOpenQuestion.mockResolvedValue(
        undefined as any,
      );

      await controller.deleteOpenQuestion('question-123', mockRequest);

      expect(openQuestionService.deleteOpenQuestion).toHaveBeenCalledWith(
        'question-123',
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.deleteOpenQuestion('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for whitespace-only ID', async () => {
      await expect(
        controller.deleteOpenQuestion('   ', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.deleteOpenQuestion('question-123', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate NotFoundException from service', async () => {
      openQuestionService.deleteOpenQuestion.mockRejectedValue(
        new NotFoundException('Question not found'),
      );

      await expect(
        controller.deleteOpenQuestion('question-123', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // VOTING TESTS - INCLUSION ONLY
  // ============================================
  describe('Voting Endpoints', () => {
    const voteDto = { isPositive: true };
    const mockVoteResult = {
      inclusionPositiveVotes: 5,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 3,
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };

    describe('voteInclusion', () => {
      it('should vote positively on question inclusion', async () => {
        openQuestionService.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await controller.voteInclusion(
          'question-123',
          voteDto,
          mockRequest,
        );

        expect(openQuestionService.voteInclusion).toHaveBeenCalledWith(
          'question-123',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on question inclusion', async () => {
        const negativeVoteDto = { isPositive: false };

        openQuestionService.voteInclusion.mockResolvedValue({
          ...mockVoteResult,
          inclusionNegativeVotes: 3,
        });

        const result = await controller.voteInclusion(
          'question-123',
          negativeVoteDto,
          mockRequest,
        );

        expect(openQuestionService.voteInclusion).toHaveBeenCalledWith(
          'question-123',
          'user-123',
          false,
        );
        expect(result.inclusionNegativeVotes).toBe(3);
      });

      it('should throw BadRequestException for empty question ID', async () => {
        await expect(
          controller.voteInclusion('', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for whitespace-only question ID', async () => {
        await expect(
          controller.voteInclusion('   ', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.voteInclusion(
            'question-123',
            voteDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException when isPositive is not a boolean', async () => {
        const invalidDto = { isPositive: 'yes' as any };

        await expect(
          controller.voteInclusion('question-123', invalidDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });

      it('should throw BadRequestException when isPositive is undefined', async () => {
        const invalidDto = {} as any;

        await expect(
          controller.voteInclusion('question-123', invalidDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });
    });

    describe('getVoteStatus', () => {
      const mockVoteStatus = {
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 3,
        contentStatus: null,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      it('should get vote status for current user', async () => {
        openQuestionService.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await controller.getVoteStatus(
          'question-123',
          mockRequest,
        );

        expect(openQuestionService.getVoteStatus).toHaveBeenCalledWith(
          'question-123',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when user has no vote', async () => {
        openQuestionService.getVoteStatus.mockResolvedValue(null);

        const result = await controller.getVoteStatus(
          'question-123',
          mockRequest,
        );

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty question ID', async () => {
        await expect(controller.getVoteStatus('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for whitespace-only question ID', async () => {
        await expect(
          controller.getVoteStatus('   ', mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.getVoteStatus('question-123', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('removeVote', () => {
      it('should remove vote from an open question', async () => {
        openQuestionService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote('question-123', mockRequest);

        expect(openQuestionService.removeVote).toHaveBeenCalledWith(
          'question-123',
          'user-123',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty question ID', async () => {
        await expect(controller.removeVote('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for whitespace-only question ID', async () => {
        await expect(controller.removeVote('   ', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.removeVote('question-123', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('getVotes', () => {
      it('should get vote totals for an open question', async () => {
        openQuestionService.getVotes.mockResolvedValue(mockVoteResult);

        const result = await controller.getVotes('question-123');

        expect(openQuestionService.getVotes).toHaveBeenCalledWith(
          'question-123',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should return null when question has no votes', async () => {
        openQuestionService.getVotes.mockResolvedValue(null);

        const result = await controller.getVotes('question-123');

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.getVotes('')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for whitespace-only ID', async () => {
        await expect(controller.getVotes('   ')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should propagate generic errors from service', async () => {
      openQuestionService.getOpenQuestion.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.getOpenQuestion('question-123'),
      ).rejects.toThrow();
    });

    it('should preserve NotFoundException from service', async () => {
      openQuestionService.getOpenQuestion.mockRejectedValue(
        new NotFoundException('Question not found'),
      );

      await expect(controller.getOpenQuestion('question-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from service', async () => {
      openQuestionService.updateOpenQuestion.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        controller.updateOpenQuestion(
          'question-123',
          { questionText: 'test' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate all ID parameters consistently', async () => {
      await expect(controller.getOpenQuestion('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.updateOpenQuestion('', {}, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteOpenQuestion('', mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
