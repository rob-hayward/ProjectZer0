// src/neo4j/schemas/__tests__/quantity.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { QuantitySchema } from '../quantity.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { UnitService } from '../../../units/unit.service';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KeywordWithFrequency } from '../../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from '../vote.schema';
import {
  UnitCategory,
  UnitCategoryId,
} from '../../../units/interfaces/unit.interface';

describe('QuantitySchema', () => {
  let schema: QuantitySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let unitService: jest.Mocked<UnitService>;

  // Mock data constants
  const mockQuantityData = {
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
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 12,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 10,
    contentStatus: 'agree',
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  describe('createQuantityNode', () => {
    const mockRecord = {
      get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
    } as unknown as Record;
    const mockResult = {
      records: [mockRecord],
    } as unknown as Result;

    beforeEach(() => {
      unitService.validateUnitInCategory.mockReturnValue(true);
      neo4jService.write.mockResolvedValue(mockResult);
    });

    it('should create a quantity node successfully', async () => {
      const result = await schema.createQuantityNode(mockQuantityData);

      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'temperature',
        'celsius',
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (q:QuantityNode'),
        expect.objectContaining({
          id: mockQuantityData.id,
          question: mockQuantityData.question,
          unitCategoryId: mockQuantityData.unitCategoryId,
          defaultUnitId: mockQuantityData.defaultUnitId,
          categoryIds: mockQuantityData.categoryIds,
          keywords: mockQuantityData.keywords,
        }),
      );
      expect(result).toEqual(mockQuantityData);
    });

    it('should create a quantity node without categories', async () => {
      const quantityDataNoCategories = {
        ...mockQuantityData,
        categoryIds: undefined,
      };

      const result = await schema.createQuantityNode(quantityDataNoCategories);

      expect(neo4jService.write).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create a quantity node without keywords', async () => {
      const quantityDataNoKeywords = {
        ...mockQuantityData,
        keywords: undefined,
      };

      await schema.createQuantityNode(quantityDataNoKeywords);

      expect(neo4jService.write).toHaveBeenCalled();
    });

    it('should throw BadRequestException when unit validation fails', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(schema.createQuantityNode(mockQuantityData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when more than 3 categories provided', async () => {
      const invalidData = {
        ...mockQuantityData,
        categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
      };

      await expect(schema.createQuantityNode(invalidData)).rejects.toThrow(
        BadRequestException,
      );
      expect(unitService.validateUnitInCategory).not.toHaveBeenCalled();
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle keyword/category validation errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Category not found'));

      await expect(schema.createQuantityNode(mockQuantityData)).rejects.toThrow(
        'Failed to create quantity node: Category not found',
      );
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.createQuantityNode(mockQuantityData)).rejects.toThrow(
        'Failed to create quantity node: Database connection failed',
      );
    });
  });

  describe('getQuantityNode', () => {
    const mockQuantityRecord = {
      get: jest.fn().mockImplementation((key: string) => {
        const mockData = {
          q: {
            properties: {
              ...mockQuantityData,
              inclusionPositiveVotes: Integer.fromNumber(12),
              inclusionNegativeVotes: Integer.fromNumber(2),
              inclusionNetVotes: Integer.fromNumber(10),
              contentPositiveVotes: Integer.fromNumber(8),
              contentNegativeVotes: Integer.fromNumber(1),
              contentNetVotes: Integer.fromNumber(7),
              responseCount: Integer.fromNumber(25),
            },
          },
          keywords: [
            { word: 'coffee', frequency: 8, source: 'ai' },
            { word: 'temperature', frequency: 6, source: 'ai' },
          ],
          discussionId: 'discussion-123',
        };
        return mockData[key];
      }),
    } as unknown as Record;

    const mockResult = {
      records: [mockQuantityRecord],
    } as unknown as Result;

    it('should get a quantity node successfully', async () => {
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getQuantityNode('quantity-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (q:QuantityNode {id: $id})'),
        { id: 'quantity-123' },
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: mockQuantityData.id,
          question: mockQuantityData.question,
          inclusionPositiveVotes: 12,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 10,
          contentPositiveVotes: 8,
          contentNegativeVotes: 1,
          contentNetVotes: 7,
          responseCount: 25,
          keywords: expect.arrayContaining([
            expect.objectContaining({ word: 'coffee' }),
            expect.objectContaining({ word: 'temperature' }),
          ]),
          discussionId: 'discussion-123',
        }),
      );
    });

    it('should return null when quantity node does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getQuantityNode('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      await expect(schema.getQuantityNode('quantity-123')).rejects.toThrow(
        'Failed to get quantity node: Database error',
      );
    });
  });

  describe('updateQuantityNode', () => {
    const updateData = {
      question: 'What is the ideal brewing temperature for espresso?',
      unitCategoryId: 'temperature',
      defaultUnitId: 'fahrenheit',
      publicCredit: false,
    };

    it('should update a quantity node successfully', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuantityData, ...updateData },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateQuantityNode(
        'quantity-123',
        updateData,
      );

      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'temperature',
        'fahrenheit',
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (q:QuantityNode {id: $id})'),
        expect.objectContaining({
          id: 'quantity-123',
          updateProperties: expect.objectContaining({
            question: updateData.question,
            unitCategoryId: updateData.unitCategoryId,
            defaultUnitId: updateData.defaultUnitId,
            publicCredit: updateData.publicCredit,
          }),
        }),
      );
      expect(result).toEqual({ ...mockQuantityData, ...updateData });
    });

    it('should throw BadRequestException when unit validation fails', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(
        schema.updateQuantityNode('quantity-123', updateData),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when quantity node does not exist', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.updateQuantityNode('nonexistent-id', updateData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle Neo4j errors gracefully', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);
      neo4jService.write.mockRejectedValue(new Error('Update failed'));

      await expect(
        schema.updateQuantityNode('quantity-123', updateData),
      ).rejects.toThrow('Failed to update quantity node: Update failed');
    });
  });

  describe('deleteQuantityNode', () => {
    it('should delete a quantity node successfully', async () => {
      // Mock existence check
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockQuantityData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockResolvedValue({} as Result);

      const result = await schema.deleteQuantityNode('quantity-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (q:QuantityNode {id: $id}) RETURN q'),
        { id: 'quantity-123' },
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('DETACH DELETE q, d, c, r'),
        { id: 'quantity-123' },
      );
      expect(result).toEqual({
        success: true,
        message: 'Quantity node with ID quantity-123 successfully deleted',
      });
    });

    it('should throw NotFoundException when quantity node does not exist', async () => {
      const checkResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);

      await expect(schema.deleteQuantityNode('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.deleteQuantityNode('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors gracefully', async () => {
      const checkResult = {
        records: [{ get: jest.fn().mockReturnValue(mockQuantityData) }],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(checkResult);
      neo4jService.write.mockRejectedValue(new Error('Delete failed'));

      await expect(schema.deleteQuantityNode('quantity-123')).rejects.toThrow(
        'Failed to delete quantity node: Delete failed',
      );
    });
  });

  describe('submitResponse', () => {
    const responseData = {
      userId: 'user-456',
      quantityNodeId: 'quantity-123',
      value: 95,
      unitId: 'celsius',
    };

    const mockQuantityNode = {
      id: 'quantity-123',
      unitCategoryId: 'temperature',
      defaultUnitId: 'celsius',
      inclusionNetVotes: 5, // > 0, allows responses
    };

    beforeEach(() => {
      // Mock successful setup
      jest.spyOn(schema, 'getQuantityNode').mockResolvedValue(mockQuantityNode);
      unitService.validateUnitInCategory.mockReturnValue(true);
      unitService.convert.mockReturnValue(368.15); // Celsius to Kelvin conversion
      unitService.getCategory.mockReturnValue(mockUnitCategory);

      // Mock recalculateStatistics
      jest
        .spyOn(schema as any, 'recalculateStatistics')
        .mockImplementation(() => Promise.resolve());
    });

    it('should create a new response for a user', async () => {
      // Mock no existing response
      jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);

      const mockNewResponse = {
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
        get: jest.fn().mockReturnValue(mockNewResponse),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.submitResponse(responseData);

      expect(schema.getQuantityNode).toHaveBeenCalledWith('quantity-123');
      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'temperature',
        'celsius',
      );
      expect(unitService.convert).toHaveBeenCalledWith(
        95,
        'celsius',
        'kelvin',
        'temperature',
      );
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (r:QuantityResponseNode'),
        expect.objectContaining({
          userId: 'user-456',
          quantityNodeId: 'quantity-123',
          value: 95,
          unitId: 'celsius',
          normalizedValue: 368.15,
        }),
      );
      expect(result).toEqual(mockNewResponse);
    });

    it('should update existing response for a user', async () => {
      // Mock existing response with complete QuantityNodeResponse interface
      const existingResponse = {
        id: 'existing-response',
        userId: 'user-456',
        quantityNodeId: 'quantity-123',
        value: 85,
        unitId: 'celsius',
        categoryId: 'temperature',
        createdAt: new Date(),
        updatedAt: new Date(),
        normalizedValue: 358.15,
      };
      jest.spyOn(schema, 'getUserResponse').mockResolvedValue(existingResponse);

      const mockUpdatedResponse = {
        ...existingResponse,
        value: 95,
        normalizedValue: 368.15,
        updatedAt: new Date(),
      };

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
      jest.spyOn(schema, 'getQuantityNode').mockResolvedValue(null);

      await expect(schema.submitResponse(responseData)).rejects.toThrow(
        NotFoundException,
      );
      expect(unitService.validateUnitInCategory).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when quantity node has not passed inclusion threshold', async () => {
      const rejectedQuantityNode = {
        ...mockQuantityNode,
        inclusionNetVotes: -1, // <= 0, rejected
      };
      jest
        .spyOn(schema, 'getQuantityNode')
        .mockResolvedValue(rejectedQuantityNode);

      await expect(schema.submitResponse(responseData)).rejects.toThrow(
        BadRequestException,
      );
      expect(unitService.validateUnitInCategory).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when unit validation fails', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(schema.submitResponse(responseData)).rejects.toThrow(
        BadRequestException,
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
      const mockResponse = {
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
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
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

    it('should handle Neo4j errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      await expect(
        schema.getUserResponse('user-456', 'quantity-123'),
      ).rejects.toThrow('Failed to get user response: Database error');
    });
  });

  describe('deleteUserResponse', () => {
    beforeEach(() => {
      // Mock recalculateStatistics
      jest
        .spyOn(schema as any, 'recalculateStatistics')
        .mockImplementation(() => Promise.resolve());
    });

    it('should delete a user response and recalculate statistics', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true), // Response was deleted
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
        expect.stringContaining('DELETE r'),
        { userId: 'user-456', quantityNodeId: 'quantity-123' },
      );
      expect(result).toBe(true);
      expect((schema as any).recalculateStatistics).toHaveBeenCalledWith(
        'quantity-123',
      );
    });

    it('should return false when no response exists to delete', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(false), // No response was deleted
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
        { id: 'response-1', value: 85, normalizedValue: 358.15 },
        { id: 'response-2', value: 95, normalizedValue: 368.15 },
        { id: 'response-3', value: 90, normalizedValue: 363.15 },
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
        expect.stringContaining('MATCH (q:QuantityNode {id: $quantityNodeId})'),
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
          mean: 363.15,
          median: 363.15,
          standardDeviation: expect.any(Number),
          percentiles: expect.any(Object),
          distributionCurve: [[363.15, 0.5]],
          responses: mockResponses,
        }),
      );
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

  describe('voteQuantityInclusion', () => {
    it('should vote positively on quantity inclusion', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteQuantityInclusion(
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

      const result = await schema.voteQuantityInclusion(
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
        schema.voteQuantityInclusion('quantity-123', 'user-456', true),
      ).rejects.toThrow('Failed to vote on quantity node: Vote failed');
    });
  });

  describe('voteQuantityContent', () => {
    it('should vote positively on quantity content', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteQuantityContent(
        'quantity-123',
        'user-456',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'QuantityNode',
        { id: 'quantity-123' },
        'user-456',
        true,
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should vote negatively on quantity content', async () => {
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await schema.voteQuantityContent(
        'quantity-123',
        'user-456',
        false,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'QuantityNode',
        { id: 'quantity-123' },
        'user-456',
        false,
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle voting errors gracefully', async () => {
      voteSchema.vote.mockRejectedValue(new Error('Content vote failed'));

      await expect(
        schema.voteQuantityContent('quantity-123', 'user-456', true),
      ).rejects.toThrow(
        'Failed to vote on quantity node content: Content vote failed',
      );
    });
  });

  describe('getQuantityVoteStatus', () => {
    it('should get vote status for a quantity node', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getQuantityVoteStatus(
        'quantity-123',
        'user-456',
      );

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'QuantityNode',
        { id: 'quantity-123' },
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should return null when no vote status exists', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await schema.getQuantityVoteStatus(
        'quantity-123',
        'user-456',
      );

      expect(result).toBeNull();
    });

    it('should handle vote status errors gracefully', async () => {
      voteSchema.getVoteStatus.mockRejectedValue(
        new Error('Vote status failed'),
      );

      await expect(
        schema.getQuantityVoteStatus('quantity-123', 'user-456'),
      ).rejects.toThrow(
        'Failed to get quantity node vote status: Vote status failed',
      );
    });
  });

  describe('removeQuantityVote', () => {
    it('should remove inclusion vote', async () => {
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await schema.removeQuantityVote(
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

    it('should remove content vote', async () => {
      voteSchema.removeVote.mockResolvedValue(mockVoteResult);

      const result = await schema.removeQuantityVote(
        'quantity-123',
        'user-456',
        'CONTENT',
      );

      expect(voteSchema.removeVote).toHaveBeenCalledWith(
        'QuantityNode',
        { id: 'quantity-123' },
        'user-456',
        'CONTENT',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should handle remove vote errors gracefully', async () => {
      voteSchema.removeVote.mockRejectedValue(new Error('Remove vote failed'));

      await expect(
        schema.removeQuantityVote('quantity-123', 'user-456', 'INCLUSION'),
      ).rejects.toThrow(
        'Failed to remove quantity node vote: Remove vote failed',
      );
    });
  });

  describe('getQuantityVotes', () => {
    it('should get votes for a quantity node', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await schema.getQuantityVotes('quantity-123');

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'QuantityNode',
        { id: 'quantity-123' },
        '',
      );
      expect(result).toEqual({
        inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
        inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
        contentPositiveVotes: mockVoteStatus.contentPositiveVotes,
        contentNegativeVotes: mockVoteStatus.contentNegativeVotes,
        contentNetVotes: mockVoteStatus.contentNetVotes,
      });
    });

    it('should return null when no vote status exists', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await schema.getQuantityVotes('quantity-123');

      expect(result).toBeNull();
    });

    it('should handle get votes errors gracefully', async () => {
      voteSchema.getVoteStatus.mockRejectedValue(new Error('Get votes failed'));

      await expect(schema.getQuantityVotes('quantity-123')).rejects.toThrow(
        'Failed to get quantity node votes: Get votes failed',
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should set visibility status to true', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuantityData, visibilityStatus: true },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('quantity-123', true);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET q.visibilityStatus = $isVisible'),
        { quantityNodeId: 'quantity-123', isVisible: true },
      );
      expect(result).toEqual({ ...mockQuantityData, visibilityStatus: true });
    });

    it('should set visibility status to false', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockQuantityData, visibilityStatus: false },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.setVisibilityStatus('quantity-123', false);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET q.visibilityStatus = $isVisible'),
        { quantityNodeId: 'quantity-123', isVisible: false },
      );
      expect(result).toEqual({ ...mockQuantityData, visibilityStatus: false });
    });

    it('should throw NotFoundException when quantity node does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.setVisibilityStatus('nonexistent-id', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.setVisibilityStatus('', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle visibility errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(
        new Error('Visibility update failed'),
      );

      await expect(
        schema.setVisibilityStatus('quantity-123', true),
      ).rejects.toThrow(
        'Failed to set visibility status: Visibility update failed',
      );
    });
  });

  describe('getVisibilityStatus', () => {
    it('should get visibility status for a quantity node', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityStatus('quantity-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (q:QuantityNode {id: $quantityNodeId})'),
        { quantityNodeId: 'quantity-123' },
      );
      expect(result).toBe(true);
    });

    it('should default to true when visibility status is null', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityStatus('quantity-123');

      expect(result).toBe(true); // Should default to true
    });

    it('should throw NotFoundException when quantity node does not exist', async () => {
      const mockResult = {
        records: [],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await expect(
        schema.getVisibilityStatus('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ID is empty', async () => {
      await expect(schema.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.read).not.toHaveBeenCalled();
    });

    it('should handle get visibility errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Get visibility failed'));

      await expect(schema.getVisibilityStatus('quantity-123')).rejects.toThrow(
        'Failed to get visibility status: Get visibility failed',
      );
    });
  });
});
