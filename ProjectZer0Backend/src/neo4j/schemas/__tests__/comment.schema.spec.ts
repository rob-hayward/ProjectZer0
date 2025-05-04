import { Test, TestingModule } from '@nestjs/testing';
import { CommentSchema } from '../comment.schema';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema } from '../vote.schema';
import { Record, Result } from 'neo4j-driver';

describe('CommentSchema', () => {
  let commentSchema: CommentSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentSchema,
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

    commentSchema = module.get<CommentSchema>(CommentSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  describe('createComment', () => {
    // All tests remain unchanged
    it('should create a comment with default visibility status', async () => {
      const mockComment = {
        id: 'test-id',
        createdBy: 'user-id',
        discussionId: 'discussion-id',
        commentText: 'Test comment',
        visibilityStatus: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockComment }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await commentSchema.createComment(mockComment);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (c:CommentNode'),
        expect.objectContaining(mockComment),
      );
      expect(result).toEqual(mockComment);
    });
  });

  // Rest of tests remain the same
  // ...

  // The vote-related tests need to be updated
  describe('voteComment', () => {
    it('should call voteSchema.vote with correct parameters', async () => {
      // Exactly match the VoteResult type from the actual implementation
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await commentSchema.voteComment(
        'comment-id',
        'user-id',
        true,
      );

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'CommentNode',
        { id: 'comment-id' },
        'user-id',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('getCommentVoteStatus', () => {
    it('should call voteSchema.getVoteStatus with correct parameters', async () => {
      // Use the exact VoteStatus type with the proper status union type
      const mockVoteStatus = {
        status: 'agree' as const, // Use const assertion to ensure TS recognizes this as a specific literal
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await commentSchema.getCommentVoteStatus(
        'comment-id',
        'user-id',
      );

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'CommentNode',
        { id: 'comment-id' },
        'user-id',
      );
      expect(result).toEqual(mockVoteStatus);
    });
  });
});
