import { Test, TestingModule } from '@nestjs/testing';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { BadRequestException } from '@nestjs/common';

describe('StatementController', () => {
  let controller: StatementController;
  let service: jest.Mocked<StatementService>;

  const mockStatementService = {
    createStatement: jest.fn(),
    getStatement: jest.fn(),
    updateStatement: jest.fn(),
    deleteStatement: jest.fn(),
    setVisibilityStatus: jest.fn(),
    getVisibilityStatus: jest.fn(),
    getStatementNetwork: jest.fn(),
    voteStatement: jest.fn(),
    getStatementVoteStatus: jest.fn(),
    removeStatementVote: jest.fn(),
    getStatementVotes: jest.fn(),
    createDirectRelationship: jest.fn(),
    removeDirectRelationship: jest.fn(),
    getDirectlyRelatedStatements: jest.fn(),
    createRelatedStatement: jest.fn(),
    checkStatements: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<StatementController>(StatementController);
    service = module.get(StatementService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createStatement', () => {
    it('should create a statement', async () => {
      // Prepare the statement input data
      const statementData = {
        publicCredit: true,
        statement: 'Test statement',
        userKeywords: ['test', 'keyword'],
        initialComment: 'Initial comment',
      };

      // Mock request object with authenticated user
      const mockRequest = {
        user: {
          sub: 'test-user-id',
        },
      };

      // Expected data that should be passed to service
      const expectedServiceInput = {
        ...statementData,
        createdBy: 'test-user-id',
      };

      // Mock service response
      const expectedResult = {
        id: 'test-id',
        ...expectedServiceInput,
      };

      service.createStatement.mockResolvedValue(expectedResult);

      // Call the controller with request object
      const result = await controller.createStatement(
        statementData,
        mockRequest,
      );

      // Verify service was called with the correct data
      expect(service.createStatement).toHaveBeenCalledWith(
        expectedServiceInput,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when statement is empty', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };

      await expect(
        controller.createStatement(
          {
            publicCredit: true,
            statement: '',
            initialComment: 'Initial comment',
          },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when publicCredit is not a boolean', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };

      // First create a statement data object with an invalid publicCredit value
      const invalidStatementData = {
        publicCredit: 'not-a-boolean', // This will cause an error
        statement: 'Test statement',
        initialComment: 'Initial comment',
      };

      // Now test that the controller throws an error for this invalid data
      await expect(
        controller.createStatement(invalidStatementData, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatementNetwork', () => {
    it('should get statement network with default parameters', async () => {
      const mockStatements = [{ id: 'statement1' }];
      service.getStatementNetwork.mockResolvedValue(mockStatements);

      const result = await controller.getStatementNetwork();

      expect(service.getStatementNetwork).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        sortBy: 'netPositive',
        sortDirection: 'desc',
        keywords: undefined,
        userId: undefined,
      });
      expect(result).toEqual(mockStatements);
    });

    it('should get statement network with provided parameters', async () => {
      const mockStatements = [{ id: 'statement1' }];
      service.getStatementNetwork.mockResolvedValue(mockStatements);

      const result = await controller.getStatementNetwork(
        10,
        5,
        'chronological',
        'asc',
        ['test', 'keyword'],
        'user1',
      );

      expect(service.getStatementNetwork).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        sortBy: 'chronological',
        sortDirection: 'asc',
        keywords: ['test', 'keyword'],
        userId: 'user1',
      });
      expect(result).toEqual(mockStatements);
    });
  });

  describe('getStatement', () => {
    it('should get a statement by id', async () => {
      const mockStatement = { id: 'test-id', statement: 'Test statement' };
      service.getStatement.mockResolvedValue(mockStatement);

      const result = await controller.getStatement('test-id');

      expect(service.getStatement).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatement);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.getStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateStatement', () => {
    it('should update a statement', async () => {
      const updateData = {
        statement: 'Updated statement',
        userKeywords: ['updated', 'keywords'],
      };

      const updatedStatement = {
        id: 'test-id',
        ...updateData,
      };

      service.updateStatement.mockResolvedValue(updatedStatement);

      const result = await controller.updateStatement('test-id', updateData);

      expect(service.updateStatement).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
      expect(result).toEqual(updatedStatement);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(
        controller.updateStatement('', { statement: 'Updated' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when update data is empty', async () => {
      await expect(controller.updateStatement('test-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteStatement', () => {
    it('should delete a statement', async () => {
      service.deleteStatement.mockResolvedValue({
        success: true,
        message: 'Statement deleted successfully',
      });

      await controller.deleteStatement('test-id');

      expect(service.deleteStatement).toHaveBeenCalledWith('test-id');
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.deleteStatement('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status for a statement', async () => {
      const visibilityData = { isVisible: true };
      const updatedStatement = { id: 'test-id', visibilityStatus: true };

      service.setVisibilityStatus.mockResolvedValue(updatedStatement);

      const result = await controller.setVisibilityStatus(
        'test-id',
        visibilityData,
      );

      expect(service.setVisibilityStatus).toHaveBeenCalledWith('test-id', true);
      expect(result).toEqual(updatedStatement);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(
        controller.setVisibilityStatus('', { isVisible: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when isVisible is not a boolean', async () => {
      await expect(
        controller.setVisibilityStatus('test-id', {
          // @ts-expect-error - Testing with invalid input
          isVisible: 'not-a-boolean',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('voteStatement', () => {
    it('should vote on a statement', async () => {
      const voteData = { isPositive: true };
      const mockRequest = { user: { sub: 'test-user-id' } };
      const voteResult = { positiveVotes: 5, negativeVotes: 2, netVotes: 3 };

      service.voteStatement.mockResolvedValue(voteResult);

      const result = await controller.voteStatement(
        'test-id',
        voteData,
        mockRequest,
      );

      expect(service.voteStatement).toHaveBeenCalledWith(
        'test-id',
        'test-user-id',
        true,
      );
      expect(result).toEqual(voteResult);
    });

    it('should throw BadRequestException when id is empty', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };
      await expect(
        controller.voteStatement('', { isPositive: true }, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when isPositive is not a boolean', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };
      await expect(
        controller.voteStatement(
          'test-id',
          {
            // @ts-expect-error - Testing with invalid input
            isPositive: 'not-a-boolean',
          },
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatementVoteStatus', () => {
    it('should get vote status for a statement', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };
      const voteStatus = {
        status: 'agree' as const,
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      service.getStatementVoteStatus.mockResolvedValue(voteStatus);

      const result = await controller.getStatementVoteStatus(
        'test-id',
        mockRequest,
      );

      expect(service.getStatementVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'test-user-id',
      );
      expect(result).toEqual(voteStatus);
    });

    it('should throw BadRequestException when id is empty', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };
      await expect(
        controller.getStatementVoteStatus('', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createRelatedStatement', () => {
    it('should create a related statement', async () => {
      const statementData = {
        publicCredit: true,
        statement: 'Test statement',
        userKeywords: ['test', 'keyword'],
        initialComment: 'Initial comment',
      };

      const mockRequest = { user: { sub: 'test-user-id' } };

      const newStatement = {
        id: 'new-id',
        ...statementData,
        createdBy: 'test-user-id',
      };

      service.createRelatedStatement.mockResolvedValue(newStatement);

      const result = await controller.createRelatedStatement(
        'existing-id',
        statementData,
        mockRequest,
      );

      expect(service.createRelatedStatement).toHaveBeenCalledWith(
        'existing-id',
        {
          ...statementData,
          createdBy: 'test-user-id',
        },
      );
      expect(result).toEqual(newStatement);
    });

    it('should throw BadRequestException when id is empty', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };
      const statementData = {
        publicCredit: true,
        statement: 'Test statement',
        initialComment: 'Initial comment',
      };

      await expect(
        controller.createRelatedStatement('', statementData, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when statement is empty', async () => {
      const mockRequest = { user: { sub: 'test-user-id' } };
      const statementData = {
        publicCredit: true,
        statement: '',
        initialComment: 'Initial comment',
      };

      await expect(
        controller.createRelatedStatement(
          'existing-id',
          statementData,
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createDirectRelationship', () => {
    it('should create a direct relationship between two statements', async () => {
      service.createDirectRelationship.mockResolvedValue({ success: true });

      const result = await controller.createDirectRelationship('id1', 'id2');

      expect(service.createDirectRelationship).toHaveBeenCalledWith(
        'id1',
        'id2',
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException when ids are empty', async () => {
      await expect(
        controller.createDirectRelationship('', 'id2'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createDirectRelationship('id1', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when ids are the same', async () => {
      await expect(
        controller.createDirectRelationship('id1', 'id1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeDirectRelationship', () => {
    it('should remove a direct relationship between two statements', async () => {
      service.removeDirectRelationship.mockResolvedValue({ success: true });

      const result = await controller.removeDirectRelationship('id1', 'id2');

      expect(service.removeDirectRelationship).toHaveBeenCalledWith(
        'id1',
        'id2',
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException when ids are empty', async () => {
      await expect(
        controller.removeDirectRelationship('', 'id2'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.removeDirectRelationship('id1', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDirectlyRelatedStatements', () => {
    it('should get directly related statements', async () => {
      const mockRelatedStatements = [
        { id: 'related1', statement: 'Related 1' },
        { id: 'related2', statement: 'Related 2' },
      ];

      service.getDirectlyRelatedStatements.mockResolvedValue(
        mockRelatedStatements,
      );

      const result = await controller.getDirectlyRelatedStatements('test-id');

      expect(service.getDirectlyRelatedStatements).toHaveBeenCalledWith(
        'test-id',
      );
      expect(result).toEqual(mockRelatedStatements);
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(controller.getDirectlyRelatedStatements('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkStatements', () => {
    it('should check statements', async () => {
      service.checkStatements.mockResolvedValue({ count: 42 });

      const result = await controller.checkStatements();

      expect(service.checkStatements).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });
  });
});
