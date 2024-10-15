import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';
import { CommentService } from '../comment/comment.service';

describe('DiscussionService', () => {
  let service: DiscussionService;
  let schema: jest.Mocked<DiscussionSchema>;
  let commentService: jest.Mocked<CommentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionService,
        {
          provide: DiscussionSchema,
          useValue: {
            createDiscussion: jest.fn(),
            getDiscussion: jest.fn(),
            updateDiscussion: jest.fn(),
            deleteDiscussion: jest.fn(),
            setVisibilityStatus: jest.fn(),
            getVisibilityStatus: jest.fn(),
          },
        },
        {
          provide: CommentService,
          useValue: {
            createComment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscussionService>(DiscussionService);
    schema = module.get(DiscussionSchema);
    commentService = module.get(CommentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDiscussion', () => {
    it('should call schema.createDiscussion with correct parameters', async () => {
      const discussionData = {
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
      };
      await service.createDiscussion(discussionData);
      expect(schema.createDiscussion).toHaveBeenCalledWith(
        expect.objectContaining({
          ...discussionData,
          id: expect.any(String),
        }),
      );
    });

    it('should create an initial comment if provided', async () => {
      const discussionData = {
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
        initialComment: 'Initial comment',
      };
      const mockDiscussion = { id: 'discussion1', ...discussionData };
      schema.createDiscussion.mockResolvedValue(mockDiscussion);

      await service.createDiscussion(discussionData);

      expect(schema.createDiscussion).toHaveBeenCalledWith(
        expect.objectContaining({
          ...discussionData,
          id: expect.any(String),
        }),
      );
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: discussionData.createdBy,
        discussionId: mockDiscussion.id,
        commentText: discussionData.initialComment,
      });
    });
  });

  describe('getDiscussion', () => {
    it('should call schema.getDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      await service.getDiscussion(id);
      expect(schema.getDiscussion).toHaveBeenCalledWith(id);
    });
  });

  describe('updateDiscussion', () => {
    it('should call schema.updateDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      const updateData = { someField: 'newValue' };
      await service.updateDiscussion(id, updateData);
      expect(schema.updateDiscussion).toHaveBeenCalledWith(id, updateData);
    });
  });

  describe('deleteDiscussion', () => {
    it('should call schema.deleteDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      await service.deleteDiscussion(id);
      expect(schema.deleteDiscussion).toHaveBeenCalledWith(id);
    });
  });

  describe('setVisibilityStatus', () => {
    it('should call schema.setVisibilityStatus with correct parameters', async () => {
      const id = 'discussion1';
      const isVisible = true;
      await service.setVisibilityStatus(id, isVisible);
      expect(schema.setVisibilityStatus).toHaveBeenCalledWith(id, isVisible);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should call schema.getVisibilityStatus with correct parameters', async () => {
      const id = 'discussion1';
      await service.getVisibilityStatus(id);
      expect(schema.getVisibilityStatus).toHaveBeenCalledWith(id);
    });
  });
});
