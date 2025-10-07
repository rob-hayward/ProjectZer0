// src/nodes/quantity/quantity.controller.spec.ts - COMPREHENSIVE TEST SUITE

import { Test, TestingModule } from '@nestjs/testing';
import { QuantityController } from './quantity.controller';
import { QuantityService } from './quantity.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuantityController - Comprehensive Tests', () => {
  let controller: QuantityController;
  let quantityService: jest.Mocked<QuantityService>;

  const mockQuantityService = {
    createQuantityNode: jest.fn(),
    getQuantityNode: jest.fn(),
    updateQuantityNode: jest.fn(),
    deleteQuantityNode: jest.fn(),
    voteInclusion: jest.fn(),
    getVoteStatus: jest.fn(),
    removeVote: jest.fn(),
    getVotes: jest.fn(),
    submitResponse: jest.fn(),
    getUserResponse: jest.fn(),
    deleteUserResponse: jest.fn(),
    getStatistics: jest.fn(),
    isQuantityNodeApproved: jest.fn(),
    isNumericResponseAllowed: jest.fn(),
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
      controllers: [QuantityController],
      providers: [
        {
          provide: QuantityService,
          useValue: mockQuantityService,
        },
      ],
    }).compile();

    controller = module.get<QuantityController>(QuantityController);
    quantityService = module.get(QuantityService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // CREATE QUANTITY NODE TESTS
  // ============================================
  describe('createQuantityNode', () => {
    const validCreateDto = {
      publicCredit: true,
      question: 'What is the average temperature in July?',
      unitCategoryId: 'temperature',
      defaultUnitId: 'celsius',
      userKeywords: ['temperature', 'july'],
      initialComment: 'Initial comment',
      categoryIds: ['cat-1'],
    };

    it('should create a quantity node with valid data', async () => {
      const mockCreatedQuantity = {
        id: 'quantity-123',
        createdBy: 'user-123',
        publicCredit: true,
        question: validCreateDto.question,
        unitCategoryId: validCreateDto.unitCategoryId,
        defaultUnitId: validCreateDto.defaultUnitId,
        responseCount: 0,
        inclusionNetVotes: 0,
      };

      quantityService.createQuantityNode.mockResolvedValue(
        mockCreatedQuantity as any,
      );

      const result = await controller.createQuantityNode(
        validCreateDto,
        mockRequest,
      );

      expect(quantityService.createQuantityNode).toHaveBeenCalledWith({
        ...validCreateDto,
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockCreatedQuantity);
    });

    it('should create quantity node without optional fields', async () => {
      const minimalDto = {
        publicCredit: true,
        question: 'What is the price?',
        unitCategoryId: 'currency',
        defaultUnitId: 'usd',
      };

      const mockCreatedQuantity = {
        id: 'quantity-124',
        createdBy: 'user-123',
        ...minimalDto,
      };

      quantityService.createQuantityNode.mockResolvedValue(
        mockCreatedQuantity as any,
      );

      const result = await controller.createQuantityNode(
        minimalDto,
        mockRequest,
      );

      expect(quantityService.createQuantityNode).toHaveBeenCalledWith({
        ...minimalDto,
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockCreatedQuantity);
    });

    it('should throw BadRequestException when question is empty', async () => {
      await expect(
        controller.createQuantityNode(
          { ...validCreateDto, question: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when unitCategoryId is empty', async () => {
      await expect(
        controller.createQuantityNode(
          { ...validCreateDto, unitCategoryId: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when defaultUnitId is empty', async () => {
      await expect(
        controller.createQuantityNode(
          { ...validCreateDto, defaultUnitId: '' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate publicCredit validation errors from service', async () => {
      quantityService.createQuantityNode.mockRejectedValue(
        new BadRequestException('publicCredit must be a boolean'),
      );

      await expect(
        controller.createQuantityNode(
          { ...validCreateDto, publicCredit: 'yes' as any },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      await expect(
        controller.createQuantityNode(
          {
            ...validCreateDto,
            categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'],
          },
          mockRequest,
        ),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.createQuantityNode(validCreateDto, mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate service errors', async () => {
      quantityService.createQuantityNode.mockRejectedValue(
        new BadRequestException('Invalid unit for category'),
      );

      await expect(
        controller.createQuantityNode(validCreateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // GET QUANTITY NODE TESTS
  // ============================================
  describe('getQuantityNode', () => {
    it('should retrieve a quantity node by ID', async () => {
      const mockQuantity = {
        id: 'test-id',
        question: 'Test question?',
        createdBy: 'user-123',
        publicCredit: true,
      };

      quantityService.getQuantityNode.mockResolvedValue(mockQuantity as any);

      const result = await controller.getQuantityNode('test-id');

      expect(quantityService.getQuantityNode).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockQuantity);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when quantity node not found', async () => {
      quantityService.getQuantityNode.mockResolvedValue(null);

      await expect(
        controller.getQuantityNode('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate service errors', async () => {
      quantityService.getQuantityNode.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getQuantityNode('test-id')).rejects.toThrow();
    });
  });

  // ============================================
  // UPDATE QUANTITY NODE TESTS
  // ============================================
  describe('updateQuantityNode', () => {
    const validUpdateDto = {
      question: 'Updated question?',
      publicCredit: false,
      userKeywords: ['updated', 'keywords'],
      categoryIds: ['cat-1', 'cat-2'],
    };

    it('should update a quantity node with valid data', async () => {
      const mockUpdatedQuantity = {
        id: 'test-id',
        ...validUpdateDto,
      };

      quantityService.updateQuantityNode.mockResolvedValue(
        mockUpdatedQuantity as any,
      );

      const result = await controller.updateQuantityNode(
        'test-id',
        validUpdateDto,
        mockRequest,
      );

      expect(quantityService.updateQuantityNode).toHaveBeenCalledWith(
        'test-id',
        validUpdateDto,
      );
      expect(result).toEqual(mockUpdatedQuantity);
    });

    it('should update only question field', async () => {
      const updateDto = { question: 'New question?' };
      const mockUpdatedQuantity = { id: 'test-id', question: 'New question?' };

      quantityService.updateQuantityNode.mockResolvedValue(
        mockUpdatedQuantity as any,
      );

      const result = await controller.updateQuantityNode(
        'test-id',
        updateDto,
        mockRequest,
      );

      expect(quantityService.updateQuantityNode).toHaveBeenCalledWith(
        'test-id',
        updateDto,
      );
      expect(result).toEqual(mockUpdatedQuantity);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.updateQuantityNode('', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no update data provided', async () => {
      await expect(
        controller.updateQuantityNode('test-id', {}, mockRequest),
      ).rejects.toThrow('No update data provided');
    });

    it('should throw BadRequestException when categoryIds exceed maximum', async () => {
      await expect(
        controller.updateQuantityNode(
          'test-id',
          { categoryIds: ['cat-1', 'cat-2', 'cat-3', 'cat-4'] },
          mockRequest,
        ),
      ).rejects.toThrow('Maximum 3 categories allowed');
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.updateQuantityNode(
          'test-id',
          validUpdateDto,
          mockRequestWithoutUser,
        ),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate NotFoundException from service', async () => {
      quantityService.updateQuantityNode.mockRejectedValue(
        new NotFoundException('Quantity node not found'),
      );

      await expect(
        controller.updateQuantityNode('test-id', validUpdateDto, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate service errors', async () => {
      quantityService.updateQuantityNode.mockRejectedValue(
        new BadRequestException('Question too long'),
      );

      await expect(
        controller.updateQuantityNode('test-id', validUpdateDto, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // DELETE QUANTITY NODE TESTS
  // ============================================
  describe('deleteQuantityNode', () => {
    it('should delete a quantity node successfully', async () => {
      quantityService.deleteQuantityNode.mockResolvedValue({ success: true });

      await controller.deleteQuantityNode('test-id', mockRequest);

      expect(quantityService.deleteQuantityNode).toHaveBeenCalledWith(
        'test-id',
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        controller.deleteQuantityNode('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not authenticated', async () => {
      await expect(
        controller.deleteQuantityNode('test-id', mockRequestWithoutUser),
      ).rejects.toThrow('User ID is required');
    });

    it('should propagate NotFoundException from service', async () => {
      quantityService.deleteQuantityNode.mockRejectedValue(
        new NotFoundException('Quantity node not found'),
      );

      await expect(
        controller.deleteQuantityNode('test-id', mockRequest),
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
      it('should vote positively on quantity node inclusion', async () => {
        quantityService.voteInclusion.mockResolvedValue(mockVoteResult);

        const result = await controller.voteInclusion(
          'test-id',
          voteDto,
          mockRequest,
        );

        expect(quantityService.voteInclusion).toHaveBeenCalledWith(
          'test-id',
          'user-123',
          true,
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on quantity node inclusion', async () => {
        const negativeVoteDto = { isPositive: false };
        quantityService.voteInclusion.mockResolvedValue(mockVoteResult);

        await controller.voteInclusion('test-id', negativeVoteDto, mockRequest);

        expect(quantityService.voteInclusion).toHaveBeenCalledWith(
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

      it('should throw BadRequestException for non-boolean isPositive', async () => {
        await expect(
          controller.voteInclusion(
            'test-id',
            { isPositive: 'yes' as any },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);
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

      it('should get vote status for authenticated user', async () => {
        quantityService.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await controller.getVoteStatus('test-id', mockRequest);

        expect(quantityService.getVoteStatus).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when user has not voted', async () => {
        quantityService.getVoteStatus.mockResolvedValue(null);

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
      it('should remove an inclusion vote', async () => {
        quantityService.removeVote.mockResolvedValue(mockVoteResult);

        const result = await controller.removeVote('test-id', mockRequest);

        expect(quantityService.removeVote).toHaveBeenCalledWith(
          'test-id',
          'user-123',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.removeVote('', mockRequest)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.removeVote('test-id', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('getVotes', () => {
      it('should get vote totals for a quantity node', async () => {
        quantityService.getVotes.mockResolvedValue(mockVoteResult);

        const result = await controller.getVotes('test-id');

        expect(quantityService.getVotes).toHaveBeenCalledWith('test-id');
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
  // NUMERIC RESPONSE TESTS
  // ============================================
  describe('Numeric Response Endpoints', () => {
    describe('submitResponse', () => {
      const responseDto = {
        value: 25.5,
        unitId: 'celsius',
      };

      const mockResponse = {
        id: 'response-123',
        userId: 'user-123',
        quantityNodeId: 'test-id',
        value: 25.5,
        unitId: 'celsius',
        categoryId: 'temperature',
        normalizedValue: 298.65,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      it('should submit a numeric response successfully', async () => {
        quantityService.submitResponse.mockResolvedValue(mockResponse);

        const result = await controller.submitResponse(
          'test-id',
          responseDto,
          mockRequest,
        );

        expect(quantityService.submitResponse).toHaveBeenCalledWith({
          userId: 'user-123',
          quantityNodeId: 'test-id',
          value: 25.5,
          unitId: 'celsius',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.submitResponse('', responseDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.submitResponse(
            'test-id',
            responseDto,
            mockRequestWithoutUser,
          ),
        ).rejects.toThrow('User ID is required');
      });

      it('should throw BadRequestException for invalid value', async () => {
        await expect(
          controller.submitResponse(
            'test-id',
            { ...responseDto, value: NaN },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for empty unitId', async () => {
        await expect(
          controller.submitResponse(
            'test-id',
            { ...responseDto, unitId: '' },
            mockRequest,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should propagate service errors', async () => {
        quantityService.submitResponse.mockRejectedValue(
          new BadRequestException('Quantity node not approved'),
        );

        await expect(
          controller.submitResponse('test-id', responseDto, mockRequest),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('getUserResponse', () => {
      const mockResponse = {
        id: 'response-123',
        userId: 'user-123',
        quantityNodeId: 'test-id',
        value: 25.5,
        unitId: 'celsius',
        categoryId: 'temperature',
        normalizedValue: 298.65,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      it('should get user response for a quantity node', async () => {
        quantityService.getUserResponse.mockResolvedValue(mockResponse);

        const result = await controller.getUserResponse('test-id', mockRequest);

        expect(quantityService.getUserResponse).toHaveBeenCalledWith(
          'user-123',
          'test-id',
        );
        expect(result).toEqual(mockResponse);
      });

      it('should return null when user has not responded', async () => {
        quantityService.getUserResponse.mockResolvedValue(null);

        const result = await controller.getUserResponse('test-id', mockRequest);

        expect(result).toBeNull();
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.getUserResponse('', mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.getUserResponse('test-id', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });

    describe('deleteUserResponse', () => {
      const mockDeleteResult = {
        success: true,
        message: 'Response successfully deleted',
      };

      it('should delete user response successfully', async () => {
        quantityService.deleteUserResponse.mockResolvedValue(mockDeleteResult);

        const result = await controller.deleteUserResponse(
          'test-id',
          mockRequest,
        );

        expect(quantityService.deleteUserResponse).toHaveBeenCalledWith(
          'user-123',
          'test-id',
        );
        expect(result).toEqual(mockDeleteResult);
      });

      it('should handle case when no response exists to delete', async () => {
        const noResponseResult = {
          success: false,
          message: 'No response found to delete',
        };
        quantityService.deleteUserResponse.mockResolvedValue(noResponseResult);

        const result = await controller.deleteUserResponse(
          'test-id',
          mockRequest,
        );

        expect(result).toEqual(noResponseResult);
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(
          controller.deleteUserResponse('', mockRequest),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when user is not authenticated', async () => {
        await expect(
          controller.deleteUserResponse('test-id', mockRequestWithoutUser),
        ).rejects.toThrow('User ID is required');
      });
    });
  });

  // ============================================
  // STATISTICS TESTS
  // ============================================
  describe('getStatistics', () => {
    const mockStatistics = {
      responseCount: 5,
      min: 15.0,
      max: 35.0,
      mean: 25.5,
      median: 26.0,
      standardDeviation: 6.8,
      percentiles: {
        25: 20.0,
        50: 26.0,
        75: 30.0,
      },
      distributionCurve: [
        [15, 1],
        [20, 2],
        [25, 1],
        [30, 3],
        [35, 1],
      ],
    };

    it('should get statistics for a quantity node', async () => {
      quantityService.getStatistics.mockResolvedValue(mockStatistics);

      const result = await controller.getStatistics('test-id');

      expect(quantityService.getStatistics).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatistics);
    });

    it('should handle quantity node with no responses', async () => {
      const emptyStats = {
        responseCount: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        standardDeviation: 0,
        percentiles: {},
        distributionCurve: [],
      };

      quantityService.getStatistics.mockResolvedValue(emptyStats);

      const result = await controller.getStatistics('test-id');

      expect(result).toEqual(emptyStats);
      expect(result.responseCount).toBe(0);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(controller.getStatistics('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate service errors', async () => {
      quantityService.getStatistics.mockRejectedValue(
        new NotFoundException('Quantity node not found'),
      );

      await expect(controller.getStatistics('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================
  // UTILITY ENDPOINTS TESTS
  // ============================================
  describe('Utility Endpoints', () => {
    describe('isQuantityNodeApproved', () => {
      it('should return true when quantity node is approved', async () => {
        quantityService.isQuantityNodeApproved.mockResolvedValue(true);

        const result = await controller.isQuantityNodeApproved('test-id');

        expect(quantityService.isQuantityNodeApproved).toHaveBeenCalledWith(
          'test-id',
        );
        expect(result).toEqual({ isApproved: true });
      });

      it('should return false when quantity node is not approved', async () => {
        quantityService.isQuantityNodeApproved.mockResolvedValue(false);

        const result = await controller.isQuantityNodeApproved('test-id');

        expect(result).toEqual({ isApproved: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.isQuantityNodeApproved('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('isNumericResponseAllowed', () => {
      it('should return true when responses are allowed', async () => {
        quantityService.isNumericResponseAllowed.mockResolvedValue(true);

        const result = await controller.isNumericResponseAllowed('test-id');

        expect(quantityService.isNumericResponseAllowed).toHaveBeenCalledWith(
          'test-id',
        );
        expect(result).toEqual({ isAllowed: true });
      });

      it('should return false when responses are not allowed', async () => {
        quantityService.isNumericResponseAllowed.mockResolvedValue(false);

        const result = await controller.isNumericResponseAllowed('test-id');

        expect(result).toEqual({ isAllowed: false });
      });

      it('should throw BadRequestException for empty ID', async () => {
        await expect(controller.isNumericResponseAllowed('')).rejects.toThrow(
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
      quantityService.getQuantityNode.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getQuantityNode('test-id')).rejects.toThrow();
    });

    it('should preserve NotFoundException from service', async () => {
      quantityService.getQuantityNode.mockRejectedValue(
        new NotFoundException('Quantity node not found'),
      );

      await expect(controller.getQuantityNode('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve BadRequestException from service', async () => {
      quantityService.updateQuantityNode.mockRejectedValue(
        new BadRequestException('Invalid data'),
      );

      await expect(
        controller.updateQuantityNode(
          'test-id',
          { question: 'test' },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate all ID parameters consistently', async () => {
      await expect(controller.getQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.updateQuantityNode('', { question: 'test' }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deleteQuantityNode('', mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.voteInclusion('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.getVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
