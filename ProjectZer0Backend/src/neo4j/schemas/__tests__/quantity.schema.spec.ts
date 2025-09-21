// src/neo4j/schemas/__tests__/quantity.schema.spec.ts - UPDATED

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

describe('QuantitySchema with BaseNodeSchema Integration', () => {
  let schema: QuantitySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let unitService: jest.Mocked<UnitService>;

  const mockQuantityData: QuantityData = {
    id: 'quantity-123',
    createdBy: 'user-456',
    publicCredit: true,
    question: 'What is the optimal temperature for brewing coffee?',
    unitCategoryId: 'temperature',
    defaultUnitId: 'celsius',
    responseCount: 5,
    discussionId: 'discussion-abc',
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
      { word: 'coffee', frequency: 10, source: 'user' as const },
      { word: 'brewing', frequency: 8, source: 'ai' as const },
    ],
    initialComment: 'This question will help optimize coffee brewing.',
  };

  const mockQuantityResponse: QuantityNodeResponse = {
    id: 'response-123',
    userId: 'user-789',
    quantityNodeId: 'quantity-123',
    value: 92,
    unitId: 'celsius',
    categoryId: 'temperature',
    createdAt: new Date('2023-01-02T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
    normalizedValue: 365.15, // 92°C in Kelvin
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 13,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 11,
    contentPositiveVotes: 0, // Always 0 for quantities
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 13,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 11,
    contentStatus: null, // No content voting for quantities
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    neo4jService = {
      read: jest.fn(),
      write: jest.fn(),
    } as any;

    voteSchema = {
      vote: jest.fn(),
      getVoteStatus: jest.fn(),
      removeVote: jest.fn(),
    } as any;

    unitService = {
      validateUnitInCategory: jest.fn(),
      convert: jest.fn(),
      getCategory: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantitySchema,
        { provide: Neo4jService, useValue: neo4jService },
        { provide: VoteSchema, useValue: voteSchema },
        { provide: UnitService, useValue: unitService },
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

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should not support content voting (inclusion only)', () => {
        expect((schema as any).supportsContentVoting()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to QuantityData with all BaseNodeData fields', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(result.createdBy).toBe('user-456');
        expect(result.publicCredit).toBe(true);
        expect(result.discussionId).toBe('discussion-abc');
        expect(result.question).toBe(
          'What is the optimal temperature for brewing coffee?',
        );
        expect(result.unitCategoryId).toBe('temperature');
        expect(result.defaultUnitId).toBe('celsius');
        expect(result.responseCount).toBe(5);
        expect(result.contentPositiveVotes).toBe(0); // Always 0 for quantities
        expect(result.contentNegativeVotes).toBe(0);
        expect(result.contentNetVotes).toBe(0);
      });

      it('should convert Neo4j integers correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockQuantityData,
              inclusionPositiveVotes: Integer.fromNumber(12),
              inclusionNegativeVotes: Integer.fromNumber(2),
              inclusionNetVotes: Integer.fromNumber(10),
              responseCount: Integer.fromNumber(5),
            },
          }),
        } as unknown as Record;

        const result = (schema as any).mapNodeFromRecord(mockRecord);

        expect(typeof result.inclusionPositiveVotes).toBe('number');
        expect(typeof result.inclusionNegativeVotes).toBe('number');
        expect(typeof result.inclusionNetVotes).toBe('number');
        expect(typeof result.responseCount).toBe('number');
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
        expect(result.cypher).toContain('SET');
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

  describe('Inherited Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on inclusion using inherited method', async () => {
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

      it('should validate inputs', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          schema.voteInclusion('quantity-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent (should reject)', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          schema.voteContent('quantity-123', 'user-456', true),
        ).rejects.toThrow('Quantity does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('quantity-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'QuantityNode',
          { id: 'quantity-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.contentStatus).toBeNull();
      });
    });

    describe('removeVote', () => {
      it('should remove inclusion vote using inherited method', async () => {
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
    });

    describe('getVotes', () => {
      it('should get vote counts with content votes always zero', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('quantity-123');

        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: 0, // Always 0 for quantities
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('Quantity-Specific Methods', () => {
    describe('createQuantityNode', () => {
      beforeEach(() => {
        unitService.validateUnitInCategory.mockReturnValue(true);
      });

      it('should create quantity node successfully with keywords and categories', async () => {
        // Mock quantity creation first
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        // Mock discussion creation second
        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
        } as unknown as Result);

        const result = await schema.createQuantityNode(mockCreateQuantityData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (q:QuantityNode'),
          expect.objectContaining({
            id: mockCreateQuantityData.id,
            question: mockCreateQuantityData.question,
            unitCategoryId: mockCreateQuantityData.unitCategoryId,
            defaultUnitId: mockCreateQuantityData.defaultUnitId,
            createdBy: mockCreateQuantityData.createdBy,
            publicCredit: mockCreateQuantityData.publicCredit,
            categoryIds: mockCreateQuantityData.categoryIds,
            keywords: mockCreateQuantityData.keywords,
          }),
        );
        expect(result.discussionId).toBe('discussion-abc');
      });

      it('should create quantity node without keywords and categories', async () => {
        const simpleQuantityData = {
          id: 'quantity-456',
          createdBy: 'user-789',
          publicCredit: true,
          question: 'Simple question without extras',
          unitCategoryId: 'temperature',
          defaultUnitId: 'celsius',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: simpleQuantityData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValueOnce({
          records: [mockRecord],
        } as unknown as Result);

        neo4jService.write.mockResolvedValueOnce({
          records: [{ get: jest.fn().mockReturnValue('discussion-def') }],
        } as unknown as Result);

        const result = await schema.createQuantityNode(simpleQuantityData);

        expect(result.id).toBe('quantity-456');
        expect(result.discussionId).toBe('discussion-def');
      });

      it('should validate unit category and default unit', async () => {
        unitService.validateUnitInCategory.mockReturnValue(false);

        await expect(
          schema.createQuantityNode(mockCreateQuantityData),
        ).rejects.toThrow('Unit celsius is not valid for category temperature');
      });

      it('should validate category count limit', async () => {
        const tooManyCategoriesData = {
          ...mockCreateQuantityData,
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'], // More than 3 categories
        };

        await expect(
          schema.createQuantityNode(tooManyCategoriesData),
        ).rejects.toThrow('Quantity node can have maximum 3 categories');
      });

      it('should handle dependency validation errors', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('some dependencies may not exist'),
        );

        await expect(
          schema.createQuantityNode(mockCreateQuantityData),
        ).rejects.toThrow(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      });
    });

    describe('findById with enhanced data', () => {
      it('should retrieve quantity with keywords and categories', async () => {
        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'n') return { properties: mockQuantityData };
            if (field === 'keywords')
              return [
                { word: 'coffee', frequency: 10, source: 'user' },
                { word: 'brewing', frequency: 8, source: 'ai' },
              ];
            if (field === 'categories')
              return [
                { id: 'coffee-category', name: 'Coffee', inclusionNetVotes: 5 },
              ];
            if (field === 'discussionId') return 'discussion-abc';
            return null;
          }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:QuantityNode {id: $id})'),
          { id: 'quantity-123' },
        );
        expect(result?.id).toBe('quantity-123');
        expect((result as any).keywords).toBeDefined();
        expect((result as any).categories).toBeDefined();
      });
    });

    describe('updateQuantityNode', () => {
      beforeEach(() => {
        unitService.validateUnitInCategory.mockReturnValue(true);
      });

      it('should update simple fields using inherited method', async () => {
        const updateData = {
          question: 'Updated question',
          publicCredit: false,
        };
        const basicUpdatedData = {
          id: mockQuantityData.id,
          createdBy: mockQuantityData.createdBy,
          publicCredit: false, // Updated value
          question: 'Updated question', // Updated value
          unitCategoryId: mockQuantityData.unitCategoryId,
          defaultUnitId: mockQuantityData.defaultUnitId,
          responseCount: mockQuantityData.responseCount,
          discussionId: mockQuantityData.discussionId,
          createdAt: mockQuantityData.createdAt,
          updatedAt: mockQuantityData.updatedAt,
          inclusionPositiveVotes: mockQuantityData.inclusionPositiveVotes,
          inclusionNegativeVotes: mockQuantityData.inclusionNegativeVotes,
          inclusionNetVotes: mockQuantityData.inclusionNetVotes,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: basicUpdatedData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.updateQuantityNode(
          'quantity-123',
          updateData,
        );

        expect(result).toEqual(basicUpdatedData);
      });

      it('should update with keywords and categories', async () => {
        const updateData = {
          question: 'Updated with new metadata',
          categoryIds: ['new-category'],
          keywords: [
            { word: 'temperature', frequency: 5, source: 'user' as const },
          ],
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockQuantityData, ...updateData },
          }),
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
            categoryIds: updateData.categoryIds,
            keywords: updateData.keywords,
          }),
        );
        expect(result).toBeDefined();
      });

      it('should validate unit changes', async () => {
        const updateData = {
          unitCategoryId: 'temperature',
          defaultUnitId: 'fahrenheit',
        };

        unitService.validateUnitInCategory.mockReturnValue(false);

        await expect(
          schema.updateQuantityNode('quantity-123', updateData),
        ).rejects.toThrow(
          'Unit fahrenheit is not valid for category temperature',
        );
      });

      it('should handle quantity node not found on update', async () => {
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(
          schema.updateQuantityNode('nonexistent', {
            question: 'New question',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Numeric Response System', () => {
    describe('submitResponse', () => {
      beforeEach(() => {
        unitService.validateUnitInCategory.mockReturnValue(true);
        unitService.convert.mockReturnValue(365.15); // 92°C to Kelvin
        unitService.getCategory.mockReturnValue({
          id: 'temperature',
          name: 'Temperature',
          description: 'Temperature measurements',
          baseUnit: 'kelvin',
          defaultUnit: 'celsius',
          units: [],
        });
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5, // Above threshold
        });
        jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);
        jest
          .spyOn(schema as any, 'recalculateStatistics')
          .mockResolvedValue(undefined);
      });

      it('should submit new response successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(mockQuantityResponse),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.submitResponse({
          userId: 'user-789',
          quantityNodeId: 'quantity-123',
          value: 92,
          unitId: 'celsius',
        });

        expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
          'temperature',
          'celsius',
        );
        expect(unitService.convert).toHaveBeenCalled();
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (u)-[r:RESPONSE_TO'),
          expect.objectContaining({
            value: 92,
            unitId: 'celsius',
            normalizedValue: 365.15,
          }),
        );
        expect(result).toEqual(mockQuantityResponse);
      });

      it('should update existing response', async () => {
        jest
          .spyOn(schema, 'getUserResponse')
          .mockResolvedValue(mockQuantityResponse);

        const mockRecord = {
          get: jest
            .fn()
            .mockReturnValue({ ...mockQuantityResponse, value: 95 }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.submitResponse({
          userId: 'user-789',
          quantityNodeId: 'quantity-123',
          value: 95,
          unitId: 'celsius',
        });

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('SET r.value = $value'),
          expect.objectContaining({ value: 95 }),
        );
        expect(result.value).toBe(95);
      });

      it('should reject response when quantity has not passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: -2, // Below threshold
        });

        await expect(
          schema.submitResponse({
            userId: 'user-789',
            quantityNodeId: 'quantity-123',
            value: 92,
            unitId: 'celsius',
          }),
        ).rejects.toThrow(
          'Quantity node must pass inclusion threshold before numeric responses are allowed',
        );
      });

      it('should reject response with invalid unit', async () => {
        unitService.validateUnitInCategory.mockReturnValue(false);

        await expect(
          schema.submitResponse({
            userId: 'user-789',
            quantityNodeId: 'quantity-123',
            value: 92,
            unitId: 'invalid-unit',
          }),
        ).rejects.toThrow(
          'Unit invalid-unit is not valid for category temperature',
        );
      });

      it('should handle quantity node not found', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        await expect(
          schema.submitResponse({
            userId: 'user-789',
            quantityNodeId: 'nonexistent',
            value: 92,
            unitId: 'celsius',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('getUserResponse', () => {
      it('should get user response', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(mockQuantityResponse),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getUserResponse('user-789', 'quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('OPTIONAL MATCH (u)-[r:RESPONSE_TO]->(q)'),
          { userId: 'user-789', quantityNodeId: 'quantity-123' },
        );
        expect(result).toEqual(mockQuantityResponse);
      });

      it('should return null when no response found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getUserResponse('user-789', 'quantity-123');

        expect(result).toBeNull();
      });
    });

    describe('deleteUserResponse', () => {
      beforeEach(() => {
        jest
          .spyOn(schema as any, 'recalculateStatistics')
          .mockResolvedValue(undefined);
      });

      it('should delete user response successfully', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(true),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.deleteUserResponse(
          'user-789',
          'quantity-123',
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DELETE r'),
          { userId: 'user-789', quantityNodeId: 'quantity-123' },
        );
        expect(result).toBe(true);
      });

      it('should return false when no response to delete', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(false),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.deleteUserResponse(
          'user-789',
          'quantity-123',
        );

        expect(result).toBe(false);
      });
    });

    describe('getAllResponses', () => {
      it('should get all responses for quantity node', async () => {
        const mockResponses = [mockQuantityResponse];
        const mockRecords = mockResponses.map((response) => ({
          get: jest.fn().mockReturnValue(response),
        })) as unknown as Record[];
        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

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
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getAllResponses('quantity-123');

        expect(result).toEqual([]);
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
            mean: expect.closeTo(363.15, 2),
            median: 363.15,
            standardDeviation: expect.any(Number),
            percentiles: expect.any(Object),
            distributionCurve: [[363.15, 0.5]],
            responses: mockResponses,
          }),
        );

        expect(result.percentiles).toHaveProperty('50');
        expect(result.percentiles).toHaveProperty('90');
        expect(result.standardDeviation).toBeGreaterThan(0);
      });

      it('should return zero values when no responses exist', async () => {
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
    });

    describe('isNumericResponseAllowed', () => {
      it('should return true when quantity has passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5,
        });

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(true);
      });

      it('should return false when quantity has not passed inclusion threshold', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: -2,
        });

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(false);
      });

      it('should return false when quantity not found', async () => {
        jest.spyOn(schema, 'findById').mockResolvedValue(null);

        const result = await schema.isNumericResponseAllowed('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Discovery Methods', () => {
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

  describe('Integration Tests', () => {
    it('should handle complete quantity node lifecycle', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);
      unitService.convert.mockReturnValue(365.15);
      unitService.getCategory.mockReturnValue({
        id: 'temperature',
        name: 'Temperature',
        description: 'Temperature measurements',
        baseUnit: 'kelvin',
        defaultUnit: 'celsius',
        units: [],
      });

      // Create
      const mockCreatedRecord = {
        get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockCreatedRecord],
      } as unknown as Result);

      // Mock discussion creation
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('discussion-abc') }],
      } as unknown as Result);

      const created = await schema.createQuantityNode(mockCreateQuantityData);
      expect(created.id).toBe('quantity-123');

      // Read
      const mockReadRecord = {
        get: jest.fn((key: string) => {
          if (key === 'n') return { properties: mockQuantityData };
          if (key === 'keywords') return [];
          if (key === 'categories') return [];
          if (key === 'discussionId') return 'discussion-abc';
          return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [mockReadRecord],
      } as unknown as Result);

      const found = await schema.findById('quantity-123');
      expect(found).toEqual(expect.objectContaining({ id: 'quantity-123' }));

      // Vote inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'quantity-123',
        'user-789',
        true,
      );
      expect(voteResult.inclusionNetVotes).toBe(11);

      // Submit response - need to mock findById for submitResponse
      jest.spyOn(schema, 'findById').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: 5, // Above threshold
      });
      jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);
      jest
        .spyOn(schema as any, 'recalculateStatistics')
        .mockResolvedValue(undefined);

      const mockResponseRecord = {
        get: jest.fn().mockReturnValue(mockQuantityResponse),
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

      // Update
      const updateData = { question: 'Updated question' };
      const basicUpdatedData = {
        id: mockQuantityData.id,
        createdBy: mockQuantityData.createdBy,
        publicCredit: mockQuantityData.publicCredit,
        question: 'Updated question', // Updated value
        unitCategoryId: mockQuantityData.unitCategoryId,
        defaultUnitId: mockQuantityData.defaultUnitId,
        responseCount: mockQuantityData.responseCount,
        discussionId: mockQuantityData.discussionId,
        createdAt: mockQuantityData.createdAt,
        updatedAt: mockQuantityData.updatedAt,
        inclusionPositiveVotes: mockQuantityData.inclusionPositiveVotes,
        inclusionNegativeVotes: mockQuantityData.inclusionNegativeVotes,
        inclusionNetVotes: mockQuantityData.inclusionNetVotes,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      const mockUpdateRecord = {
        get: jest.fn().mockReturnValue({ properties: basicUpdatedData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [mockUpdateRecord],
      } as unknown as Result);

      const updated = await schema.update('quantity-123', updateData);
      expect(updated).toEqual(basicUpdatedData);

      // Delete
      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({} as Result);

      const deleteResult = await schema.delete('quantity-123');
      expect(deleteResult).toEqual({ success: true });
    });

    it('should enforce business rules across operations', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

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

  describe('Error Handling', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to retrieve quantity node Quantity: Database connection failed',
      );
    });

    it('should handle quantity-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getAllResponses('test')).rejects.toThrow(
        'Failed to get all responses: Query timeout',
      );
    });
  });

  describe('Business Logic Validation', () => {
    it('should enforce inclusion threshold for numeric responses', async () => {
      jest.spyOn(schema, 'findById').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: -2,
      });

      await expect(
        schema.submitResponse({
          userId: 'user-456',
          quantityNodeId: 'quantity-123',
          value: 95,
          unitId: 'celsius',
        }),
      ).rejects.toThrow('Quantity node must pass inclusion threshold');
    });

    it('should validate unit compatibility across all operations', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      // Test creation
      await expect(
        schema.createQuantityNode(mockCreateQuantityData),
      ).rejects.toThrow('Unit celsius is not valid for category temperature');

      // Test response submission
      unitService.validateUnitInCategory.mockReturnValue(true);
      jest.spyOn(schema, 'findById').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: 5,
      });
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(
        schema.submitResponse({
          userId: 'user-456',
          quantityNodeId: 'quantity-123',
          value: 95,
          unitId: 'invalid-unit',
        }),
      ).rejects.toThrow(
        'Unit invalid-unit is not valid for category temperature',
      );
    });

    it('should maintain response count consistency', async () => {
      // This is tested implicitly through submitResponse and deleteUserResponse
      // The recalculateStatistics method ensures consistency
      jest
        .spyOn(schema as any, 'recalculateStatistics')
        .mockResolvedValue(undefined);

      // Mock successful deletion
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.deleteUserResponse('user-456', 'quantity-123');

      expect((schema as any).recalculateStatistics).toHaveBeenCalledWith(
        'quantity-123',
      );
    });
  });
});
