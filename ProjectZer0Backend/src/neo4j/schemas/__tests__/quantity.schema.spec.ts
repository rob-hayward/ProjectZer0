// src/neo4j/schemas/__tests__/quantity.schema.spec.ts - CONVERTED TO BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  QuantitySchema,
  QuantityData,
  QuantityNodeResponse,
} from '../quantity.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { UnitService } from '../../../units/unit.service';
import { Record, Result, Integer } from 'neo4j-driver';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import {
  UnitCategory,
  UnitCategoryId,
} from '../../../units/interfaces/unit.interface';

describe('QuantitySchema with BaseNodeSchema Integration', () => {
  let schema: QuantitySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let unitService: jest.Mocked<UnitService>;

  // Mock data constants
  const mockQuantityData: QuantityData = {
    id: 'quantity-123',
    createdBy: 'user-456',
    publicCredit: true,
    question: 'What is the optimal temperature for brewing coffee?',
    unitCategoryId: 'temperature',
    defaultUnitId: 'celsius',
    responseCount: 0,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    // Only inclusion voting (no content voting for quantities)
    inclusionPositiveVotes: 12,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 10,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockCreateQuantityData = {
    id: 'quantity-123',
    createdBy: 'user-456',
    publicCredit: true,
    question: 'What is the optimal temperature for brewing coffee?',
    unitCategoryId: 'temperature',
    defaultUnitId: 'celsius',
    categoryIds: ['coffee-category', 'brewing-category'],
    keywords: [
      { word: 'coffee', frequency: 8, source: 'ai' as const },
      { word: 'temperature', frequency: 6, source: 'ai' as const },
      { word: 'brewing', frequency: 4, source: 'user' as const },
    ] as KeywordWithFrequency[],
    initialComment: 'This depends on the type of coffee beans used',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 12,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 10,
    contentPositiveVotes: 0, // No content voting for quantities
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 12,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 10,
    contentStatus: null, // No content voting for quantities
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockUnitCategory: UnitCategory = {
    id: UnitCategoryId.TEMPERATURE,
    name: 'Temperature',
    description: 'Temperature measurements',
    baseUnit: 'kelvin',
    defaultUnit: 'celsius',
    units: [
      { id: 'celsius', name: 'Celsius', symbol: '°C', conversionFactor: 1 },
      {
        id: 'fahrenheit',
        name: 'Fahrenheit',
        symbol: '°F',
        conversionFactor: 1.8,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantitySchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {
            vote: jest.fn(),
            getVoteStatus: jest.fn(),
            removeVote: jest.fn(),
          },
        },
        {
          provide: UnitService,
          useValue: {
            validateUnitInCategory: jest.fn(),
            convert: jest.fn(),
            getCategory: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<QuantitySchema>(QuantitySchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
    unitService = module.get(UnitService);

    // Setup default mocks
    unitService.validateUnitInCategory.mockReturnValue(true);
    unitService.convert.mockReturnValue(368.15);
    unitService.getCategory.mockReturnValue(mockUnitCategory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find a quantity node by id', async () => {
        const mockRecord = {
          get: jest.fn((key: string) => {
            if (key === 'n') return { properties: mockQuantityData };
            if (key === 'keywords') return [];
            if (key === 'categories') return [];
            if (key === 'discussionId') return null;
            return null;
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.findById('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:QuantityNode {id: $id})'),
          { id: 'quantity-123' },
        );
        expect(result).toEqual(
          expect.objectContaining({
            id: 'quantity-123',
            question: 'What is the optimal temperature for brewing coffee?',
            unitCategoryId: 'temperature',
            defaultUnitId: 'celsius',
          }),
        );
      });

      it('should return null when quantity node is not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.findById('nonexistent-123');

        expect(result).toBeNull();
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(schema.findById('quantity-123')).rejects.toThrow(
          'Failed to retrieve quantity node Quantity: Database error',
        );
      });
    });

    describe('voteInclusion (inherited)', () => {
      it('should vote positively on quantity inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'quantity-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'QuantityNode',
          { id: 'quantity-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on quantity inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion(
          'quantity-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'QuantityNode',
          { id: 'quantity-123' },
          'user-456',
          false,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should handle voting errors gracefully', async () => {
        voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

        await expect(
          schema.voteInclusion('quantity-123', 'user-456', true),
        ).rejects.toThrow('Failed to vote on Quantity: Vote failed');
      });
    });

    describe('voteContent (inherited - should be disabled)', () => {
      it('should throw error when trying to use content voting', async () => {
        // Content voting should be disabled for quantities
        await expect(
          schema.voteContent('quantity-123', 'user-456', true),
        ).rejects.toThrow('Quantity does not support content voting');
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status for a quantity node', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('quantity-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'QuantityNode',
          { id: 'quantity-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getVoteStatus('quantity-123', 'user-456');

        expect(result).toBeNull();
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'quantity-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'QuantityNode',
          { id: 'quantity-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw error when trying to remove content vote', async () => {
        // BaseNodeSchema will call VoteSchema.removeVote which will validate the vote type
        voteSchema.removeVote.mockRejectedValue(
          new Error('QuantityNode does not support content voting'),
        );

        await expect(
          schema.removeVote('quantity-123', 'user-456', 'CONTENT'),
        ).rejects.toThrow('QuantityNode does not support content voting');
      });
    });

    describe('update (inherited)', () => {
      it('should update quantity node basic properties', async () => {
        const updateData = {
          question: 'Updated question',
          publicCredit: false,
        };
        const updatedNode = { ...mockQuantityData, ...updateData };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedNode }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('quantity-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:QuantityNode {id: $id})'),
          expect.objectContaining({
            id: 'quantity-123',
            updateData,
          }),
        );
        expect(result.question).toBe('Updated question');
        expect(result.publicCredit).toBe(false);
      });
    });

    describe('delete (inherited)', () => {
      it('should delete a quantity node', async () => {
        // Mock existence check (step 1 of BaseNodeSchema delete)
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        // Mock the actual delete operation (step 2)
        neo4jService.write.mockResolvedValue({} as Result);

        const result = await schema.delete('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:QuantityNode {id: $id}) RETURN COUNT(n) as count',
          { id: 'quantity-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          'MATCH (n:QuantityNode {id: $id}) DETACH DELETE n',
          { id: 'quantity-123' },
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  describe('Quantity-Specific Methods', () => {
    describe('createQuantityNode', () => {
      it('should create a new quantity node successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.createQuantityNode(mockCreateQuantityData);

        expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
          'temperature',
          'celsius',
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (q:QuantityNode'),
          expect.objectContaining({
            id: 'quantity-123',
            createdBy: 'user-456',
            question: 'What is the optimal temperature for brewing coffee?',
            unitCategoryId: 'temperature',
            defaultUnitId: 'celsius',
          }),
        );
        expect(result).toEqual(
          expect.objectContaining({
            id: 'quantity-123',
            question: 'What is the optimal temperature for brewing coffee?',
          }),
        );
      });

      it('should throw BadRequestException for invalid unit category', async () => {
        unitService.validateUnitInCategory.mockReturnValue(false);

        await expect(
          schema.createQuantityNode(mockCreateQuantityData),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for too many categories', async () => {
        const dataWithTooManyCategories = {
          ...mockCreateQuantityData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'], // 4 categories, max is 3
        };

        await expect(
          schema.createQuantityNode(dataWithTooManyCategories),
        ).rejects.toThrow('Quantity node can have maximum 3 categories');
      });

      it('should handle creation errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Creation failed'));

        await expect(
          schema.createQuantityNode(mockCreateQuantityData),
        ).rejects.toThrow(
          'Failed to create quantity node Quantity: Creation failed',
        );
      });
    });

    describe('updateQuantityNode', () => {
      it('should update quantity node with unit validation', async () => {
        const updateData = {
          question: 'Updated question',
          unitCategoryId: 'temperature',
          defaultUnitId: 'fahrenheit',
        };

        const updatedNode = { ...mockQuantityData, ...updateData };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedNode }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateQuantityNode(
          'quantity-123',
          updateData,
        );

        expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
          'temperature',
          'fahrenheit',
        );
        expect(result.question).toBe('Updated question');
        expect(result.defaultUnitId).toBe('fahrenheit');
      });

      it('should handle complex updates with categories and keywords', async () => {
        const updateData = {
          question: 'Updated question',
          categoryIds: ['new-category'],
          keywords: [{ word: 'test', frequency: 5, source: 'user' as const }],
        };

        const updatedNode = { ...mockQuantityData, ...updateData };
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedNode }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateQuantityNode(
          'quantity-123',
          updateData,
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (q:QuantityNode {id: $id})'),
          expect.objectContaining({
            id: 'quantity-123',
            categoryIds: ['new-category'],
            keywords: updateData.keywords,
          }),
        );
        expect(result.question).toBe('Updated question');
      });

      it('should validate unit changes', async () => {
        // Mock findById to return current node
        jest.spyOn(schema, 'findById').mockResolvedValue(mockQuantityData);
        unitService.validateUnitInCategory.mockReturnValue(false);

        const updateData = { unitCategoryId: 'invalid-category' };

        await expect(
          schema.updateQuantityNode('quantity-123', updateData),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('submitResponse', () => {
      const responseData = {
        userId: 'user-456',
        quantityNodeId: 'quantity-123',
        value: 95,
        unitId: 'celsius',
      };

      const mockResponse: QuantityNodeResponse = {
        id: 'response-789',
        userId: 'user-456',
        quantityNodeId: 'quantity-123',
        value: 95,
        unitId: 'celsius',
        categoryId: 'temperature',
        createdAt: new Date(),
        updatedAt: new Date(),
        normalizedValue: 368.15,
      };

      beforeEach(() => {
        // Mock that quantity node exists and has passed inclusion threshold
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5, // Above threshold
        });
        jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null); // No existing response
        jest
          .spyOn(schema, 'recalculateStatistics' as any)
          .mockResolvedValue(undefined);
      });

      it('should submit a new response successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(mockResponse),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.submitResponse(responseData);

        expect(schema.findById).toHaveBeenCalledWith('quantity-123');
        expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
          'temperature',
          'celsius',
        );
        expect(unitService.convert).toHaveBeenCalled();
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (u)-[r:RESPONSE_TO'),
          expect.objectContaining({
            userId: 'user-456',
            quantityNodeId: 'quantity-123',
            value: 95,
            normalizedValue: 368.15,
          }),
        );
        expect(result).toEqual(mockResponse);
      });

      it('should update existing response', async () => {
        const existingResponse = { ...mockResponse, value: 90 };
        jest
          .spyOn(schema, 'getUserResponse')
          .mockResolvedValue(existingResponse);

        const mockUpdatedResponse = { ...mockResponse, value: 95 };
        const mockRecord = {
          get: jest.fn().mockReturnValue(mockUpdatedResponse),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.submitResponse(responseData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET r.value = $value'),
          expect.objectContaining({
            userId: 'user-456',
            quantityNodeId: 'quantity-123',
            value: 95,
            normalizedValue: 368.15,
          }),
        );
        expect(result).toEqual(mockUpdatedResponse);
      });

      it('should throw NotFoundException when quantity node does not exist', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        await expect(schema.submitResponse(responseData)).rejects.toThrow(
          NotFoundException,
        );
        expect(unitService.validateUnitInCategory).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when quantity node has not passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: -1, // Below threshold
        });

        await expect(schema.submitResponse(responseData)).rejects.toThrow(
          'Quantity node must pass inclusion threshold before numeric responses are allowed',
        );
        expect(unitService.validateUnitInCategory).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when unit validation fails', async () => {
        unitService.validateUnitInCategory.mockReturnValue(false);

        await expect(schema.submitResponse(responseData)).rejects.toThrow(
          `Unit ${responseData.unitId} is not valid for category temperature`,
        );
        expect(unitService.convert).not.toHaveBeenCalled();
      });

      it('should handle unit conversion errors gracefully', async () => {
        unitService.convert.mockImplementation(() => {
          throw new Error('Conversion failed');
        });

        await expect(schema.submitResponse(responseData)).rejects.toThrow(
          'Failed to submit response: Conversion failed',
        );
      });
    });

    describe('getUserResponse', () => {
      it('should get a user response when it exists', async () => {
        const mockResponse: QuantityNodeResponse = {
          id: 'response-456',
          userId: 'user-456',
          quantityNodeId: 'quantity-123',
          value: 95,
          unitId: 'celsius',
          categoryId: 'temperature',
          createdAt: new Date(),
          updatedAt: new Date(),
          normalizedValue: 368.15,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue(mockResponse),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getUserResponse('user-456', 'quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('OPTIONAL MATCH (u)-[r:RESPONSE_TO]->(q)'),
          { userId: 'user-456', quantityNodeId: 'quantity-123' },
        );
        expect(result).toEqual(mockResponse);
      });

      it('should return null when no response exists', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(null),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getUserResponse('user-456', 'quantity-123');

        expect(result).toBeNull();
      });

      it('should return null when no records exist', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getUserResponse('user-456', 'quantity-123');

        expect(result).toBeNull();
      });

      it('should handle database errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(
          schema.getUserResponse('user-456', 'quantity-123'),
        ).rejects.toThrow('Failed to get user response: Database error');
      });
    });

    describe('deleteUserResponse', () => {
      beforeEach(() => {
        jest
          .spyOn(schema, 'recalculateStatistics' as any)
          .mockResolvedValue(undefined);
      });

      it('should delete user response successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(true),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.deleteUserResponse(
          'user-456',
          'quantity-123',
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('OPTIONAL MATCH (u)-[r:RESPONSE_TO]->(q)'),
          { userId: 'user-456', quantityNodeId: 'quantity-123' },
        );
        expect(result).toBe(true);
        expect(schema['recalculateStatistics']).toHaveBeenCalledWith(
          'quantity-123',
        );
      });

      it('should return false when no response exists to delete', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(false),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.deleteUserResponse(
          'user-456',
          'quantity-123',
        );

        expect(result).toBe(false);
        expect(schema['recalculateStatistics']).not.toHaveBeenCalled();
      });

      it('should return false when no records exist', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.deleteUserResponse(
          'user-456',
          'quantity-123',
        );

        expect(result).toBe(false);
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Delete failed'));

        await expect(
          schema.deleteUserResponse('user-456', 'quantity-123'),
        ).rejects.toThrow('Failed to delete user response: Delete failed');
      });
    });

    describe('getAllResponses', () => {
      it('should get all responses for a quantity node', async () => {
        const mockResponses = [
          {
            id: 'response-1',
            value: 85,
            normalizedValue: 358.15,
            userId: 'user-1',
          },
          {
            id: 'response-2',
            value: 95,
            normalizedValue: 368.15,
            userId: 'user-2',
          },
          {
            id: 'response-3',
            value: 90,
            normalizedValue: 363.15,
            userId: 'user-3',
          },
        ];

        const mockRecords = mockResponses.map((response) => ({
          get: jest.fn().mockReturnValue(response),
        })) as unknown as Record[];
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getAllResponses('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (q:QuantityNode {id: $quantityNodeId})',
          ),
          { quantityNodeId: 'quantity-123' },
        );
        expect(result).toEqual(mockResponses);
      });

      it('should return empty array when no responses exist', async () => {
        const mockResult = {
          records: [],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getAllResponses('quantity-123');

        expect(result).toEqual([]);
      });

      it('should handle Neo4j errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Query failed'));

        await expect(schema.getAllResponses('quantity-123')).rejects.toThrow(
          'Failed to get all responses: Query failed',
        );
      });
    });

    describe('getStatistics', () => {
      const mockResponses = [
        { normalizedValue: 358.15 }, // 85°C
        { normalizedValue: 368.15 }, // 95°C
        { normalizedValue: 363.15 }, // 90°C
      ];

      beforeEach(() => {
        jest
          .spyOn(schema, 'getAllResponses')
          .mockResolvedValue(mockResponses as any);

        // Mock generateNormalDistributionCurve
        jest
          .spyOn(schema as any, 'generateNormalDistributionCurve')
          .mockReturnValue([[363.15, 0.5]]);
      });

      it('should calculate statistics from responses', async () => {
        const result = await schema.getStatistics('quantity-123');

        expect(schema.getAllResponses).toHaveBeenCalledWith('quantity-123');
        expect(result).toEqual(
          expect.objectContaining({
            responseCount: 3,
            min: 358.15,
            max: 368.15,
            mean: expect.closeTo(363.15, 2), // Allow for floating point precision
            median: 363.15,
            standardDeviation: expect.any(Number),
            percentiles: expect.any(Object),
            distributionCurve: [[363.15, 0.5]],
            responses: mockResponses,
          }),
        );

        // Verify percentiles structure
        expect(result.percentiles).toHaveProperty('50');
        expect(result.percentiles).toHaveProperty('90');
        expect(result.standardDeviation).toBeGreaterThan(0);
      });

      it('should return zero values when there are no responses', async () => {
        jest.spyOn(schema, 'getAllResponses').mockResolvedValue([]);

        const result = await schema.getStatistics('quantity-123');

        expect(result).toEqual({
          responseCount: 0,
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
          standardDeviation: 0,
          percentiles: {},
          distributionCurve: [],
          responses: [],
        });
      });

      it('should handle single response correctly', async () => {
        const singleResponse = [{ normalizedValue: 363.15 }];
        jest
          .spyOn(schema, 'getAllResponses')
          .mockResolvedValue(singleResponse as any);

        const result = await schema.getStatistics('quantity-123');

        expect(result).toEqual(
          expect.objectContaining({
            responseCount: 1,
            min: 363.15,
            max: 363.15,
            mean: 363.15,
            median: 363.15,
            standardDeviation: 0,
          }),
        );
      });

      it('should handle errors gracefully', async () => {
        jest
          .spyOn(schema, 'getAllResponses')
          .mockRejectedValue(new Error('Query failed'));

        await expect(schema.getStatistics('quantity-123')).rejects.toThrow(
          'Failed to get quantity statistics: Query failed',
        );
      });
    });

    describe('isNumericResponseAllowed', () => {
      it('should return true when quantity node has passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5, // Above threshold
        });

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(true);
      });

      it('should return false when quantity node has not passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: -1, // Below threshold
        });

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(false);
      });

      it('should return false when quantity node does not exist', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(false);
      });

      it('should return false on errors', async () => {
        jest
          .spyOn(schema, 'findById')
          .mockRejectedValue(new Error('Database error'));

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(false);
      });
    });

    describe('getRelatedContentBySharedCategories', () => {
      it('should get related content by shared categories', async () => {
        const mockRelatedNodes = [
          {
            node: { id: 'related-1', question: 'Related question 1' },
            sharedCategoryCount: 2,
          },
          {
            node: { id: 'related-2', question: 'Related question 2' },
            sharedCategoryCount: 1,
          },
        ];

        const mockRecords = mockRelatedNodes.map((item) => ({
          get: jest.fn((key: string) => {
            if (key === 'related') return { properties: item.node };
            if (key === 'sharedCategoryCount')
              return Integer.fromNumber(item.sharedCategoryCount);
            return null;
          }),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await schema.getRelatedContentBySharedCategories('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (q:QuantityNode {id: $nodeId})-[:CATEGORIZED_AS]->(cat:CategoryNode)',
          ),
          expect.objectContaining({ nodeId: 'quantity-123', limit: 10 }),
        );
        expect(result).toEqual([
          {
            node: { id: 'related-1', question: 'Related question 1' },
            sharedCategoryCount: 2,
          },
          {
            node: { id: 'related-2', question: 'Related question 2' },
            sharedCategoryCount: 1,
          },
        ]);
      });

      it('should handle custom options', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getRelatedContentBySharedCategories('quantity-123', {
          nodeTypes: ['QuantityNode', 'StatementNode'],
          limit: 5,
          includeStats: true,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            "labels(related) CONTAINS 'QuantityNode' OR labels(related) CONTAINS 'StatementNode'",
          ),
          expect.objectContaining({ nodeId: 'quantity-123', limit: 5 }),
        );
      });
    });

    describe('getQuantityNodesByUnitCategory', () => {
      it('should get quantity nodes by unit category', async () => {
        const mockNodes = [
          { id: 'quantity-1', question: 'Question 1', inclusionNetVotes: 10 },
          { id: 'quantity-2', question: 'Question 2', inclusionNetVotes: 5 },
        ];

        const mockRecords = mockNodes.map((node) => ({
          get: jest.fn((key: string) => {
            if (key === 'q') return { properties: node };
            return null;
          }),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await schema.getQuantityNodesByUnitCategory('temperature');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (q:QuantityNode {unitCategoryId: $unitCategoryId})',
          ),
          expect.objectContaining({ unitCategoryId: 'temperature', limit: 20 }),
        );
        expect(result).toEqual([
          expect.objectContaining({ id: 'quantity-1', question: 'Question 1' }),
          expect.objectContaining({ id: 'quantity-2', question: 'Question 2' }),
        ]);
      });

      it('should handle different sorting options', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getQuantityNodesByUnitCategory('temperature', {
          sortBy: 'responseCount',
          limit: 10,
          includeStats: true,
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY q.responseCount DESC'),
          expect.objectContaining({ unitCategoryId: 'temperature', limit: 10 }),
        );
      });
    });
  });

  describe('Abstract Method Implementation Tests', () => {
    describe('supportsContentVoting', () => {
      it('should return false for quantity nodes', () => {
        const supportsContent = (schema as any).supportsContentVoting();
        expect(supportsContent).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should correctly map Neo4j record to QuantityData', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              id: 'quantity-123',
              createdBy: 'user-456',
              question: 'Test question',
              unitCategoryId: 'temperature',
              defaultUnitId: 'celsius',
              responseCount: Integer.fromNumber(5),
              inclusionPositiveVotes: Integer.fromNumber(10),
              inclusionNegativeVotes: Integer.fromNumber(2),
              inclusionNetVotes: Integer.fromNumber(8),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual(
          expect.objectContaining({
            id: 'quantity-123',
            createdBy: 'user-456',
            question: 'Test question',
            unitCategoryId: 'temperature',
            defaultUnitId: 'celsius',
            responseCount: 5,
            inclusionPositiveVotes: 10,
            inclusionNegativeVotes: 2,
            inclusionNetVotes: 8,
            // Content voting should be 0
            contentPositiveVotes: 0,
            contentNegativeVotes: 0,
            contentNetVotes: 0,
          }),
        );
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = {
          question: 'Updated question',
          publicCredit: false,
        };
        const result = (schema as any).buildUpdateQuery(
          'quantity-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:QuantityNode {id: $id})');
        expect(result.cypher).toContain('n.question = $updateData.question');
        expect(result.cypher).toContain(
          'n.publicCredit = $updateData.publicCredit',
        );
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'quantity-123',
          updateData,
        });
      });

      it('should exclude id field from updates', () => {
        const updateData = { id: 'new-id', question: 'Updated question' };
        const result = (schema as any).buildUpdateQuery(
          'quantity-123',
          updateData,
        );

        expect(result.cypher).not.toContain('n.id = $updateData.id');
        expect(result.cypher).toContain('n.question = $updateData.question');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete quantity node lifecycle', async () => {
      // Create
      const mockCreatedRecord = {
        get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockCreatedRecord],
      } as unknown as Result);

      const created = await schema.createQuantityNode(mockCreateQuantityData);
      expect(created.id).toBe('quantity-123');

      // Find
      const mockFindRecord = {
        get: jest.fn((key: string) => {
          if (key === 'n') return { properties: mockQuantityData };
          if (key === 'keywords') return [];
          if (key === 'categories') return [];
          if (key === 'discussionId') return null;
          return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockFindRecord],
      } as unknown as Result);

      const found = await schema.findById('quantity-123');
      expect(found).toEqual(expect.objectContaining({ id: 'quantity-123' }));

      // Vote on inclusion
      voteSchema.vote.mockResolvedValueOnce(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'quantity-123',
        'user-789',
        true,
      );
      expect(voteResult.inclusionNetVotes).toBe(10);

      // Submit response - need to mock findById for submitResponse
      jest.spyOn(schema, 'findById').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: 5, // Above threshold
      });
      jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);
      jest
        .spyOn(schema, 'recalculateStatistics' as any)
        .mockResolvedValue(undefined);

      const mockResponseRecord = {
        get: jest.fn().mockReturnValue({
          id: 'response-123',
          userId: 'user-789',
          value: 92,
          normalizedValue: 365.15,
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockResponseRecord],
      } as unknown as Result);

      const response = await schema.submitResponse({
        userId: 'user-789',
        quantityNodeId: 'quantity-123',
        value: 92,
        unitId: 'celsius',
      });
      expect(response.value).toBe(92);

      // Delete
      // Mock existence check for delete operation
      const deleteExistsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [deleteExistsRecord],
      } as unknown as Result);

      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleted = await schema.delete('quantity-123');
      expect(deleted).toEqual({ success: true });
    });

    it('should enforce business rules across operations', async () => {
      // Test inclusion threshold enforcement
      jest.spyOn(schema, 'findById').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: -1, // Below threshold
      });

      await expect(
        schema.submitResponse({
          userId: 'user-456',
          quantityNodeId: 'quantity-123',
          value: 95,
          unitId: 'celsius',
        }),
      ).rejects.toThrow('Quantity node must pass inclusion threshold');

      // Test unit validation across operations
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(
        schema.createQuantityNode({
          ...mockCreateQuantityData,
          unitCategoryId: 'invalid',
          defaultUnitId: 'invalid',
        }),
      ).rejects.toThrow('Unit invalid is not valid for category invalid');
    });
  });
});
