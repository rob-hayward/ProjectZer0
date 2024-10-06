// src/neo4j/schemas/__tests__/belief.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BeliefSchema } from '../belief.schema';
import { Neo4jService } from '../../neo4j.service';
import { Record, Result } from 'neo4j-driver';

describe('BeliefSchema', () => {
  let beliefSchema: BeliefSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeliefSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
      ],
    }).compile();

    beliefSchema = module.get<BeliefSchema>(BeliefSchema);
    neo4jService = module.get(Neo4jService);
  });

  describe('createBelief', () => {
    it('should create a belief with keywords and initial comment', async () => {
      const mockBelief = {
        id: 'test-id',
        createdBy: 'user-id',
        publicCredit: true,
        statement: 'Test belief',
        keywords: [
          { word: 'tag1', frequency: 2 },
          { word: 'tag2', frequency: 1 },
        ],
        initialComment: 'Initial comment',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockBelief }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await beliefSchema.createBelief(mockBelief);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (b:BeliefNode'),
        mockBelief,
      );
      expect(result).toEqual(mockBelief);
    });
  });

  describe('getBelief', () => {
    it('should return a belief with its keywords and related beliefs', async () => {
      const mockBelief = {
        id: 'test-id',
        statement: 'Test belief',
      };
      const mockKeywords = [
        { word: 'tag1', frequency: 2 },
        { word: 'tag2', frequency: 1 },
      ];
      const mockRelatedBeliefs = [
        { nodeId: 'related-1', sharedWord: 'tag1', strength: 2 },
        { nodeId: 'related-2', sharedWord: 'tag2', strength: 1 },
      ];

      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'b') return { properties: mockBelief };
          if (key === 'keywords') return mockKeywords;
          if (key === 'relatedBeliefs') return mockRelatedBeliefs;
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await beliefSchema.getBelief('test-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (b:BeliefNode {id: $id})'),
        { id: 'test-id' },
      );
      expect(result).toEqual({
        ...mockBelief,
        keywords: mockKeywords,
        relatedBeliefs: mockRelatedBeliefs,
      });
    });

    it('should return null when belief is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await beliefSchema.getBelief('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateBelief', () => {
    it('should update an existing belief', async () => {
      const mockUpdatedBelief = {
        id: 'test-id',
        statement: 'Updated belief',
        publicCredit: false,
        keywords: [
          { word: 'new-tag1', frequency: 3 },
          { word: 'new-tag2', frequency: 1 },
        ],
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedBelief }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await beliefSchema.updateBelief(
        'test-id',
        mockUpdatedBelief,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (b:BeliefNode {id: $id})'),
        expect.objectContaining({
          id: 'test-id',
          updateProperties: {
            statement: 'Updated belief',
            publicCredit: false,
          },
          keywords: [
            { word: 'new-tag1', frequency: 3 },
            { word: 'new-tag2', frequency: 1 },
          ],
        }),
      );
      expect(result).toEqual(mockUpdatedBelief);
    });
  });

  describe('deleteBelief', () => {
    it('should delete a belief and its relationships', async () => {
      await beliefSchema.deleteBelief('test-id');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (b:BeliefNode {id: $id})'),
        { id: 'test-id' },
      );
    });
  });
});
