import { Test, TestingModule } from '@nestjs/testing';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';

describe('StatementController', () => {
  let controller: StatementController;
  let service: StatementService;

  const mockStatementService = {
    createStatement: jest.fn(),
    getStatement: jest.fn(),
    updateStatement: jest.fn(),
    deleteStatement: jest.fn(),
    setVisibilityStatus: jest.fn(),
    getVisibilityStatus: jest.fn(),
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
    service = module.get<StatementService>(StatementService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createStatement', () => {
    it('should create a statement', async () => {
      // Prepare the statement input data (without createdBy)
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

      mockStatementService.createStatement.mockResolvedValue(expectedResult);

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
  });

  describe('getStatement', () => {
    it('should get a statement by id', async () => {
      const mockStatement = { id: 'test-id', statement: 'Test statement' };
      mockStatementService.getStatement.mockResolvedValue(mockStatement);

      const result = await controller.getStatement('test-id');

      expect(service.getStatement).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockStatement);
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

      mockStatementService.updateStatement.mockResolvedValue(updatedStatement);

      const result = await controller.updateStatement('test-id', updateData);

      expect(service.updateStatement).toHaveBeenCalledWith(
        'test-id',
        updateData,
      );
      expect(result).toEqual(updatedStatement);
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status', async () => {
      const visibilityData = { isVisible: true };
      const updatedStatement = { id: 'test-id', visibilityStatus: true };

      mockStatementService.setVisibilityStatus.mockResolvedValue(
        updatedStatement,
      );

      const result = await controller.setVisibilityStatus(
        'test-id',
        visibilityData,
      );

      expect(service.setVisibilityStatus).toHaveBeenCalledWith('test-id', true);
      expect(result).toEqual(updatedStatement);
    });
  });
});
