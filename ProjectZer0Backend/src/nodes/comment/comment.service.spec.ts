import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { CommentSchema } from '../../neo4j/schemas/comment.schema';

describe('CommentService', () => {
  let service: CommentService;
  let schema: jest.Mocked<CommentSchema>;

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
          },
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    schema = module.get(CommentSchema);
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

  // Add more tests for other methods
});
