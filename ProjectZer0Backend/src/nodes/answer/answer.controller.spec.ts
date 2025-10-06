// src/nodes/answer/answer.controller.spec.ts - COMPREHENSIVE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { AnswerController } from './answer.controller';
import { AnswerService } from './answer.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AnswerController - Comprehensive Tests', () => {
  let controller: AnswerController;
  let answerService: jest.Mocked<AnswerService>;

  const mockAnswerService = {
    createAnswer: jest.fn(),
    getAnswer: jest.fn(),
    updateAnswer: jest.fn(),
    deleteAnswer: jest.fn(),
    getAnswersForQuestion: jest.fn(),
    voteInclusion: jest.fn(),
    voteContent: jest.fn(),
    getVoteStatus: jest.fn(),
    removeVote: jest.fn(),
    getVotes: jest.fn(),
    isAnswerApproved: jest.fn(),
    isContentVotingAvailable: jest.fn(),
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
      controllers: [AnswerController],
      providers: [
        {
          provide: AnswerService,
          useValue: mockAnswerService,
        },
      ],
    }).compile();

    controller = module.get<AnswerController>(AnswerController);
    answerService = module.get(AnswerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CREATE ANSWER TESTS
  // ============================================
  describe('createAnswer', () => {
    const validCreateDto = {
      answerText: 'This is a comprehensive answer.',
      publicCredit: true,
      parentQuestionId: 'question-123',
      categoryIds: ['cat-1'],
      userKeywords: ['comprehensive', 'answer'],
      initialComment: 'Initial comment',
    };

    it('should create an answer successfully', async () => {
      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: validCreateDto.answerText,
        createdBy: 'user-123',
        publicCredit: true,
        parentQuestionId: validCreateDto.parentQuestionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      answerService.createAnswer.mockResolvedValue(mockCreatedAnswer as any);

      const result = await controller.createAnswer(validCreateDto, mockRequest);

      expect(answerService.createAnswer).toHaveBeenCalledWith({
        ...validCreateDto,
        createdBy: 'user-123',
        publicCredit: true,
      });
      expect(result).toEqual(mockCreatedAnswer);
    });

    it('should throw BadRequestException when answerText is empty', async () => {
      const invalidDto = {
        ...validCreateDto,
        answerText: '',
      };

      await expect(
        controller.createAnswer(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when answerText is whitespace only', async () => {
      const invalidDto = {
        ...validCreateDto,
        answerText: '   ',
      };

      await expect(
        controller.createAnswer(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parentQuestionId is empty', async () => {
      const invalidDto = {
        ...validCreateDto,
        parentQuestionId: '',
      };

      await expect(
        controller.createAnswer(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when parentQuestionId is whitespace only', async () => {
      const invalidDto = {
        ...validCreateDto,
        parentQuestionId: '   ',
      };

      await expect(
        controller.createAnswer(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      const invalidDto = {
        ...validCreateDto,
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
      };

      await expect(
        controller.createAnswer(invalidDto, mockRequest),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.createAnswer(validCreateDto, mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should default publicCredit to true when not provided', async () => {
      const dtoWithoutPublicCredit = {
        answerText: 'Test answer',
        parentQuestionId: 'question-123',
        initialComment: 'Comment',
      };

      const mockCreatedAnswer = {
        id: 'answer-123',
        answerText: dtoWithoutPublicCredit.answerText,
        publicCredit: true,
      };

      answerService.createAnswer.mockResolvedValue(mockCreatedAnswer as any);

      await controller.createAnswer(dtoWithoutPublicCredit, mockRequest);

      expect(answerService.createAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          publicCredit: true,
        }),
      );
    });

    it('should handle service errors gracefully', async () => {
      answerService.createAnswer.mockRejectedValue(new Error('Database error'));

      await expect(
        controller.createAnswer(validCreateDto, mockRequest),
      ).rejects.toThrow();
    });
  });

  // ============================================
  // GET ANSWER TESTS
  // ============================================
  describe('getAnswer', () => {
    it('should retrieve an answer by ID', async () => {
      const mockAnswer = {
        id: 'answer-123',
        answerText: 'Test answer',
        createdBy: 'user-123',
        publicCredit: true,
      };

      answerService.getAnswer.mockResolvedValue(mockAnswer as any);

      const result = await controller.getAnswer('answer-123');

      expect(answerService.getAnswer).toHaveBeenCalledWith('answer-123');
      expect(result).toEqual(mockAnswer);
    });

    it('should throw NotFoundException when answer does not exist', async () => {
      answerService.getAnswer.mockResolvedValue(null);

      await expect(controller.getAnswer('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getAnswer('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only ID', async () => {
      await expect(controller.getAnswer('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // UPDATE ANSWER TESTS
  // ============================================
  describe('updateAnswer', () => {
    const validUpdateDto = {
      answerText: 'Updated answer',
      publicCredit: false,
      userKeywords: ['updated'],
      categoryIds: ['cat-1'],
    };

    it('should update an answer successfully', async () => {
      const mockUpdatedAnswer = {
        id: 'answer-123',
        answerText: 'Updated answer',
        publicCredit: false,
      };

      answerService.updateAnswer.mockResolvedValue(mockUpdatedAnswer as any);

      const result = await controller.updateAnswer(
        'answer-123',
        validUpdateDto,
        mockRequest,
      );

      expect(answerService.updateAnswer).toHaveBeenCalledWith(
        'answer-123',
        validUpdateDto,
      );
      expect(result).toEqual(mockUpdatedAnswer);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(
        controller.updateAnswer('', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when ID is whitespace only', async () => {
      await expect(
        controller.updateAnswer('   ', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.updateAnswer(
          'answer-123',
          validUpdateDto,
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');
    });

    it('should throw BadRequestException when no fields provided', async () => {
      await expect(
        controller.updateAnswer('answer-123', {}, mockRequest),
      ).rejects.toThrow('No update data provided');
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      const invalidDto = {
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
      };

      await expect(
        controller.updateAnswer('answer-123', invalidDto, mockRequest),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should allow updating answerText only', async () => {
      const updateDto = {
        answerText: 'New answer text',
      };

      answerService.updateAnswer.mockResolvedValue({
        id: 'answer-123',
      } as any);

      await controller.updateAnswer('answer-123', updateDto, mockRequest);

      expect(answerService.updateAnswer).toHaveBeenCalledWith(
        'answer-123',
        updateDto,
      );
    });

    it('should allow updating publicCredit only', async () => {
      const updateDto = {
        publicCredit: false,
      };

      answerService.updateAnswer.mockResolvedValue({
        id: 'answer-123',
      } as any);

      await controller.updateAnswer('answer-123', updateDto, mockRequest);

      expect(answerService.updateAnswer).toHaveBeenCalledWith(
        'answer-123',
        updateDto,
      );
    });

    it('should allow updating userKeywords only', async () => {
      const updateDto = {
        userKeywords: ['keyword1', 'keyword2'],
      };

      answerService.updateAnswer.mockResolvedValue({
        id: 'answer-123',
      } as any);

      await controller.updateAnswer('answer-123', updateDto, mockRequest);

      expect(answerService.updateAnswer).toHaveBeenCalledWith(
        'answer-123',
        updateDto,
      );
    });

    it('should allow updating categoryIds only', async () => {
      const updateDto = {
        categoryIds: ['cat-1', 'cat-2'],
      };

      answerService.updateAnswer.mockResolvedValue({
        id: 'answer-123',
      } as any);

      await controller.updateAnswer('answer-123', updateDto, mockRequest);

      expect(answerService.updateAnswer).toHaveBeenCalledWith(
        'answer-123',
        updateDto,
      );
    });
  });

  // ============================================
  // DELETE ANSWER TESTS
  // ============================================
  describe('deleteAnswer', () => {
    it('should delete an answer successfully', async () => {
      answerService.deleteAnswer.mockResolvedValue(undefined as any);

      await controller.deleteAnswer('answer-123', mockRequest);

      expect(answerService.deleteAnswer).toHaveBeenCalledWith('answer-123');
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.deleteAnswer('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only ID', async () => {
      await expect(controller.deleteAnswer('   ', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.deleteAnswer('answer-123', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate NotFoundException from service', async () => {
      answerService.deleteAnswer.mockRejectedValue(
        new NotFoundException('Answer not found'),
      );

      await expect(
        controller.deleteAnswer('answer-123', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // GET ANSWERS FOR QUESTION TESTS
  // ============================================
  describe('getAnswersForQuestion', () => {
    it('should get answers for a question', async () => {
      const mockAnswers = [
        { id: 'answer-1', answerText: 'Answer 1' },
        { id: 'answer-2', answerText: 'Answer 2' },
      ];

      answerService.getAnswersForQuestion.mockResolvedValue(mockAnswers as any);

      const result = await controller.getAnswersForQuestion('question-123');

      expect(answerService.getAnswersForQuestion).toHaveBeenCalledWith(
        'question-123',
        {
          limit: undefined,
          offset: 0,
          sortBy: 'created',
          sortDirection: 'desc',
          onlyApproved: false,
        },
      );
      expect(result).toEqual(mockAnswers);
    });

    it('should get answers with custom options', async () => {
      const mockAnswers = [{ id: 'answer-1' }];

      answerService.getAnswersForQuestion.mockResolvedValue(mockAnswers as any);

      await controller.getAnswersForQuestion(
        'question-123',
        '10',
        '5',
        'content_votes',
        'asc',
        'true',
      );

      expect(answerService.getAnswersForQuestion).toHaveBeenCalledWith(
        'question-123',
        {
          limit: 10,
          offset: 5,
          sortBy: 'content_votes',
          sortDirection: 'asc',
          onlyApproved: true,
        },
      );
    });

    it('should throw BadRequestException for empty question ID', async () => {
      await expect(controller.getAnswersForQuestion('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only question ID', async () => {
      await expect(controller.getAnswersForQuestion('   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle string numbers for limit and offset', async () => {
      answerService.getAnswersForQuestion.mockResolvedValue([]);

      await controller.getAnswersForQuestion('question-123', '20', '10');

      expect(answerService.getAnswersForQuestion).toHaveBeenCalledWith(
        'question-123',
        expect.objectContaining({
          limit: 20,
          offset: 10,
        }),
      );
    });
  });

  // ============================================
  // VOTING TESTS - DUAL VOTING
  // ============================================
  describe('Voting Endpoints', () => {
    const voteDto = { isPositive: true };
    const mockVoteResult = {
      inclusionPositiveVotes: 5,
      inclusionNegativeVotes: 2,
      inclusionNetVotes: 3,
      contentPositiveVotes: 3,
      contentNegativeVotes: 1,
      contentNetVotes: 2,
    };

    describe('voteInclusion', () => {
      it('should vote positively on answer inclusion', async () => {
        answerService.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await controller.voteInclusion(
          'answer-123',
          voteDto,
          mockRequest,
        );

        expect(answerService.voteInclusion).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on answer inclusion', async () => {
        const negativeVoteDto = { isPositive: false };

        answerService.voteInclusion.mockResolvedValue({
          ...mockVoteResult,
          inclusionNegativeVotes: 3,
        });

        const result = await controller.voteInclusion(
          'answer-123',
          negativeVoteDto,
          mockRequest,
        );

        expect(answerService.voteInclusion).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
          false,
        );
        expect(result.inclusionNegativeVotes).toBe(3);
      });

      it('should throw BadRequestException for empty answer ID', async () => {
        await expect(
          controller.voteInclusion('', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for whitespace-only answer ID', async () => {
        await expect(
          controller.voteInclusion('   ', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.voteInclusion(
            'answer-123',
            voteDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException when isPositive is not a boolean', async () => {
        const invalidDto = { isPositive: 'yes' as any };

        await expect(
          controller.voteInclusion('answer-123', invalidDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });

      it('should throw BadRequestException when isPositive is undefined', async () => {
        const invalidDto = {} as any;

        await expect(
          controller.voteInclusion('answer-123', invalidDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });
    });

    describe('voteContent', () => {
      it('should vote positively on answer content', async () => {
        answerService.voteContent.mockResolvedValue(mockVoteResult);

        const result = await controller.voteContent(
          'answer-123',
          voteDto,
          mockRequest,
        );

        expect(answerService.voteContent).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on answer content', async () => {
        const negativeVoteDto = { isPositive: false };

        answerService.voteContent.mockResolvedValue({
          ...mockVoteResult,
          contentNegativeVotes: 2,
        });

        const result = await controller.voteContent(
          'answer-123',
          negativeVoteDto,
          mockRequest,
        );

        expect(answerService.voteContent).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
          false,
        );
        expect(result.contentNegativeVotes).toBe(2);
      });

      it('should throw BadRequestException for empty answer ID', async () => {
        await expect(
          controller.voteContent('', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for whitespace-only answer ID', async () => {
        await expect(
          controller.voteContent('   ', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.voteContent('answer-123', voteDto, mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException when isPositive is not a boolean', async () => {
        const invalidDto = { isPositive: 'yes' as any };

        await expect(
          controller.voteContent('answer-123', invalidDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });
    });

    describe('getVoteStatus', () => {
      const mockVoteStatus = {
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 2,
        inclusionNetVotes: 3,
        contentStatus: 'agree' as const,
        contentPositiveVotes: 3,
        contentNegativeVotes: 1,
        contentNetVotes: 2,
      };

      it('should get vote status for current user', async () => {
        answerService.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await controller.getVoteStatus(
          'answer-123',
          mockRequest,
        );

        expect(answerService.getVoteStatus).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when user has no vote', async () => {
        answerService.getVoteStatus.mockResolvedValue(null);

        const result = await controller.getVoteStatus(
          'answer-123',
          mockRequest,
        );

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty answer ID', async () => {
        await expect(controller.getVoteStatus('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for whitespace-only answer ID', async () => {
        await expect(
          controller.getVoteStatus('   ', mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.getVoteStatus('answer-123', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('removeVote', () => {
      it('should remove inclusion vote from an answer', async () => {
        const removeVoteDto = { kind: 'INCLUSION' as const };

        answerService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote(
          'answer-123',
          removeVoteDto,
          mockRequest,
        );

        expect(answerService.removeVote).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote from an answer', async () => {
        const removeVoteDto = { kind: 'CONTENT' as const };

        answerService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote(
          'answer-123',
          removeVoteDto,
          mockRequest,
        );

        expect(answerService.removeVote).toHaveBeenCalledWith(
          'answer-123',
          'user-123',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty answer ID', async () => {
        const removeVoteDto = { kind: 'INCLUSION' as const };

        await expect(
          controller.removeVote('', removeVoteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for whitespace-only answer ID', async () => {
        const removeVoteDto = { kind: 'INCLUSION' as const };

        await expect(
          controller.removeVote('   ', removeVoteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        const removeVoteDto = { kind: 'INCLUSION' as const };

        await expect(
          controller.removeVote(
            'answer-123',
            removeVoteDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException for invalid vote kind', async () => {
        const invalidDto = { kind: 'INVALID' as any };

        await expect(
          controller.removeVote('answer-123', invalidDto, mockRequest),
        ).rejects.toThrow('Vote kind must be INCLUSION or CONTENT');
      });

      it('should throw BadRequestException when kind is missing', async () => {
        const invalidDto = {} as any;

        await expect(
          controller.removeVote('answer-123', invalidDto, mockRequest),
        ).rejects.toThrow('Vote kind must be INCLUSION or CONTENT');
      });
    });

    describe('getVotes', () => {
      it('should get vote totals for an answer', async () => {
        answerService.getVotes.mockResolvedValue(mockVoteResult);

        const result = await controller.getVotes('answer-123');

        expect(answerService.getVotes).toHaveBeenCalledWith('answer-123');
        expect(result).toEqual(mockVoteResult);
      });

      it('should return null when answer has no votes', async () => {
        answerService.getVotes.mockResolvedValue(null);

        const result = await controller.getVotes('answer-123');

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
  // UTILITY ENDPOINTS TESTS
  // ============================================
  describe('Utility Endpoints', () => {
    describe('isAnswerApproved', () => {
      it('should return approval status', async () => {
        answerService.isAnswerApproved.mockResolvedValue(true);

        const result = await controller.isAnswerApproved('answer-123');

        expect(answerService.isAnswerApproved).toHaveBeenCalledWith(
          'answer-123',
        );
        expect(result).toEqual({ isApproved: true });
      });

      it('should return false when answer not approved', async () => {
        answerService.isAnswerApproved.mockResolvedValue(false);

        const result = await controller.isAnswerApproved('answer-123');

        expect(result).toEqual({ isApproved: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.isAnswerApproved('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('isContentVotingAvailable', () => {
      it('should return content voting availability', async () => {
        answerService.isContentVotingAvailable.mockResolvedValue(true);

        const result = await controller.isContentVotingAvailable('answer-123');

        expect(answerService.isContentVotingAvailable).toHaveBeenCalledWith(
          'answer-123',
        );
        expect(result).toEqual({ isAvailable: true });
      });

      it('should return false when content voting not available', async () => {
        answerService.isContentVotingAvailable.mockResolvedValue(false);

        const result = await controller.isContentVotingAvailable('answer-123');

        expect(result).toEqual({ isAvailable: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.isContentVotingAvailable('')).rejects.toThrow(
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
      answerService.getAnswer.mockRejectedValue(new Error('Database error'));

      await expect(controller.getAnswer('answer-123')).rejects.toThrow();
    });

    it('should preserve NotFoundException from service', async () => {
      answerService.getAnswer.mockRejectedValue(
        new NotFoundException('Answer not found'),
      );

      await expect(controller.getAnswer('answer-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from service', async () => {
      answerService.updateAnswer.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        controller.updateAnswer(
          'answer-123',
          { answerText: 'test' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate all ID parameters consistently', async () => {
      await expect(controller.getAnswer('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.updateAnswer('', {}, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.deleteAnswer('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.voteInclusion('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteContent('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
