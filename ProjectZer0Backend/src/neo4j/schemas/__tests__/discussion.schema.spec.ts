// src/neo4j/schemas/__tests__/discussion.schema.spec.ts - FIXED FOR BaseNodeSchema

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DiscussionSchema, DiscussionData } from '../discussion.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';

describe('DiscussionSchema with BaseNodeSchema Integration', () => {
  let discussionSchema: DiscussionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  const mockDiscussionData: DiscussionData = {
    id: 'discussion-123',
    createdBy: 'user-456',
    associatedNodeId: 'word-789',
    associatedNodeType: 'WordNode',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionSchema,
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
      ],
    }).compile();

    discussionSchema = module.get<DiscussionSchema>(DiscussionSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherited BaseNodeSchema Methods', () => {
    describe('findById (inherited)', () => {
      it('should find a discussion by id', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDiscussionData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await discussionSchema.findById('discussion-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DiscussionNode {id: $id})'),
          { id: 'discussion-123' },
        );
        expect(result).toEqual(mockDiscussionData);
      });

      it('should return null when discussion is not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await discussionSchema.findById('non-existent-id');
        expect(result).toBeNull();
      });

      it('should validate input', async () => {
        await expect(discussionSchema.findById('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('update (inherited)', () => {
      it('should update a discussion', async () => {
        const updateData = { associatedNodeType: 'UpdatedType' };
        const updatedDiscussion = { ...mockDiscussionData, ...updateData };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: updatedDiscussion }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await discussionSchema.update(
          'discussion-123',
          updateData,
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DiscussionNode {id: $id})'),
          expect.objectContaining({
            id: 'discussion-123',
            updateData,
          }),
        );
        expect(result).toEqual(updatedDiscussion);
      });

      it('should validate input', async () => {
        await expect(
          discussionSchema.update('', { associatedNodeType: 'Updated' }),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('delete (inherited)', () => {
      it('should delete a discussion', async () => {
        // ✅ FIXED: Mock the existence check that happens in BaseNodeSchema.delete()
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        const existsResult = {
          records: [existsRecord],
        } as unknown as Result;
        neo4jService.read.mockResolvedValue(existsResult);

        // ✅ FIXED: Mock the actual delete operation
        const deleteResult = {} as unknown as Result;
        neo4jService.write.mockResolvedValue(deleteResult);

        const result = await discussionSchema.delete('discussion-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DiscussionNode {id: $id})'),
          { id: 'discussion-123' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:DiscussionNode {id: $id})'),
          expect.objectContaining({ id: 'discussion-123' }),
        );
        expect(result).toEqual({ success: true });
      });

      it('should validate input', async () => {
        await expect(discussionSchema.delete('')).rejects.toThrow(
          BadRequestException,
        );
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });
  });

  describe('Voting Methods (Should Throw Errors)', () => {
    describe('voteInclusion (inherited)', () => {
      it('should throw error - discussions do not support inclusion voting', async () => {
        // ✅ FIXED: DiscussionNode is NOT in NODE_VOTING_RULES, so VoteSchema will throw an error
        voteSchema.vote.mockRejectedValue(
          new Error('DiscussionNode does not support inclusion voting'),
        );

        await expect(
          discussionSchema.voteInclusion('discussion-123', 'user-456', true),
        ).rejects.toThrow('DiscussionNode does not support inclusion voting');

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DiscussionNode',
          { id: 'discussion-123' },
          'user-456',
          true,
          'INCLUSION',
        );
      });
    });

    describe('voteContent (inherited)', () => {
      it('should throw error - discussions do not support content voting', async () => {
        // ✅ FIXED: BaseNodeSchema checks supportsContentVoting() first and throws BadRequestException
        await expect(
          discussionSchema.voteContent('discussion-123', 'user-456', true),
        ).rejects.toThrow('Discussion does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });
  });

  describe('Discussion-Specific Methods', () => {
    describe('createDiscussion', () => {
      it('should create a discussion', async () => {
        const discussionData = {
          id: 'discussion-123',
          createdBy: 'user-456',
          associatedNodeId: 'word-789',
          associatedNodeType: 'WordNode',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDiscussionData }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await discussionSchema.createDiscussion(discussionData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('CREATE (d:DiscussionNode'),
          expect.objectContaining(discussionData),
        );
        expect(result).toEqual(mockDiscussionData);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          id: '', // Empty ID should trigger validation
          createdBy: 'user-456',
          associatedNodeId: 'word-789',
          associatedNodeType: 'WordNode',
        };

        // ✅ FIXED: Should throw BadRequestException for validation, not access undefined records
        await expect(
          discussionSchema.createDiscussion(invalidData),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.write).not.toHaveBeenCalled();
      });
    });

    describe('getDiscussionsByAssociatedNode', () => {
      it('should get discussions by associated node', async () => {
        const mockDiscussions = [mockDiscussionData];
        const mockRecords = mockDiscussions.map((discussion) => ({
          get: jest.fn().mockReturnValue({ properties: discussion }),
        }));
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await discussionSchema.getDiscussionsByAssociatedNode(
          'word-789',
          'WordNode',
        );

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('associatedNodeId: $nodeId'),
          expect.objectContaining({
            nodeId: 'word-789',
            nodeType: 'WordNode',
          }),
        );
        expect(result).toEqual(mockDiscussions);
      });

      it('should validate input parameters', async () => {
        // ✅ FIXED: Should throw BadRequestException for validation
        await expect(
          discussionSchema.getDiscussionsByAssociatedNode('', 'WordNode'),
        ).rejects.toThrow(BadRequestException);

        await expect(
          discussionSchema.getDiscussionsByAssociatedNode('word-789', ''),
        ).rejects.toThrow(BadRequestException);

        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });

    describe('getDiscussionCommentCount', () => {
      it('should get discussion comment count', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(5)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await discussionSchema.getDiscussionCommentCount('discussion-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(c) as commentCount'),
          { id: 'discussion-123' }, // ✅ FIXED: Parameter should be 'id', not 'discussionId'
        );
        expect(result).toBe(5);
      });

      it('should return 0 when no comments exist', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await discussionSchema.getDiscussionCommentCount('discussion-123');
        expect(result).toBe(0);
      });

      it('should validate input', async () => {
        // ✅ FIXED: Should throw BadRequestException for validation
        await expect(
          discussionSchema.getDiscussionCommentCount(''),
        ).rejects.toThrow(BadRequestException);
        expect(neo4jService.read).not.toHaveBeenCalled();
      });
    });
  });

  describe('Protected Method Testing', () => {
    describe('supportsContentVoting', () => {
      it('should return false (discussions do not support content voting)', () => {
        // Access protected method for testing
        const supportsContent = (
          discussionSchema as any
        ).supportsContentVoting();
        expect(supportsContent).toBe(false);
      });
    });

    describe('mapNodeFromRecord', () => {
      it('should map node properties correctly', () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue({
            properties: {
              id: 'discussion-123',
              createdBy: 'user-456',
              associatedNodeId: 'word-789',
              associatedNodeType: 'WordNode',
              createdAt: new Date('2023-01-01T00:00:00Z'),
              updatedAt: new Date('2023-01-01T00:00:00Z'),
            },
          }),
        } as unknown as Record;

        // Access protected method for testing
        const result = (discussionSchema as any).mapNodeFromRecord(mockRecord);

        expect(result).toEqual({
          id: 'discussion-123',
          createdBy: 'user-456',
          associatedNodeId: 'word-789',
          associatedNodeType: 'WordNode',
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });

    describe('buildUpdateQuery', () => {
      it('should build correct update query', () => {
        const updateData = { associatedNodeType: 'UpdatedType' };

        // Access protected method for testing
        const result = (discussionSchema as any).buildUpdateQuery(
          'discussion-123',
          updateData,
        );

        expect(result.cypher).toContain('MATCH (n:DiscussionNode {id: $id})');
        expect(result.cypher).toContain('SET');
        expect(result.cypher).toContain('n.updatedAt = datetime()');
        expect(result.params).toEqual({
          id: 'discussion-123',
          updateData,
        });
      });
    });
  });
});
