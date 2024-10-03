// src/neo4j/schemas/__tests__/comment.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { CommentSchema } from '../comment.schema';
import { Neo4jService } from '../../neo4j.service';
import { Record, Result } from 'neo4j-driver';

describe('CommentSchema', () => {
  let commentSchema: CommentSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

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
      ],
    }).compile();

    commentSchema = module.get<CommentSchema>(CommentSchema);
    neo4jService = module.get(Neo4jService);
  });

  describe('createComment', () => {
    it('should create a comment', async () => {
      const mockComment = {
        id: 'test-id',
        createdBy: 'user-id',
        discussionId: 'discussion-id',
        commentText: 'Test comment',
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
        mockComment,
      );
      expect(result).toEqual(mockComment);
    });
  });

  describe('getComment', () => {
    it('should return a comment when found', async () => {
      const mockComment = {
        id: 'test-id',
        createdBy: 'user-id',
        commentText: 'Test comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockComment }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await commentSchema.getComment('test-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CommentNode {id: $id})'),
        { id: 'test-id' },
      );
      expect(result).toEqual(mockComment);
    });

    it('should return null when comment is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await commentSchema.getComment('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateComment', () => {
    it('should update a comment', async () => {
      const mockUpdatedComment = {
        id: 'test-id',
        commentText: 'Updated comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedComment }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await commentSchema.updateComment('test-id', {
        commentText: 'Updated comment',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CommentNode {id: $id})'),
        expect.objectContaining({
          id: 'test-id',
          updateData: { commentText: 'Updated comment' },
        }),
      );
      expect(result).toEqual(mockUpdatedComment);
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment', async () => {
      await commentSchema.deleteComment('test-id');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:CommentNode {id: $id})'),
        { id: 'test-id' },
      );
    });
  });
});
