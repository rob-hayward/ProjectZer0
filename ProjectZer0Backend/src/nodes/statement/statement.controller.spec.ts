// src/nodes/statement/statement.controller.spec.ts - COMPREHENSIVE UPDATED VERSION

import { Test, TestingModule } from '@nestjs/testing';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('StatementController - Comprehensive Tests', () => {
  let controller: StatementController;
  let statementService: jest.Mocked<StatementService>;

  const mockStatementService = {
    createStatement: jest.fn(),
    getStatement: jest.fn(),
    updateStatement: jest.fn(),
    deleteStatement: jest.fn(),
    getStatementNetwork: jest.fn(),
    voteInclusion: jest.fn(),
    voteContent: jest.fn(),
    getVoteStatus: jest.fn(),
    removeVote: jest.fn(),
    getVotes: jest.fn(),
    createDirectRelationship: jest.fn(),
    removeDirectRelationship: jest.fn(),
    getDirectlyRelatedStatements: jest.fn(),
    createRelatedStatement: jest.fn(),
    checkStatements: jest.fn(),
    isStatementApproved: jest.fn(),
    isContentVotingAvailable: jest.fn(),
  };

  const mockDiscussionService = {
    getDiscussion: jest.fn(),
  };

  const mockCommentService = {
    createComment: jest.fn(),
    getCommentsByDiscussionId: jest.fn(),
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
      controllers: [StatementController],
      providers: [
        {
          provide: StatementService,
          useValue: mockStatementService,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    controller = module.get<StatementController>(StatementController);
    statementService = module.get(StatementService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CREATE STATEMENT TESTS
  // ============================================
  describe('createStatement', () => {
    const validCreateDto = {
      publicCredit: true,
      statement: 'Test statement about technology',
      userKeywords: ['test', 'technology'],
      initialComment: 'Initial comment',
      categoryIds: ['cat-1'],
    };

    it('should create a statement successfully', async () => {
      const mockCreatedStatement = {
        id: 'test-id',
        statement: validCreateDto.statement,
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

      statementService.createStatement.mockResolvedValue(
        mockCreatedStatement as any,
      );

      const result = await controller.createStatement(
        validCreateDto,
        mockRequest,
      );

      expect(statementService.createStatement).toHaveBeenCalledWith({
        ...validCreateDto,
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockCreatedStatement);
    });

    it('should throw BadRequestException when statement is empty', async () => {
      const invalidDto = {
        ...validCreateDto,
        statement: '',
      };

      await expect(
        controller.createStatement(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when statement is whitespace only', async () => {
      const invalidDto = {
        ...validCreateDto,
        statement: '   ',
      };

      await expect(
        controller.createStatement(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when initialComment is empty', async () => {
      const invalidDto = {
        ...validCreateDto,
        initialComment: '',
      };

      await expect(
        controller.createStatement(invalidDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      const invalidDto = {
        ...validCreateDto,
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'], // Max is 3
      };

      await expect(
        controller.createStatement(invalidDto, mockRequest),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.createStatement(validCreateDto, mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should handle service errors gracefully', async () => {
      statementService.createStatement.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.createStatement(validCreateDto, mockRequest),
      ).rejects.toThrow();
    });
  });

  // ============================================
  // GET STATEMENT TESTS
  // ============================================
  describe('getStatement', () => {
    it('should retrieve a statement by ID', async () => {
      const mockStatement = {
        id: 'test-id',
        statement: 'Test statement',
        createdBy: 'user-123',
        publicCredit: true,
      };

      statementService.getStatement.mockResolvedValue(mockStatement as any);

      const result = await controller.getStatement('test-id');

      expect(statementService.getStatement).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatement);
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementService.getStatement.mockResolvedValue(null);

      await expect(controller.getStatement('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only ID', async () => {
      await expect(controller.getStatement('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // UPDATE STATEMENT TESTS
  // ============================================
  describe('updateStatement', () => {
    const validUpdateDto = {
      statement: 'Updated statement',
      publicCredit: false,
      userKeywords: ['updated'],
    };

    it('should update a statement successfully', async () => {
      const mockUpdatedStatement = {
        id: 'test-id',
        statement: 'Updated statement',
        publicCredit: false,
      };

      statementService.updateStatement.mockResolvedValue(
        mockUpdatedStatement as any,
      );

      const result = await controller.updateStatement(
        'test-id',
        validUpdateDto,
        mockRequest,
      );

      expect(statementService.updateStatement).toHaveBeenCalledWith(
        'test-id',
        validUpdateDto,
      );
      expect(result).toEqual(mockUpdatedStatement);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(
        controller.updateStatement('', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.updateStatement(
          'test-id',
          validUpdateDto,
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');
    });

    it('should throw BadRequestException when no fields provided', async () => {
      await expect(
        controller.updateStatement('test-id', {}, mockRequest),
      ).rejects.toThrow('At least one field must be provided for update');
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      const invalidDto = {
        categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
      };

      await expect(
        controller.updateStatement('test-id', invalidDto, mockRequest),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw NotFoundException when statement does not exist', async () => {
      statementService.updateStatement.mockResolvedValue(null);

      await expect(
        controller.updateStatement('test-id', validUpdateDto, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // DELETE STATEMENT TESTS
  // ============================================
  describe('deleteStatement', () => {
    it('should delete a statement successfully', async () => {
      statementService.deleteStatement.mockResolvedValue(undefined as any);

      await controller.deleteStatement('test-id', mockRequest);

      expect(statementService.deleteStatement).toHaveBeenCalledWith('test-id');
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.deleteStatement('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.deleteStatement('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate NotFoundException from service', async () => {
      statementService.deleteStatement.mockRejectedValue(
        new NotFoundException('Statement not found'),
      );

      await expect(
        controller.deleteStatement('test-id', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // VOTING TESTS
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
      it('should vote on statement inclusion', async () => {
        statementService.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await controller.voteInclusion(
          'test-id',
          voteDto,
          mockRequest,
        );

        expect(statementService.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should handle negative votes', async () => {
        const negativeVoteDto = { isPositive: false };
        statementService.voteInclusion.mockResolvedValue(mockVoteResult);

        await controller.voteInclusion('test-id', negativeVoteDto, mockRequest);

        expect(statementService.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          false,
        );
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.voteInclusion('', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.voteInclusion('test-id', voteDto, mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException when isPositive is not boolean', async () => {
        const invalidVoteDto = { isPositive: 'true' as any };

        await expect(
          controller.voteInclusion('test-id', invalidVoteDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });
    });

    describe('voteContent', () => {
      const contentVoteResult = {
        ...mockVoteResult,
        contentPositiveVotes: 3,
        contentNetVotes: 3,
      };

      it('should vote on statement content', async () => {
        statementService.voteContent.mockResolvedValue(contentVoteResult);

        const result = await controller.voteContent(
          'test-id',
          voteDto,
          mockRequest,
        );

        expect(statementService.voteContent).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(contentVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.voteContent('', voteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.voteContent('test-id', voteDto, mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException when isPositive is not boolean', async () => {
        const invalidVoteDto = { isPositive: 1 as any };

        await expect(
          controller.voteContent('test-id', invalidVoteDto, mockRequest),
        ).rejects.toThrow('isPositive must be a boolean');
      });

      it('should propagate BadRequestException from service (inclusion threshold)', async () => {
        statementService.voteContent.mockRejectedValue(
          new BadRequestException('Statement must pass inclusion threshold'),
        );

        await expect(
          controller.voteContent('test-id', voteDto, mockRequest),
        ).rejects.toThrow('Statement must pass inclusion threshold');
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
        statementService.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await controller.getVoteStatus('test-id', mockRequest);

        expect(statementService.getVoteStatus).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when user has not voted', async () => {
        statementService.getVoteStatus.mockResolvedValue(null);

        const result = await controller.getVoteStatus('test-id', mockRequest);

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.getVoteStatus('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.getVoteStatus('test-id', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('removeVote', () => {
      const removeVoteDto = { kind: 'INCLUSION' as const };

      it('should remove inclusion vote', async () => {
        statementService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote(
          'test-id',
          removeVoteDto,
          mockRequest,
        );

        expect(statementService.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote', async () => {
        const contentRemoveDto = { kind: 'CONTENT' as const };
        statementService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote(
          'test-id',
          contentRemoveDto,
          mockRequest,
        );

        expect(statementService.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.removeVote('', removeVoteDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.removeVote(
            'test-id',
            removeVoteDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException for invalid vote kind', async () => {
        const invalidDto = { kind: 'INVALID' as any };

        await expect(
          controller.removeVote('test-id', invalidDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getVotes', () => {
      it('should get vote counts for a statement', async () => {
        statementService.getVotes.mockResolvedValue(mockVoteResult);

        const result = await controller.getVotes('test-id');

        expect(statementService.getVotes).toHaveBeenCalledWith('test-id');
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.getVotes('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // ============================================
  // STATEMENT NETWORK TESTS
  // ============================================
  describe('getStatementNetwork', () => {
    const mockNetwork = [
      { id: '1', statement: 'Test 1', inclusionNetVotes: 5 },
      { id: '2', statement: 'Test 2', inclusionNetVotes: 3 },
    ];

    it('should get statement network with all parameters', async () => {
      statementService.getStatementNetwork.mockResolvedValue(
        mockNetwork as any,
      );

      const result = await controller.getStatementNetwork(
        '10',
        '5',
        'inclusionNetVotes',
        'desc',
        ['keyword1', 'keyword2'],
        'user-456',
      );

      expect(statementService.getStatementNetwork).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        sortBy: 'inclusionNetVotes',
        sortDirection: 'desc',
        keywords: ['keyword1', 'keyword2'],
        userId: 'user-456',
      });
      expect(result).toEqual(mockNetwork);
    });

    it('should get statement network with default parameters', async () => {
      statementService.getStatementNetwork.mockResolvedValue(
        mockNetwork as any,
      );

      const result = await controller.getStatementNetwork();

      expect(statementService.getStatementNetwork).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        sortBy: 'netPositive', // Controller provides default
        sortDirection: 'desc', // Controller provides default
        keywords: undefined,
        userId: undefined,
      });
      expect(result).toEqual(mockNetwork);
    });

    it('should handle string numbers for limit and offset', async () => {
      statementService.getStatementNetwork.mockResolvedValue(
        mockNetwork as any,
      );

      await controller.getStatementNetwork('20', '10');

      expect(statementService.getStatementNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 10,
        }),
      );
    });
  });

  // ============================================
  // RELATIONSHIP TESTS
  // ============================================
  describe('Relationship Operations', () => {
    describe('createDirectRelationship', () => {
      it('should create a relationship between two statements', async () => {
        const mockResult = { success: true };
        statementService.createDirectRelationship.mockResolvedValue(mockResult);

        const result = await controller.createDirectRelationship('id1', 'id2');

        expect(statementService.createDirectRelationship).toHaveBeenCalledWith(
          'id1',
          'id2',
        );
        expect(result).toEqual(mockResult);
      });

      it('should throw BadRequestException when IDs are missing', async () => {
        await expect(
          controller.createDirectRelationship('', 'id2'),
        ).rejects.toThrow('Both statement IDs are required');

        await expect(
          controller.createDirectRelationship('id1', ''),
        ).rejects.toThrow('Both statement IDs are required');
      });
    });

    describe('removeDirectRelationship', () => {
      it('should remove a relationship between two statements', async () => {
        statementService.removeDirectRelationship.mockResolvedValue(undefined);

        await controller.removeDirectRelationship('id1', 'id2');

        expect(statementService.removeDirectRelationship).toHaveBeenCalledWith(
          'id1',
          'id2',
        );
      });

      it('should throw BadRequestException when IDs are missing', async () => {
        await expect(
          controller.removeDirectRelationship('', 'id2'),
        ).rejects.toThrow('Both statement IDs are required');
      });
    });

    describe('getDirectlyRelatedStatements', () => {
      it('should get directly related statements', async () => {
        const mockStatements = [
          {
            id: 'related1',
            statement: 'Related 1',
            createdBy: 'user',
            publicCredit: true,
          },
          {
            id: 'related2',
            statement: 'Related 2',
            createdBy: 'user',
            publicCredit: true,
          },
        ];

        statementService.getDirectlyRelatedStatements.mockResolvedValue(
          mockStatements as any,
        );

        const result = await controller.getDirectlyRelatedStatements('test-id');

        expect(
          statementService.getDirectlyRelatedStatements,
        ).toHaveBeenCalledWith('test-id');
        expect(result).toEqual({ relatedStatements: mockStatements });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.getDirectlyRelatedStatements(''),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('createRelatedStatement', () => {
      const validCreateDto = {
        publicCredit: true,
        statement: 'Related statement',
        initialComment: 'Comment',
      };

      it('should create a related statement', async () => {
        const mockCreatedStatement = {
          id: 'new-id',
          statement: validCreateDto.statement,
        };

        statementService.createRelatedStatement.mockResolvedValue(
          mockCreatedStatement as any,
        );

        const result = await controller.createRelatedStatement(
          'existing-id',
          validCreateDto,
          mockRequest,
        );

        expect(statementService.createRelatedStatement).toHaveBeenCalledWith(
          'existing-id',
          expect.objectContaining({
            ...validCreateDto,
            createdBy: 'user-123',
          }),
        );
        expect(result).toEqual(mockCreatedStatement);
      });

      it('should throw BadRequestException for empty existing ID', async () => {
        await expect(
          controller.createRelatedStatement('', validCreateDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.createRelatedStatement(
            'existing-id',
            validCreateDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });
    });
  });

  // ============================================
  // UTILITY ENDPOINTS TESTS
  // ============================================
  describe('Utility Endpoints', () => {
    describe('checkStatements', () => {
      it('should return statement count', async () => {
        const mockResult = { count: 42 };
        statementService.checkStatements.mockResolvedValue(mockResult);

        const result = await controller.checkStatements();

        expect(statementService.checkStatements).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
      });
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should propagate generic errors from service', async () => {
      statementService.getStatement.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getStatement('test-id')).rejects.toThrow();
    });

    it('should preserve NotFoundException from service', async () => {
      statementService.getStatement.mockRejectedValue(
        new NotFoundException('Statement not found'),
      );

      await expect(controller.getStatement('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from service', async () => {
      statementService.updateStatement.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        controller.updateStatement(
          'test-id',
          { statement: 'test' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate all ID parameters consistently', async () => {
      await expect(controller.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.updateStatement('', {}, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.deleteStatement('', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.voteInclusion('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteContent('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================
  // JWT AUTHENTICATION TESTS
  // ============================================
  describe('JWT Authentication', () => {
    it('should extract and use authenticated user ID for createStatement', async () => {
      const mockStatement = {
        id: 'test-id',
        statement: 'Test',
        createdBy: 'user-123',
        publicCredit: true,
      };

      statementService.createStatement.mockResolvedValue(mockStatement as any);

      const createDto = {
        statement: 'Test',
        publicCredit: true,
        initialComment: 'Comment',
      };

      await controller.createStatement(createDto, mockRequest);

      expect(statementService.createStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'user-123',
        }),
      );
    });

    it('should extract and use authenticated user ID for voting', async () => {
      const mockVoteResult = {
        inclusionPositiveVotes: 1,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 1,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      statementService.voteInclusion.mockResolvedValue(mockVoteResult);

      await controller.voteInclusion(
        'test-id',
        { isPositive: true },
        mockRequest,
      );

      expect(statementService.voteInclusion).toHaveBeenCalledWith(
        'test-id',
        'user-123',
        true,
      );
    });

    it('should require authentication for protected endpoints', async () => {
      await expect(
        controller.createStatement(
          { statement: 'Test', publicCredit: true, initialComment: 'Comment' },
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.updateStatement(
          'test-id',
          { statement: 'Test' },
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.deleteStatement('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');

      await expect(
        controller.voteInclusion(
          'test-id',
          { isPositive: true },
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');
    });
  });
});
