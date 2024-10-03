// src/neo4j/schemas/__tests__/discussion.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionSchema } from '../discussion.schema';
import { Neo4jService } from '../../neo4j.service';
import { Record, Result } from 'neo4j-driver';

describe('DiscussionSchema', () => {
  let discussionSchema: DiscussionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

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
      ],
    }).compile();

    discussionSchema = module.get<DiscussionSchema>(DiscussionSchema);
    neo4jService = module.get(Neo4jService);
  });

  describe('createDiscussion', () => {
    it('should create a discussion', async () => {
      const mockDiscussion = {
        id: 'test-id',
        createdBy: 'user-id',
        associatedNodeId: 'node-id',
        associatedNodeType: 'BeliefNode',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDiscussion }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await discussionSchema.createDiscussion(mockDiscussion);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (d:DiscussionNode'),
        mockDiscussion,
      );
      expect(result).toEqual(mockDiscussion);
    });
  });

  describe('getDiscussion', () => {
    it('should return a discussion when found', async () => {
      const mockDiscussion = {
        id: 'test-id',
        createdBy: 'user-id',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDiscussion }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await discussionSchema.getDiscussion('test-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DiscussionNode {id: $id})'),
        { id: 'test-id' },
      );
      expect(result).toEqual(mockDiscussion);
    });

    it('should return null when discussion is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await discussionSchema.getDiscussion('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateDiscussion', () => {
    it('should update a discussion', async () => {
      const mockUpdatedDiscussion = {
        id: 'test-id',
        updatedProperty: 'updated value',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedDiscussion }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await discussionSchema.updateDiscussion('test-id', {
        updatedProperty: 'updated value',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DiscussionNode {id: $id})'),
        expect.objectContaining({
          id: 'test-id',
          updateData: { updatedProperty: 'updated value' },
        }),
      );
      expect(result).toEqual(mockUpdatedDiscussion);
    });
  });

  describe('deleteDiscussion', () => {
    it('should delete a discussion', async () => {
      await discussionSchema.deleteDiscussion('test-id');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DiscussionNode {id: $id})'),
        { id: 'test-id' },
      );
    });
  });
});
