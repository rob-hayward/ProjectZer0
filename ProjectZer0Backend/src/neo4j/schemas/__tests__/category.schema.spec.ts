// src/neo4j/schemas/__tests__/category.schema.spec.ts - FIXED

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
    name: 'technology', // Auto-generated from words
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
    wordIds: ['technology', 'computer', 'digital'], // Words used to generate name
    createdBy: 'user-123',
    publicCredit: true,
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
      it('should build update query excluding id and name fields', () => {
        const updateData = {
          publicCredit: false,
        };

        const queryInfo = schema['buildUpdateQuery']('cat-123', updateData);

        expect(queryInfo.cypher).toContain('SET');
        expect(queryInfo.cypher).toContain(
          'n.publicCredit = $updateData.publicCredit',
        );
        expect(queryInfo.cypher).not.toContain('n.id =');
        expect(queryInfo.cypher).not.toContain('n.name ='); // Name cannot be updated manually
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
          publicCredit: false,
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
        expect(result?.publicCredit).toBe(false);
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
      it('should create category successfully with user tracking and auto-generated name', async () => {
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
            createdBy: mockCategoryNodeData.createdBy,
            publicCredit: mockCategoryNodeData.publicCredit,
            wordIds: mockCategoryNodeData.wordIds,
            parentCategoryId: mockCategoryNodeData.parentCategoryId,
          }),
        );

        // Verify name is auto-generated in query
        const cypherQuery = neo4jService.write.mock.calls[0][0];
        expect(cypherQuery).toContain('apoc.text.join');
        expect(cypherQuery).toContain('generatedName');

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
        expect(result.name).toBe('technology'); // Auto-generated
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
        neo4jService.write.mockResolvedValue({
          records: [], // Empty result indicates failure
        } as unknown as Result);

        await expect(
          schema.createCategory(mockCategoryNodeData),
        ).rejects.toThrow(
          'Some words may not exist or have not passed inclusion threshold',
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
    });

    describe('getCategoriesForNode', () => {
      it('should get categories for a node', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoriesForNode('node-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (node {id: $nodeId})-[:CATEGORIZED_AS]->(c:CategoryNode)',
          ),
          { nodeId: 'node-123' },
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockCategoryData);
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
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoryHierarchy();

        expect(neo4jService.read).toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'cat-123',
          name: 'technology',
        });
      });

      it('should get category hierarchy for specific root', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getCategoryHierarchy('root-cat');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (root:CategoryNode {id: $rootId})'),
          { rootId: 'root-cat' },
        );
        expect(result).toHaveLength(1);
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
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockCategoryData);
      });
    });

    describe('getAllCategories', () => {
      it('should get all categories', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCategoryData }),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [mockRecord],
        } as unknown as Result);

        const result = await schema.getAllCategories();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (c:CategoryNode)'),
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockCategoryData);
      });
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
          if (field === 'words') return [];
          if (field === 'parentCategory') return null;
          if (field === 'childCategories') return [];
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
          properties: { ...mockCategoryData, publicCredit: false },
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [updateRecord],
      } as unknown as Result);

      const updated = await schema.update('cat-123', {
        publicCredit: false,
      });
      expect(updated?.publicCredit).toBe(false);

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
  });
});
