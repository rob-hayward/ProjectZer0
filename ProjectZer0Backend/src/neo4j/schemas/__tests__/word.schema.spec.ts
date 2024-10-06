// src/neo4j/schemas/__tests__/word.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { WordSchema } from '../word.schema';
import { Neo4jService } from '../../neo4j.service';
import { Record, Result } from 'neo4j-driver';

describe('WordSchema', () => {
  let wordSchema: WordSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
      ],
    }).compile();

    wordSchema = module.get<WordSchema>(WordSchema);
    neo4jService = module.get(Neo4jService);
  });

  describe('createWord', () => {
    it('should create a word with initial definition', async () => {
      const mockWord = {
        word: 'test',
        createdBy: 'user-id',
        initialDefinition: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockWord, positiveVotes: 0, negativeVotes: 0 },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.createWord(mockWord);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (w:WordNode {word: $word})'),
        mockWord,
      );
      expect(result).toEqual({
        ...mockWord,
        positiveVotes: 0,
        negativeVotes: 0,
      });
    });
  });

  describe('addDefinition', () => {
    it('should add a new definition to a word', async () => {
      const mockDefinition = {
        word: 'test',
        createdBy: 'user-id',
        definitionText: 'New definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.addDefinition(mockDefinition);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        mockDefinition,
      );
      expect(result).toEqual(mockDefinition);
    });
  });

  describe('getWord', () => {
    it('should return a word with its definitions when found', async () => {
      const mockWord = {
        word: 'test',
        createdBy: 'user-id',
        positiveVotes: 5,
        negativeVotes: 2,
      };
      const mockDefinitions = [
        { id: 'def1', text: 'Definition 1', votes: 3 },
        { id: 'def2', text: 'Definition 2', votes: 1 },
      ];

      const mockRecord = {
        get: jest.fn((key) => {
          if (key === 'w') return { properties: mockWord };
          if (key === 'definitions')
            return mockDefinitions.map((d) => ({ properties: d }));
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWord('test');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' },
      );
      expect(result).toEqual({
        ...mockWord,
        definitions: mockDefinitions,
      });
    });

    it('should return null when word is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWord('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateWord', () => {
    it('should update a word', async () => {
      const mockUpdatedWord = {
        word: 'test',
        liveDefinition: 'Updated definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.updateWord('test', {
        liveDefinition: 'Updated definition',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        expect.objectContaining({
          word: 'test',
          updateData: { liveDefinition: 'Updated definition' },
        }),
      );
      expect(result).toEqual(mockUpdatedWord);
    });
  });

  describe('deleteWord', () => {
    it('should delete a word', async () => {
      await wordSchema.deleteWord('test');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' },
      );
    });
  });

  describe('voteWord', () => {
    it('should vote on a word', async () => {
      const mockVotedWord = {
        word: 'test',
        positiveVotes: 6,
        negativeVotes: 2,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockVotedWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.voteWord('test', 'user-id', true);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        expect.objectContaining({
          word: 'test',
          userId: 'user-id',
          isPositive: true,
        }),
      );
      expect(result).toEqual(mockVotedWord);
    });
  });

  describe('getWordVotes', () => {
    it('should return vote counts for a word', async () => {
      const mockVotes = {
        positiveVotes: 6,
        negativeVotes: 2,
      };

      const mockRecord = {
        get: jest.fn((key) => mockVotes[key]),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWordVotes('test');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' },
      );
      expect(result).toEqual(mockVotes);
    });

    it('should return null when word is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWordVotes('non-existent');
      expect(result).toBeNull();
    });
  });
});
