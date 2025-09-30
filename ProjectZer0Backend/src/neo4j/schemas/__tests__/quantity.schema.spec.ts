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
import { DiscussionSchema } from '../discussion.schema';
import { UserSchema } from '../user.schema';
import { UnitService } from '../../../units/unit.service';
import { Record, Result, Integer } from 'neo4j-driver';

describe('QuantitySchema', () => {
  let schema: QuantitySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;
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
    inclusionPositiveVotes: 12,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 10,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
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
    normalizedValue: 365.15,
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 13,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 11,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 13,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 11,
    contentStatus: null,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
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
          provide: DiscussionSchema,
          useValue: {
            createDiscussionForNode: jest.fn(),
          },
        },
        {
          provide: UserSchema,
          useValue: {
            addCreatedNode: jest.fn(),
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
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
    unitService = module.get(UnitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherited Methods', () => {
    describe('findById', () => {
      it('should find a quantity by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:QuantityNode {id: $id})'),
          { id: 'quantity-123' },
        );
        expect(result).toEqual(mockQuantityData);
      });

      it('should return null when quantity not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.findById('')).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      it('should update quantity using inherited method', async () => {
        const updateData = { question: 'Updated question' };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockQuantityData, ...updateData },
          }),
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
        expect(result?.question).toBe('Updated question');
      });

      it('should validate input', async () => {
        await expect(schema.update('', {})).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should detach and delete a quantity', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.delete('quantity-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:QuantityNode {id: $id})'),
          { id: 'quantity-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE n'),
          { id: 'quantity-123' },
        );
        expect(result).toEqual({ success: true });
      });

      it('should throw NotFoundException when quantity not found', async () => {
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        await expect(schema.delete('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });
  });

  describe('Voting Methods', () => {
    describe('voteInclusion', () => {
      it('should vote on quantity inclusion', async () => {
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
    });

    describe('voteContent', () => {
      it('should reject content voting for quantities', async () => {
        await expect(
          schema.voteContent('quantity-123', 'user-456', true),
        ).rejects.toThrow('Quantity does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus', () => {
      it('should get vote status with null content status', async () => {
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

    describe('getVotes', () => {
      it('should get vote counts with content votes always zero', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('quantity-123');

        expect(result).toEqual({
          inclusionPositiveVotes: 13,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 11,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('createQuantityNode', () => {
    beforeEach(() => {
      unitService.validateUnitInCategory.mockReturnValue(true);
      unitService.getCategory.mockReturnValue({
        id: 'temperature',
        name: 'Temperature',
        description: 'Temperature measurements',
        baseUnit: 'kelvin',
        defaultUnit: 'celsius',
        units: [],
      });
    });

    it('should create quantity with keywords and categories', async () => {
      const createData = {
        createdBy: 'user-456',
        publicCredit: true,
        question: 'What is the optimal temperature?',
        unitCategoryId: 'temperature',
        defaultUnitId: 'celsius',
        keywords: [
          { word: 'temperature', frequency: 1, source: 'user' as const },
        ],
        categoryIds: ['cat1'],
        initialComment: 'Initial comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const result = await schema.createQuantityNode(createData);

      expect(unitService.validateUnitInCategory).toHaveBeenCalledWith(
        'temperature',
        'celsius',
      );
      expect(neo4jService.write).toHaveBeenCalled();
      expect(discussionSchema.createDiscussionForNode).toHaveBeenCalled();
      expect(userSchema.addCreatedNode).toHaveBeenCalled();
      expect(result.id).toBe('quantity-123');
    });

    it('should reject empty question text', async () => {
      await expect(
        schema.createQuantityNode({
          createdBy: 'user-456',
          publicCredit: true,
          question: '',
          unitCategoryId: 'temperature',
          defaultUnitId: 'celsius',
        }),
      ).rejects.toThrow('Question text cannot be empty');
    });

    it('should reject invalid unit for category', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(
        schema.createQuantityNode({
          createdBy: 'user-456',
          publicCredit: true,
          question: 'Test question',
          unitCategoryId: 'temperature',
          defaultUnitId: 'invalid-unit',
        }),
      ).rejects.toThrow(
        'Unit invalid-unit is not valid for category temperature',
      );
    });

    it('should reject too many categories', async () => {
      await expect(
        schema.createQuantityNode({
          createdBy: 'user-456',
          publicCredit: true,
          question: 'Test question',
          unitCategoryId: 'temperature',
          defaultUnitId: 'celsius',
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Quantity node can have maximum 3 categories');
    });
  });

  describe('getQuantity', () => {
    it('should retrieve quantity with relationships', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'q' || key === 'n') {
            return { properties: mockQuantityData };
          }
          if (key === 'keywords')
            return [{ word: 'temp', frequency: 1, source: 'user' }];
          if (key === 'categories') return [{ id: 'cat1', name: 'Category 1' }];
          if (key === 'discussionId') return 'discussion-abc';
          if (key === 'actualResponseCount') return Integer.fromNumber(5);
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getQuantity('quantity-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('quantity-123');
      expect(result?.discussionId).toBe('discussion-abc');
      expect(result?.responseCount).toBe(5);
    });

    it('should return null when quantity not found', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await schema.getQuantity('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle empty arrays for keywords and categories', async () => {
      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'q' || key === 'n') {
            return { properties: mockQuantityData };
          }
          if (key === 'keywords') return [];
          if (key === 'categories') return [];
          if (key === 'discussionId') return null;
          if (key === 'actualResponseCount') return Integer.fromNumber(0);
          return null;
        }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getQuantity('quantity-123');

      expect(result).toBeDefined();
      expect(result?.keywords).toBeUndefined();
      expect(result?.categories).toBeUndefined();
    });

    it('should validate input', async () => {
      await expect(schema.getQuantity('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateQuantityNode', () => {
    beforeEach(() => {
      unitService.validateUnitInCategory.mockReturnValue(true);
    });

    it('should handle simple updates', async () => {
      const updateData = { question: 'Updated question' };

      jest.spyOn(schema, 'update').mockResolvedValue({
        ...mockQuantityData,
        ...updateData,
      });

      const result = await schema.updateQuantityNode(
        'quantity-123',
        updateData,
      );

      expect(result?.question).toBe('Updated question');
    });

    it('should validate unit changes', async () => {
      jest.spyOn(schema, 'getQuantity').mockResolvedValue(mockQuantityData);
      unitService.validateUnitInCategory.mockReturnValue(false);

      await expect(
        schema.updateQuantityNode('quantity-123', {
          unitCategoryId: 'temperature',
          defaultUnitId: 'invalid-unit',
        }),
      ).rejects.toThrow(
        'Unit invalid-unit is not valid for category temperature',
      );
    });

    it('should handle complex updates with keywords', async () => {
      const updateData = {
        keywords: [{ word: 'updated', frequency: 1, source: 'user' as const }],
      };

      jest.spyOn(schema, 'updateKeywords').mockResolvedValue(undefined);
      jest.spyOn(schema, 'getQuantity').mockResolvedValue({
        ...mockQuantityData,
        keywords: updateData.keywords,
      });

      const result = await schema.updateQuantityNode(
        'quantity-123',
        updateData,
      );

      expect(result).toBeDefined();
    });

    it('should reject too many categories', async () => {
      await expect(
        schema.updateQuantityNode('quantity-123', {
          categoryIds: ['cat1', 'cat2', 'cat3', 'cat4'],
        }),
      ).rejects.toThrow('Quantity node can have maximum 3 categories');
    });
  });

  describe('Numeric Response System', () => {
    beforeEach(() => {
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
    });

    describe('submitResponse', () => {
      it('should submit new response when inclusion threshold passed', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5,
        });
        jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);

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
        expect(result).toEqual(mockQuantityResponse);
      });

      it('should update existing response', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5,
        });
        jest
          .spyOn(schema, 'getUserResponse')
          .mockResolvedValue(mockQuantityResponse);

        const updatedResponse = { ...mockQuantityResponse, value: 95 };
        const mockRecord = {
          get: jest.fn().mockReturnValue(updatedResponse),
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

        expect(result.value).toBe(95);
      });

      it('should reject response when inclusion threshold not passed', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 0,
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

      it('should reject invalid unit', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5,
        });
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

      it('should reject when quantity not found', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue(null);

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

        expect(result).toEqual(mockQuantityResponse);
      });

      it('should return null when no response found', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(null),
        } as unknown as Record;

        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getUserResponse('user-789', 'quantity-123');

        expect(result).toBeNull();
      });
    });

    describe('deleteUserResponse', () => {
      it('should delete user response', async () => {
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
      it('should get all responses for quantity', async () => {
        const mockResponses = [mockQuantityResponse];
        const mockRecords = mockResponses.map((response) => ({
          get: jest.fn().mockReturnValue(response),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getAllResponses('quantity-123');

        expect(result).toEqual(mockResponses);
      });

      it('should return empty array when no responses', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getAllResponses('quantity-123');

        expect(result).toEqual([]);
      });
    });

    describe('getStatistics', () => {
      it('should calculate statistics from responses', async () => {
        const mockResponses = [
          { normalizedValue: 358.15 },
          { normalizedValue: 368.15 },
          { normalizedValue: 363.15 },
        ];

        jest
          .spyOn(schema, 'getAllResponses')
          .mockResolvedValue(mockResponses as any);

        const result = await schema.getStatistics('quantity-123');

        expect(result.responseCount).toBe(3);
        expect(result.min).toBe(358.15);
        expect(result.max).toBe(368.15);
        expect(result.mean).toBeCloseTo(363.15, 2);
        expect(result.median).toBe(363.15);
        expect(result.standardDeviation).toBeGreaterThan(0);
        expect(result.percentiles).toHaveProperty('50');
      });

      it('should return zero values when no responses', async () => {
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
      it('should return true when inclusion threshold passed', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 5,
        });

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(true);
      });

      it('should return false when inclusion threshold not passed', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue({
          ...mockQuantityData,
          inclusionNetVotes: 0,
        });

        const result = await schema.isNumericResponseAllowed('quantity-123');

        expect(result).toBe(false);
      });

      it('should return false when quantity not found', async () => {
        jest.spyOn(schema, 'getQuantity').mockResolvedValue(null);

        const result = await schema.isNumericResponseAllowed('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Discovery Methods', () => {
    describe('getQuantityNodesByUnitCategory', () => {
      it('should get quantities by unit category', async () => {
        const mockNodes = [
          {
            id: 'quantity-1',
            question: 'Question 1',
            inclusionNetVotes: Integer.fromNumber(10),
          },
          {
            id: 'quantity-2',
            question: 'Question 2',
            inclusionNetVotes: Integer.fromNumber(5),
          },
        ];

        const mockRecords = mockNodes.map((node) => ({
          get: jest.fn().mockImplementation((key) => {
            if (key === 'q') return { properties: node };
            return null;
          }),
        })) as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result =
          await schema.getQuantityNodesByUnitCategory('temperature');

        expect(result).toHaveLength(2);
        expect(result[0].inclusionNetVotes).toBe(10);
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

    describe('getQuantities', () => {
      it('should get quantities with filters', async () => {
        const mockRecords = [
          {
            get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
          },
        ] as unknown as Record[];

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getQuantities({
          categoryId: 'cat1',
          unitCategoryId: 'temperature',
        });

        expect(result).toHaveLength(1);
      });

      it('should include unapproved quantities when specified', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await schema.getQuantities({ includeUnapproved: true });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.not.stringContaining('WHERE'),
          expect.any(Object),
        );
      });
    });
  });

  describe('checkQuantities', () => {
    it('should return quantity count', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(42)),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.checkQuantities();

      expect(result).toEqual({ count: 42 });
    });
  });

  describe('Input Validation', () => {
    it('should reject null/undefined IDs', async () => {
      await expect(schema.findById(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(schema.findById(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject whitespace-only question text', async () => {
      unitService.validateUnitInCategory.mockReturnValue(true);

      await expect(
        schema.createQuantityNode({
          createdBy: 'user-456',
          publicCredit: true,
          question: '   ',
          unitCategoryId: 'temperature',
          defaultUnitId: 'celsius',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should convert Neo4j Integer objects to numbers', async () => {
      const mockDataWithIntegers = {
        ...mockQuantityData,
        inclusionPositiveVotes: Integer.fromNumber(999),
        responseCount: Integer.fromNumber(50),
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDataWithIntegers }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('quantity-123');

      expect(result?.inclusionPositiveVotes).toBe(999);
      expect(result?.responseCount).toBe(50);
      expect(typeof result?.inclusionPositiveVotes).toBe('number');
      expect(typeof result?.responseCount).toBe('number');
    });
  });

  describe('Business Rules Enforcement', () => {
    it('should enforce inclusion threshold for numeric responses', async () => {
      jest.spyOn(schema, 'getQuantity').mockResolvedValue({
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
      ).rejects.toThrow(
        'Quantity node must pass inclusion threshold before numeric responses are allowed',
      );
    });

    it('should validate unit compatibility across operations', async () => {
      unitService.validateUnitInCategory.mockReturnValue(false);

      // Test creation
      await expect(
        schema.createQuantityNode({
          createdBy: 'user-456',
          publicCredit: true,
          question: 'Test question',
          unitCategoryId: 'temperature',
          defaultUnitId: 'invalid-unit',
        }),
      ).rejects.toThrow(
        'Unit invalid-unit is not valid for category temperature',
      );

      // Test response submission
      unitService.validateUnitInCategory.mockReturnValue(true);
      jest.spyOn(schema, 'getQuantity').mockResolvedValue({
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

      jest.spyOn(schema, 'getQuantity').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: 5,
      });
      jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);

      const mockRecord = {
        get: jest.fn().mockReturnValue(mockQuantityResponse),
      } as unknown as Record;

      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.submitResponse({
        userId: 'user-456',
        quantityNodeId: 'quantity-123',
        value: 95,
        unitId: 'celsius',
      });

      // Verify that response count is incremented in the query
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('q.responseCount'),
        expect.any(Object),
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete quantity lifecycle', async () => {
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
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockQuantityData }),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-abc',
      });

      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const created = await schema.createQuantityNode({
        createdBy: 'user-456',
        publicCredit: true,
        question: 'Test question',
        unitCategoryId: 'temperature',
        defaultUnitId: 'celsius',
      });

      expect(created.id).toBe('quantity-123');

      // Vote inclusion
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'quantity-123',
        'user-789',
        true,
      );
      expect(voteResult.inclusionNetVotes).toBe(11);

      // Submit response
      jest.spyOn(schema, 'getQuantity').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: 5,
      });
      jest.spyOn(schema, 'getUserResponse').mockResolvedValue(null);

      const responseRecord = {
        get: jest.fn().mockReturnValue(mockQuantityResponse),
      } as unknown as Record;

      neo4jService.write.mockResolvedValueOnce({
        records: [responseRecord],
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
      jest.spyOn(schema, 'update').mockResolvedValue({
        ...mockQuantityData,
        ...updateData,
      });

      const updated = await schema.updateQuantityNode(
        'quantity-123',
        updateData,
      );
      expect(updated?.question).toBe('Updated question');

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
      jest.spyOn(schema, 'getQuantity').mockResolvedValue({
        ...mockQuantityData,
        inclusionNetVotes: -1,
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
          createdBy: 'user-456',
          publicCredit: true,
          question: 'Test question',
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
        'Failed to find Quantity: Database connection failed',
      );
    });

    it('should handle quantity-specific errors consistently', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getAllResponses('test')).rejects.toThrow(
        'Failed to get all responses: Query timeout',
      );
    });
  });

  describe('Schema Characteristics', () => {
    it('should not support content voting', () => {
      expect((schema as any).supportsContentVoting()).toBe(false);
    });

    it('should have standard id field', () => {
      expect((schema as any).idField).toBe('id');
    });

    it('should have correct node label', () => {
      expect((schema as any).nodeLabel).toBe('QuantityNode');
    });

    it('should support tagging', () => {
      expect(typeof schema.getKeywords).toBe('function');
      expect(typeof schema.updateKeywords).toBe('function');
    });

    it('should support categorization', () => {
      expect(typeof schema.getCategories).toBe('function');
      expect(typeof schema.updateCategories).toBe('function');
    });

    it('should have max 3 categories', () => {
      expect((schema as any).maxCategories).toBe(3);
    });
  });
});
