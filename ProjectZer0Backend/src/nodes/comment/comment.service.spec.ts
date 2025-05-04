import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';
import { VisibilityService } from '../../users/visibility/visibility.service';
import { BadRequestException } from '@nestjs/common';

describe('CommentService', () => {
  let service: CommentService;
  let schema: jest.Mocked<CommentSchema>;
  let visibilityService: jest.Mocked<VisibilityService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: CommentSchema,
          useValue: {
            createComment: jest.fn(),
            getComment: jest.fn(),
            updateComment: jest.fn(),
            deleteComment: jest.fn(),
            getCommentsByDiscussionId: jest.fn(),
            getCommentsByDiscussionIdWithSorting: jest.fn(),
            setVisibilityStatus: jest.fn(),
            getVisibilityStatus: jest.fn(),
            voteComment: jest.fn(),
            getCommentVoteStatus: jest.fn(),
            removeCommentVote: jest.fn(),
            getCommentVotes: jest.fn(),
            updateVisibilityBasedOnVotes: jest.fn(),
          },
        },
        {
          provide: VisibilityService,
          useValue: {
            getObjectVisibility: jest.fn(),
            setObjectVisibility: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    schema = module.get(CommentSchema);
    visibilityService = module.get(VisibilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createComment', () => {
    it('should call schema.createComment with correct parameters', async () => {
      const commentData = {
        createdBy: 'user1',
        discussionId: 'discussion1',
        commentText: 'Test comment',
      };
      await service.createComment(commentData);
      expect(schema.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          ...commentData,
          id: expect.any(String),
        }),
      );
    });
  });

  describe('getComment', () => {
    it('should call schema.getComment with correct id', async () => {
      const id = 'comment1';
      schema.getComment.mockResolvedValue({ id, commentText: 'Test' });

      const result = await service.getComment(id);

      expect(schema.getComment).toHaveBeenCalledWith(id);
      expect(result).toEqual({ id, commentText: 'Test' });
    });

    it('should throw BadRequestException when id is empty', async () => {
      await expect(service.getComment('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCommentWithVisibility', () => {
    it('should return comment with visibility status', async () => {
      const comment = {
        id: 'comment1',
        commentText: 'Test',
        visibilityStatus: true,
      };
      const voteStatus = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      schema.getComment.mockResolvedValue(comment);
      schema.getCommentVotes.mockResolvedValue(voteStatus);
      visibilityService.getObjectVisibility.mockResolvedValue(true);

      const result = await service.getCommentWithVisibility(
        'comment1',
        'user1',
      );

      expect(schema.getComment).toHaveBeenCalledWith('comment1');
      expect(schema.getCommentVotes).toHaveBeenCalledWith('comment1');
      expect(visibilityService.getObjectVisibility).toHaveBeenCalledWith(
        'user1',
        'comment1',
        { netVotes: 3, isVisible: true },
      );
      expect(result).toEqual({
        ...comment,
        isVisible: true,
      });
    });

    it('should return null when comment not found', async () => {
      schema.getComment.mockResolvedValue(null);

      const result = await service.getCommentWithVisibility('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('setVisibilityStatus', () => {
    it('should call schema.setVisibilityStatus with correct parameters', async () => {
      const id = 'comment1';
      const isVisible = true;
      await service.setVisibilityStatus(id, isVisible);
      expect(schema.setVisibilityStatus).toHaveBeenCalledWith(id, isVisible);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should call schema.getVisibilityStatus with correct parameters', async () => {
      const id = 'comment1';
      await service.getVisibilityStatus(id);
      expect(schema.getVisibilityStatus).toHaveBeenCalledWith(id);
    });
  });

  describe('voteComment', () => {
    it('should vote and update visibility', async () => {
      const voteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
        userVote: true,
      };

      schema.voteComment.mockResolvedValue(voteResult);
      schema.updateVisibilityBasedOnVotes.mockResolvedValue(true);

      const result = await service.voteComment('comment1', 'user1', true);

      expect(schema.voteComment).toHaveBeenCalledWith(
        'comment1',
        'user1',
        true,
      );
      expect(schema.updateVisibilityBasedOnVotes).toHaveBeenCalledWith(
        'comment1',
        -5,
      );
      expect(result).toEqual(voteResult);
    });

    it('should throw BadRequestException when id is missing', async () => {
      await expect(service.voteComment('', 'user1', true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user id is missing', async () => {
      await expect(service.voteComment('comment1', '', true)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateCommentVisibilityBasedOnVotes', () => {
    it('should call schema.updateVisibilityBasedOnVotes with correct parameters', async () => {
      schema.updateVisibilityBasedOnVotes.mockResolvedValue(true);

      const result = await service.updateCommentVisibilityBasedOnVotes(
        'comment1',
        -3,
      );

      expect(schema.updateVisibilityBasedOnVotes).toHaveBeenCalledWith(
        'comment1',
        -3,
      );
      expect(result).toBe(true);
    });

    it('should use default threshold when not specified', async () => {
      schema.updateVisibilityBasedOnVotes.mockResolvedValue(false);

      await service.updateCommentVisibilityBasedOnVotes('comment1');

      expect(schema.updateVisibilityBasedOnVotes).toHaveBeenCalledWith(
        'comment1',
        -5,
      );
    });

    it('should throw BadRequestException when id is missing', async () => {
      await expect(
        service.updateCommentVisibilityBasedOnVotes(''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // Add more tests for other methods
});
