import { Test, TestingModule } from '@nestjs/testing';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

describe('CommentController', () => {
  let controller: CommentController;
  let service: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: {
            createComment: jest.fn(),
            getComment: jest.fn(),
            updateComment: jest.fn(),
            deleteComment: jest.fn(),
            setVisibilityStatus: jest.fn(),
            getVisibilityStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CommentController>(CommentController);
    service = module.get<CommentService>(CommentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createComment', () => {
    it('should call service.createComment with correct parameters', async () => {
      const commentData = {
        createdBy: 'user1',
        discussionId: 'discussion1',
        commentText: 'Test comment',
      };
      await controller.createComment(commentData);
      expect(service.createComment).toHaveBeenCalledWith(commentData);
    });
  });

  describe('setVisibilityStatus', () => {
    it('should call service.setVisibilityStatus with correct parameters', async () => {
      const id = 'comment1';
      const visibilityData = { isVisible: true };
      await controller.setVisibilityStatus(id, visibilityData);
      expect(service.setVisibilityStatus).toHaveBeenCalledWith(id, true);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should call service.getVisibilityStatus with correct parameters', async () => {
      const id = 'comment1';
      await controller.getVisibilityStatus(id);
      expect(service.getVisibilityStatus).toHaveBeenCalledWith(id);
    });
  });

  // Add more tests for other methods
});
