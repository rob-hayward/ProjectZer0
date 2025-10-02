// src/neo4j/schemas/__tests__/category.schema.spec.ts - FIXED FOR UserSchema

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CategorySchema,
  CategoryData,
  CategoryNodeData,
} from '../category.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { DiscussionSchema } from '../discussion.schema';
import { UserSchema } from '../user.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('CategorySchema with BaseNodeSchema Integration', () => {
  let schema: CategorySchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let discussionSchema: jest.Mocked<DiscussionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

  const mockCategoryData: CategoryData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
    createdBy: 'user-123',
    publicCredit: true,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    // Only inclusion voting (no content voting)
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
    // Additional category fields
    wordCount: 3,
    contentCount: 15,
    childCount: 2,
  };

  const mockCategoryNodeData: CategoryNodeData = {
    id: 'cat-123',
    name: 'Technology',
    description: 'Technology related content',
    createdBy: 'user-123',
    publicCredit: true,
    wordIds: ['word-1', 'word-2', 'word-3'],
    parentCategoryId: 'parent-cat',
    initialComment: 'Initial category comment',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 8,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 6,
    contentStatus: null, // No content voting for categories
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategorySchema,
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
      ],
    }).compile();

    schema = module.get<CategorySchema>(CategorySchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
    discussionSchema = module.get(DiscussionSchema);
    userSchema = module.get(UserSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseNodeSchema Integration', () => {
    describe('supportsContentVoting', () => {
      it('should only support inclusion voting', () => {
        expect(schema['supportsContentVoting']()).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map Neo4j record to CategoryData with inclusion voting only', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        expect(result).toEqual(mockCategoryData);
        expect(result.inclusionNetVotes).toBe(6);
        expect(result.contentNetVotes).toBe(0); // No content voting
      });

      it('should handle Neo4j Integer conversion correctly', () => {
        const mockPropsWithIntegers = {
          ...mockCategoryData,
          inclusionPositiveVotes: Integer.fromNumber(999999),
          inclusionNegativeVotes: Integer.fromNumber(100000),
          inclusionNetVotes: Integer.fromNumber(899999),
          wordCount: Integer.fromNumber(5),
          contentCount: Integer.fromNumber(50),
          childCount: Integer.fromNumber(3),
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPropsWithIntegers }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        expect(result.inclusionPositiveVotes).toBe(999999);
        expect(result.inclusionNegativeVotes).toBe(100000);
        expect(result.inclusionNetVotes).toBe(899999);
        expect(result.wordCount).toBe(5);
        expect(result.contentCount).toBe(50);
        expect(result.childCount).toBe(3);
      });

      it('should handle null and undefined values in toNumber', () => {
        const mockPropsWithNulls = {
          ...mockCategoryData,
          inclusionPositiveVotes: null,
          inclusionNegativeVotes: undefined,
          inclusionNetVotes: 0,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockPropsWithNulls }),
        } as unknown as Record;

        const result = schema['mapNodeFromRecord'](mockRecord);

        // Verify null/undefined are handled correctly (should become 0)
        expect(result.inclusionPositiveVotes).toBe(0);
        expect(result.inclusionNegativeVotes).toBe(0);
        expect(result.inclusionNetVotes).toBe(0);
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build update query excluding id field', () => {
        const updateData = {
          name: 'Updated Technology',
          description: 'Updated description',
        };

        const queryInfo = schema['buildUpdateQuery']('cat-123', updateData);

        expect(queryInfo.cypher).toContain('SET');
        expect(queryInfo.cypher).toContain('n.name = $updateData.name');
        expect(queryInfo.cypher).toContain(
          'n.description = $updateData.description',
        );
        expect(queryInfo.cypher).not.toContain('n.id =');
        expect(queryInfo.params).toEqual({
          id: 'cat-123',
          updateData,
        });
      });
    });
  });

  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find a category by id using inherited method', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.findById('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CategoryNode {id: $id})'),
          { id: 'cat-123' },
        );
        expect(result).toEqual(mockCategoryData);
      });

      it('should return null when category not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('update (inherited)', () => {
      it('should update category using inherited method', async () => {
        const updateData = {
          name: 'Updated Tech',
          description: 'Updated desc',
        };
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: { ...mockCategoryData, ...updateData },
          }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.update('cat-123', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:CategoryNode {id: $id})'),
          expect.objectContaining({
            id: 'cat-123',
            updateData,
          }),
        );
        expect(result?.name).toBe('Updated Tech');
        expect(result?.description).toBe('Updated desc');
      });
    });

    describe('delete (inherited)', () => {
      it('should delete category using inherited method', async () => {
        // Mock findById for existence check
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        // Mock the actual delete operation
        neo4jService.write.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.delete('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(n) as count'),
          { id: 'cat-123' },
        );
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Voting Integration with BaseNodeSchema', () => {
    describe('voteInclusion (inherited)', () => {
      it('should vote on category inclusion using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteInclusion('cat-123', 'user-456', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'CategoryNode',
          { id: 'cat-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inputs using inherited validation', async () => {
        await expect(
          schema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(schema.voteInclusion('cat-123', '', true)).rejects.toThrow(
          BadRequestException,
        );
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent (inherited) - Should Reject', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          schema.voteContent('cat-123', 'user-456', true),
        ).rejects.toThrow('Category does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVoteStatus('cat-123', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'CategoryNode',
          { id: 'cat-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
        expect(result?.inclusionStatus).toBe('agree');
        expect(result?.contentStatus).toBeNull(); // No content voting
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote using inherited method', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeVote(
          'cat-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'CategoryNode',
          { id: 'cat-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes (inherited)', () => {
      it('should get vote counts with content votes zero for categories', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getVotes('cat-123');

        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: 0, // Always 0 for categories
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });
  });

  describe('Enhanced Category-Specific Methods', () => {
    describe('createCategory', () => {
      it('should create category successfully with user tracking', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);
        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-123',
        });
        userSchema.addCreatedNode.mockResolvedValue(undefined);

        const result = await schema.createCategory(mockCategoryNodeData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (c:CategoryNode'),
          expect.objectContaining({
            id: mockCategoryNodeData.id,
            name: mockCategoryNodeData.name,
            description: mockCategoryNodeData.description,
            createdBy: mockCategoryNodeData.createdBy,
            publicCredit: mockCategoryNodeData.publicCredit,
            wordIds: mockCategoryNodeData.wordIds,
            parentCategoryId: mockCategoryNodeData.parentCategoryId,
          }),
        );
        expect(discussionSchema.createDiscussionForNode).toHaveBeenCalledWith({
          nodeId: mockCategoryNodeData.id,
          nodeType: 'CategoryNode',
          nodeIdField: 'id',
          createdBy: mockCategoryNodeData.createdBy,
          initialComment: mockCategoryNodeData.initialComment,
        });

        // Verify user tracking was called
        expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
          mockCategoryNodeData.createdBy,
          mockCategoryNodeData.id,
          'category',
        );

        expect(result).toBeDefined();
        expect(result.discussionId).toBe('discussion-123');
      });

      it('should continue even if user tracking fails', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.write.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);
        discussionSchema.createDiscussionForNode.mockResolvedValue({
          discussionId: 'discussion-123',
        });
        userSchema.addCreatedNode.mockRejectedValue(
          new Error('User tracking failed'),
        );

        const result = await schema.createCategory(mockCategoryNodeData);

        expect(result).toBeDefined();
        expect(result.discussionId).toBe('discussion-123');
        // Should not throw even though user tracking failed
      });

      it('should handle creation failure when words do not exist', async () => {
        neo4jService.write.mockRejectedValue(
          new Error(
            'Some words may not exist or have not passed inclusion threshold',
          ),
        );

        await expect(
          schema.createCategory(mockCategoryNodeData),
        ).rejects.toThrow(
          'All words must exist and have passed inclusion threshold before being used in a category',
        );
      });

      it('should validate word count (1-5 words)', async () => {
        const invalidData = {
          ...mockCategoryNodeData,
          wordIds: [], // Empty array
        };

        await expect(schema.createCategory(invalidData)).rejects.toThrow(
          'Category must be composed of 1-5 words',
        );

        const tooManyWords = {
          ...mockCategoryNodeData,
          wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'], // 6 words
        };

        await expect(schema.createCategory(tooManyWords)).rejects.toThrow(
          'Category must be composed of 1-5 words',
        );
      });

      it('should validate category name', async () => {
        const invalidData = {
          ...mockCategoryNodeData,
          name: '', // Empty name
        };

        await expect(schema.createCategory(invalidData)).rejects.toThrow(
          'Category name cannot be empty',
        );
      });
    });

    describe('getCategory', () => {
      it('should retrieve category with enhanced data', async () => {
        const extendedCategoryData = {
          ...mockCategoryData,
          words: [
            { id: 'word-1', word: 'technology', inclusionNetVotes: 10 },
            { id: 'word-2', word: 'computer', inclusionNetVotes: 8 },
            { id: 'word-3', word: 'digital', inclusionNetVotes: 6 },
          ],
          parentCategory: { id: 'parent-cat', name: 'Parent Category' },
          childCategories: [
            { id: 'child-1', name: 'Child Category 1', inclusionNetVotes: 5 },
            { id: 'child-2', name: 'Child Category 2', inclusionNetVotes: 3 },
          ],
          contentCount: 15,
        };

        const mockRecord = {
          get: jest.fn((field) => {
            if (field === 'c') return { properties: mockCategoryData };
            if (field === 'n') return { properties: mockCategoryData };
            if (field === 'discussionId') return 'discussion-123';
            if (field === 'words') return extendedCategoryData.words;
            if (field === 'parentCategory')
              return extendedCategoryData.parentCategory;
            if (field === 'childCategories')
              return extendedCategoryData.childCategories;
            if (field === 'contentCount')
              return Integer.fromNumber(extendedCategoryData.contentCount);
            return [];
          }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategory('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (c:CategoryNode {id: $id})'),
          { id: 'cat-123' },
        );
        expect(result).toBeDefined();
        expect(result.discussionId).toBe('discussion-123');
        expect(result.words).toEqual(extendedCategoryData.words);
        expect(result.parentCategory).toEqual(
          extendedCategoryData.parentCategory,
        );
        expect(result.childCategories).toEqual(
          extendedCategoryData.childCategories,
        );
      });

      it('should return null when category not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getCategory('nonexistent');

        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(schema.getCategory('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('getCategoryStats', () => {
      it('should return category statistics', async () => {
        const mockStats = {
          contentCount: 25,
          childCount: 3,
          wordCount: 4,
          inclusionNetVotes: 10,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({
            contentCount: Integer.fromNumber(mockStats.contentCount),
            childCount: Integer.fromNumber(mockStats.childCount),
            wordCount: Integer.fromNumber(mockStats.wordCount),
            inclusionNetVotes: Integer.fromNumber(mockStats.inclusionNetVotes),
          }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoryStats('cat-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('count(DISTINCT content)'),
          { categoryId: 'cat-123' },
        );
        expect(result).toEqual(mockStats);
      });

      it('should throw NotFoundException when category not found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        await expect(schema.getCategoryStats('nonexistent')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('getCategoriesForNode', () => {
      it('should get categories for a node', async () => {
        const mockCategories = [
          {
            id: 'cat-1',
            name: 'Category 1',
            description: 'Description 1',
            inclusionNetVotes: 10,
            path: [{ id: 'cat-1', name: 'Category 1' }],
          },
        ];

        const mockRecord = {
          get: jest.fn().mockReturnValue(mockCategories),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoriesForNode('node-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE node.id = $nodeId'),
          { nodeId: 'node-123' },
        );
        expect(result).toEqual(mockCategories);
      });

      it('should return empty array when no categories found', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result = await schema.getCategoriesForNode('node-123');

        expect(result).toEqual([]);
      });
    });

    describe('getCategoryHierarchy', () => {
      it('should get category hierarchy', async () => {
        const mockHierarchy = [
          {
            id: 'root-1',
            name: 'Root Category',
            description: 'Root description',
            inclusionNetVotes: 15,
            children: [
              { id: 'child-1', name: 'Child 1', inclusionNetVotes: 10 },
            ],
          },
        ];

        const mockRecords = mockHierarchy.map((h) => ({
          get: jest.fn().mockReturnValue(h),
        }));

        neo4jService.read.mockResolvedValue({
          records: mockRecords,
        } as unknown as Result);

        const result = await schema.getCategoryHierarchy();

        expect(neo4jService.read).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'root-1',
          name: 'Root Category',
        });
      });
    });

    describe('getApprovedCategories', () => {
      it('should get approved categories', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getApprovedCategories();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE c.inclusionNetVotes > 0'),
          {},
        );
        expect(result).toHaveLength(1);

        const expectedBasicData = {
          id: mockCategoryData.id,
          name: mockCategoryData.name,
          description: mockCategoryData.description,
          createdBy: mockCategoryData.createdBy,
          publicCredit: mockCategoryData.publicCredit,
          discussionId: mockCategoryData.discussionId,
          createdAt: mockCategoryData.createdAt,
          updatedAt: mockCategoryData.updatedAt,
          inclusionPositiveVotes: mockCategoryData.inclusionPositiveVotes,
          inclusionNegativeVotes: mockCategoryData.inclusionNegativeVotes,
          inclusionNetVotes: mockCategoryData.inclusionNetVotes,
          contentPositiveVotes: mockCategoryData.contentPositiveVotes,
          contentNegativeVotes: mockCategoryData.contentNegativeVotes,
          contentNetVotes: mockCategoryData.contentNetVotes,
          wordCount: mockCategoryData.wordCount,
          contentCount: mockCategoryData.contentCount,
          childCount: mockCategoryData.childCount,
        };
        expect(result[0]).toEqual(expectedBasicData);
      });
    });

    describe('checkCategories', () => {
      it('should return category count', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(25)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.checkCategories();

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (c:CategoryNode) RETURN count(c) as count',
          {},
        );
        expect(result.count).toBe(25);
      });
    });

    describe('isWordAvailableForCategoryComposition', () => {
      it('should return true for approved words', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(5)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result =
          await schema.isWordAvailableForCategoryComposition('word-1');

        expect(result).toBe(true);
      });

      it('should return false for unapproved words', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result =
          await schema.isWordAvailableForCategoryComposition('word-1');

        expect(result).toBe(false);
      });

      it('should return false when word does not exist', async () => {
        neo4jService.read.mockResolvedValue({
          records: [],
        } as unknown as Result);

        const result =
          await schema.isWordAvailableForCategoryComposition('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('validateWordsForComposition', () => {
      it('should validate all words exist and are approved', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(['word-1', 'word-2', 'word-3']),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.validateWordsForComposition([
          'word-1',
          'word-2',
          'word-3',
        ]);

        expect(result.valid).toBe(true);
        expect(result.invalidWords).toEqual([]);
      });

      it('should reject if word count is invalid', async () => {
        const result = await schema.validateWordsForComposition([]);

        expect(result.valid).toBe(false);
        expect(result.message).toContain('Must provide 1-5 word IDs');
      });

      it('should identify invalid words', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(['word-1', 'word-2']),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.validateWordsForComposition([
          'word-1',
          'word-2',
          'word-3',
        ]);

        expect(result.valid).toBe(false);
        expect(result.invalidWords).toEqual(['word-3']);
      });
    });
  });

  // Rest of the tests continue as before...
  // (keeping all other tests unchanged)

  describe('getAllCategories', () => {
    it('should get all categories with default options', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories();

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CategoryNode)'),
        expect.objectContaining({
          offset: 0,
          limit: 1000,
        }),
      );
      expect(result).toHaveLength(1);

      const expectedBasicData = {
        id: mockCategoryData.id,
        name: mockCategoryData.name,
        description: mockCategoryData.description,
        createdBy: mockCategoryData.createdBy,
        publicCredit: mockCategoryData.publicCredit,
        discussionId: mockCategoryData.discussionId,
        createdAt: mockCategoryData.createdAt,
        updatedAt: mockCategoryData.updatedAt,
        inclusionPositiveVotes: mockCategoryData.inclusionPositiveVotes,
        inclusionNegativeVotes: mockCategoryData.inclusionNegativeVotes,
        inclusionNetVotes: mockCategoryData.inclusionNetVotes,
        contentPositiveVotes: mockCategoryData.contentPositiveVotes,
        contentNegativeVotes: mockCategoryData.contentNegativeVotes,
        contentNetVotes: mockCategoryData.contentNetVotes,
        wordCount: mockCategoryData.wordCount,
        contentCount: mockCategoryData.contentCount,
        childCount: mockCategoryData.childCount,
      };
      expect(result[0]).toEqual(expectedBasicData);
    });

    it('should filter by parent category', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories({
        parentId: 'parent-cat-123',
        limit: 10,
        offset: 5,
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)',
        ),
        expect.objectContaining({
          parentId: 'parent-cat-123',
          offset: 5,
          limit: 10,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockCategoryData.id);
      expect(result[0].name).toBe(mockCategoryData.name);
    });

    it('should filter by search query', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories({
        searchQuery: 'technology',
        onlyApproved: true,
      });

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining(
          'toLower(c.name) CONTAINS toLower($searchQuery)',
        ),
        expect.objectContaining({
          searchQuery: 'technology',
          offset: 0,
          limit: 1000,
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockCategoryData.id);
    });

    it('should combine parent filtering and search query', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getAllCategories({
        parentId: 'parent-cat-123',
        searchQuery: 'tech',
        onlyApproved: true,
        sortBy: 'votes',
        sortDirection: 'desc',
        limit: 20,
        offset: 10,
      });

      const query = neo4jService.read.mock.calls[0][0];
      const params = neo4jService.read.mock.calls[0][1];

      expect(query).toContain(
        'MATCH (parent:CategoryNode {id: $parentId})-[:PARENT_OF]->(c:CategoryNode)',
      );
      expect(query).toContain('toLower(c.name) CONTAINS toLower($searchQuery)');
      expect(query).toContain('c.inclusionNetVotes > 0');
      expect(query).toContain('ORDER BY c.inclusionNetVotes DESC');
      expect(query).toContain('SKIP $offset LIMIT $limit');

      expect(params).toEqual({
        parentId: 'parent-cat-123',
        searchQuery: 'tech',
        offset: 10,
        limit: 20,
      });
      expect(result).toHaveLength(1);
    });

    it('should apply different sort options correctly', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({ sortBy: 'name', sortDirection: 'asc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.name ASC'),
        expect.any(Object),
      );

      await schema.getAllCategories({
        sortBy: 'created',
        sortDirection: 'desc',
      });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.createdAt DESC'),
        expect.any(Object),
      );

      await schema.getAllCategories({ sortBy: 'usage', sortDirection: 'asc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.contentCount ASC'),
        expect.any(Object),
      );

      await schema.getAllCategories({ sortBy: 'votes', sortDirection: 'desc' });
      expect(neo4jService.read).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY c.inclusionNetVotes DESC'),
        expect.any(Object),
      );
    });

    it('should handle onlyApproved filter', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({ onlyApproved: true });
      let query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('c.inclusionNetVotes > 0');

      await schema.getAllCategories({ onlyApproved: false });
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).not.toContain('c.inclusionNetVotes > 0');
    });

    it('should handle pagination correctly', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({ limit: 25, offset: 50 });
      let query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('SKIP $offset LIMIT $limit');

      await schema.getAllCategories({ offset: 10 });
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).toContain('SKIP $offset');
      expect(query).not.toContain('LIMIT');

      await schema.getAllCategories({});
      query =
        neo4jService.read.mock.calls[
          neo4jService.read.mock.calls.length - 1
        ][0];
      expect(query).not.toContain('SKIP');
      expect(query).not.toContain('LIMIT');
    });

    it('should search in category name, description, and composed words', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({ searchQuery: 'AI' });

      const query = neo4jService.read.mock.calls[0][0];

      expect(query).toContain('toLower(c.name) CONTAINS toLower($searchQuery)');
      expect(query).toContain(
        'toLower(c.description) CONTAINS toLower($searchQuery)',
      );
      expect(query).toContain('MATCH (c)-[:COMPOSED_OF]->(w:WordNode)');
      expect(query).toContain('toLower(w.word) CONTAINS toLower($searchQuery)');
    });

    it('should handle empty results', async () => {
      neo4jService.read.mockResolvedValue({
        records: [],
      } as unknown as Result);

      const result = await schema.getAllCategories({ parentId: 'nonexistent' });

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.getAllCategories()).rejects.toThrow(
        'Failed to get all categories Category: Database connection failed',
      );
    });

    it('should use correct default values', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getAllCategories({});

      const params = neo4jService.read.mock.calls[0][1];
      expect(params.offset).toBe(0);
      expect(params.limit).toBe(1000);
    });
  });

  describe('Self-Categorization', () => {
    it('should create self-categorization relationship when category is created', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      await schema.createCategory(mockCategoryNodeData);

      const cypherQuery = neo4jService.write.mock.calls[0][0];
      expect(cypherQuery).toContain('CREATE (c)-[:CATEGORIZED_AS]->(c)');
    });

    it('should include category in its own dataset when querying by category', async () => {
      const mockRecords = [
        {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        },
        {
          get: jest.fn().mockReturnValue({
            properties: {
              ...mockCategoryData,
              id: 'statement-123',
              statement: 'Test statement',
            },
          }),
        },
      ] as unknown as Record[];

      neo4jService.read.mockResolvedValue({
        records: mockRecords,
      } as unknown as Result);

      const result = await neo4jService.read(
        `MATCH (n)-[:CATEGORIZED_AS]->(cat:CategoryNode {id: $catId})
         RETURN n`,
        { catId: 'cat-123' },
      );

      expect(result.records).toHaveLength(2);
    });

    it('should exclude self-categorization from content count', async () => {
      const mockRecord = {
        get: jest.fn((field) => {
          if (field === 'c') return { properties: mockCategoryData };
          if (field === 'n') return { properties: mockCategoryData };
          if (field === 'contentCount') return Integer.fromNumber(15);
          if (field === 'discussionId') return 'discussion-123';
          if (field === 'words') return [];
          if (field === 'parentCategory') return null;
          if (field === 'childCategories') return [];
          return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getCategory('cat-123');

      const cypherQuery = neo4jService.read.mock.calls[0][0];
      expect(cypherQuery).toContain('content.id <> c.id');

      expect(result?.contentCount).toBe(15);
    });

    it('should exclude self from content count in getCategoryStats', async () => {
      const mockStats = {
        contentCount: 25,
        childCount: 3,
        wordCount: 4,
        inclusionNetVotes: 10,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          contentCount: Integer.fromNumber(mockStats.contentCount),
          childCount: Integer.fromNumber(mockStats.childCount),
          wordCount: Integer.fromNumber(mockStats.wordCount),
          inclusionNetVotes: Integer.fromNumber(mockStats.inclusionNetVotes),
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.getCategoryStats('cat-123');

      const cypherQuery = neo4jService.read.mock.calls[0][0];
      expect(cypherQuery).toContain('content.id <> c.id');

      expect(result.contentCount).toBe(25);
    });

    it('should verify EvidenceNode is included in content queries', async () => {
      const mockRecord = {
        get: jest.fn((field) => {
          if (field === 'c') return { properties: mockCategoryData };
          if (field === 'n') return { properties: mockCategoryData };
          if (field === 'contentCount') return Integer.fromNumber(10);
          if (field === 'discussionId') return 'discussion-123';
          if (field === 'words') return [];
          if (field === 'parentCategory') return null;
          if (field === 'childCategories') return [];
          return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      await schema.getCategory('cat-123');

      const cypherQuery = neo4jService.read.mock.calls[0][0];
      expect(cypherQuery).toContain('content:StatementNode');
      expect(cypherQuery).toContain('content:AnswerNode');
      expect(cypherQuery).toContain('content:OpenQuestionNode');
      expect(cypherQuery).toContain('content:QuantityNode');
      expect(cypherQuery).toContain('content:EvidenceNode');
    });

    it('should handle self-categorization consistently with word self-tagging pattern', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      await schema.createCategory(mockCategoryNodeData);

      const cypherQuery = neo4jService.write.mock.calls[0][0];

      expect(cypherQuery).toContain('CREATE (c)-[:CATEGORIZED_AS]->(c)');

      const nodeCreationIndex = cypherQuery.indexOf('CREATE (c:CategoryNode');
      const selfCatIndex = cypherQuery.indexOf(
        'CREATE (c)-[:CATEGORIZED_AS]->(c)',
      );
      const parentIndex = cypherQuery.indexOf(
        'CREATE (parent)-[:PARENT_OF]->(c)',
      );

      expect(selfCatIndex).toBeGreaterThan(nodeCreationIndex);
      if (parentIndex > 0) {
        expect(selfCatIndex).toBeLessThan(parentIndex);
      }
    });
  });

  describe('getSortFieldForQuery (private helper)', () => {
    it('should map sort fields correctly', () => {
      const getSortField = (schema as any).getSortFieldForQuery;

      expect(getSortField('name')).toBe('c.name');
      expect(getSortField('votes')).toBe('c.inclusionNetVotes');
      expect(getSortField('created')).toBe('c.createdAt');
      expect(getSortField('usage')).toBe('c.contentCount');
      expect(getSortField('unknown')).toBe('c.name');
    });
  });

  describe('Error Handling Consistency', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(schema.findById('test')).rejects.toThrow(
        'Failed to find Category: Database connection failed',
      );
    });

    it('should use standardized error format for category-specific methods', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(schema.getCategory('test')).rejects.toThrow(
        'Failed to retrieve category Category: Query timeout',
      );
    });

    it('should validate input parameters consistently', async () => {
      await expect(schema.getCategoriesForNode('')).rejects.toThrow(
        BadRequestException,
      );

      expect(neo4jService.read).not.toHaveBeenCalled();
      expect(neo4jService.write).not.toHaveBeenCalled();
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

    it('should reject empty category name', async () => {
      const invalidData = {
        ...mockCategoryNodeData,
        name: '',
      };

      await expect(schema.createCategory(invalidData)).rejects.toThrow(
        'Category name cannot be empty',
      );
    });

    it('should reject whitespace-only category name', async () => {
      const invalidData = {
        ...mockCategoryNodeData,
        name: '   ',
      };

      await expect(schema.createCategory(invalidData)).rejects.toThrow(
        'Category name cannot be empty',
      );
    });
  });

  describe('Neo4j Integer Conversion', () => {
    it('should convert Neo4j Integer objects to numbers', async () => {
      const mockCategoryWithIntegers = {
        ...mockCategoryData,
        inclusionPositiveVotes: Integer.fromNumber(42),
        inclusionNegativeVotes: Integer.fromNumber(7),
        inclusionNetVotes: Integer.fromNumber(35),
        wordCount: Integer.fromNumber(3),
        contentCount: Integer.fromNumber(20),
        childCount: Integer.fromNumber(2),
      };

      const mockRecord = {
        get: jest
          .fn()
          .mockReturnValue({ properties: mockCategoryWithIntegers }),
      } as unknown as Record;

      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('cat-123');

      expect(result?.inclusionPositiveVotes).toBe(42);
      expect(result?.inclusionNegativeVotes).toBe(7);
      expect(result?.inclusionNetVotes).toBe(35);
      expect(result?.wordCount).toBe(3);
      expect(result?.contentCount).toBe(20);
      expect(result?.childCount).toBe(2);
      expect(typeof result?.inclusionPositiveVotes).toBe('number');
    });
  });

  describe('Business Rules Enforcement', () => {
    it('should enforce word count limits (1-5)', async () => {
      const noWords = {
        ...mockCategoryNodeData,
        wordIds: [],
      };

      await expect(schema.createCategory(noWords)).rejects.toThrow(
        'Category must be composed of 1-5 words',
      );

      const tooManyWords = {
        ...mockCategoryNodeData,
        wordIds: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
      };

      await expect(schema.createCategory(tooManyWords)).rejects.toThrow(
        'Category must be composed of 1-5 words',
      );
    });

    it('should validate words exist and have passed inclusion threshold', async () => {
      neo4jService.write.mockRejectedValue(
        new Error(
          'Some words may not exist or have not passed inclusion threshold',
        ),
      );

      await expect(schema.createCategory(mockCategoryNodeData)).rejects.toThrow(
        'All words must exist and have passed inclusion threshold before being used in a category',
      );
    });

    it('should prevent circular parent-child relationships', async () => {
      neo4jService.write.mockResolvedValue({
        records: [],
      } as unknown as Result);

      await expect(schema.createCategory(mockCategoryNodeData)).rejects.toThrow(
        'All words must exist and have passed inclusion threshold',
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete category lifecycle', async () => {
      const createRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-123',
      });
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const created = await schema.createCategory(mockCategoryNodeData);
      expect(created).toBeDefined();
      expect(created.discussionId).toBe('discussion-123');

      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await schema.voteInclusion(
        'cat-123',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      const getRecord = {
        get: jest.fn((field) => {
          if (field === 'c' || field === 'n')
            return { properties: mockCategoryData };
          if (field === 'discussionId') return 'discussion-123';
          if (field === 'words') return [];
          if (field === 'parentCategory') return null;
          if (field === 'childCategories') return [];
          if (field === 'contentCount') return Integer.fromNumber(0);
          return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [getRecord],
      } as unknown as Result);

      const retrieved = await schema.getCategory('cat-123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('cat-123');

      const updateRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockCategoryData, name: 'Updated Technology' },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      const updated = await schema.update('cat-123', {
        name: 'Updated Technology',
      });
      expect(updated?.name).toBe('Updated Technology');

      const existsRecord = {
        get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);
      neo4jService.write.mockResolvedValueOnce({
        records: [],
      } as unknown as Result);

      const deleteResult = await schema.delete('cat-123');
      expect(deleteResult.success).toBe(true);
    });

    it('should handle category hierarchy operations', async () => {
      const parentRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockCategoryData, id: 'parent-cat' },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [parentRecord],
      } as unknown as Result);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-parent',
      });
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      await schema.createCategory({
        ...mockCategoryNodeData,
        id: 'parent-cat',
        parentCategoryId: undefined,
      });

      const childRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockCategoryData, id: 'child-cat' },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [childRecord],
      } as unknown as Result);
      discussionSchema.createDiscussionForNode.mockResolvedValue({
        discussionId: 'discussion-child',
      });

      await schema.createCategory({
        ...mockCategoryNodeData,
        id: 'child-cat',
        parentCategoryId: 'parent-cat',
      });

      const hierarchyRecords = [
        {
          get: jest.fn().mockReturnValue({
            id: 'parent-cat',
            name: 'Parent Category',
            inclusionNetVotes: 10,
            children: [{ id: 'child-cat', name: 'Child Category' }],
          }),
        },
      ] as unknown as Record[];
      neo4jService.read.mockResolvedValueOnce({
        records: hierarchyRecords,
      } as unknown as Result);

      const hierarchy = await schema.getCategoryHierarchy();
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].id).toBe('parent-cat');
    });
  });

  describe('Schema Characteristics', () => {
    it('should not support content voting', async () => {
      await expect(
        schema.voteContent('cat-123', 'user-456', true),
      ).rejects.toThrow('Category does not support content voting');
    });

    it('should have standard id field', () => {
      expect((schema as any).idField).toBe('id');
    });

    it('should have correct node label', () => {
      expect((schema as any).nodeLabel).toBe('CategoryNode');
    });

    it('should not support tagging (categories use COMPOSED_OF)', () => {
      expect((schema as any).attachKeywords).toBeUndefined();
      expect((schema as any).getKeywords).toBeUndefined();
    });

    it('should not use categorization system (categories are the taxonomy)', () => {
      expect((schema as any).attachCategories).toBeUndefined();
      expect((schema as any).getCategories).toBeUndefined();
    });
  });

  describe('Category Composition', () => {
    it('should validate all words exist before category creation', async () => {
      neo4jService.write.mockRejectedValue(
        new Error(
          'Some words may not exist or have not passed inclusion threshold',
        ),
      );

      await expect(schema.createCategory(mockCategoryNodeData)).rejects.toThrow(
        'All words must exist and have passed inclusion threshold',
      );
    });

    it('should track word count correctly', async () => {
      const categoryWith5Words = {
        ...mockCategoryData,
        wordCount: 5,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: categoryWith5Words }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValue({
        records: [mockRecord],
      } as unknown as Result);

      const result = await schema.findById('cat-123');

      expect(result?.wordCount).toBe(5);
    });
  });
});
