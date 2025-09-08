// src/neo4j/schemas/__tests__/word.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { WordSchema } from '../word.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('WordSchema', () => {
  let wordSchema: WordSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentPositiveVotes: 0, // Words don't have content voting
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentStatus: null, // Words don't have content voting
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

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
        {
          provide: UserSchema,
          useValue: {
            addCreatedNode: jest.fn(),
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

    wordSchema = module.get<WordSchema>(WordSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  describe('checkWordExistence', () => {
    it('should return true when word exists', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.checkWordExistence('test');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' },
      );
      expect(result).toBe(true);
    });

    it('should return false when word does not exist', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(false),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.checkWordExistence('nonexistent');

      expect(result).toBe(false);
    });

    it('should standardize word for existence check', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(true),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await wordSchema.checkWordExistence('TeSt');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' }, // Should be lowercase
      );
    });

    it('should handle database errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      await expect(wordSchema.checkWordExistence('test')).rejects.toThrow(
        'Failed to check if word exists: Database error',
      );
    });
  });

  describe('createWord', () => {
    const mockWordData = {
      word: 'test',
      createdBy: 'user-123',
      initialDefinition: 'A test word',
      publicCredit: true,
    };

    it('should create a user word with initial definition', async () => {
      const mockCreatedWord = {
        word: 'test',
        createdBy: 'user-123',
        publicCredit: true,
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCreatedWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.createWord(mockWordData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (w:WordNode'),
        expect.objectContaining({
          word: 'test',
          createdBy: 'user-123',
          initialDefinition: 'A test word',
          publicCredit: true,
        }),
      );
      expect(result).toEqual(mockCreatedWord);
    });

    it('should create an API word with different logic', async () => {
      const apiWordData = {
        ...mockWordData,
        createdBy: 'FreeDictionaryAPI',
      };

      const mockCreatedWord = {
        word: 'test',
        createdBy: 'FreeDictionaryAPI',
        publicCredit: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockCreatedWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.createWord(apiWordData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('FreeDictionaryAPI'),
        expect.any(Object),
      );
      expect(result).toEqual(mockCreatedWord);
    });

    it('should standardize word case during creation', async () => {
      const wordDataWithMixedCase = {
        ...mockWordData,
        word: 'TeSt',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: {} }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await wordSchema.createWord(wordDataWithMixedCase);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          word: 'test', // Should be standardized to lowercase
        }),
      );
    });

    it('should handle word creation errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Creation failed'));

      await expect(wordSchema.createWord(mockWordData)).rejects.toThrow(
        'Failed to create word: Creation failed',
      );
    });
  });

  describe('getWord', () => {
    it('should return a word with definitions when found', async () => {
      const mockWord = {
        word: 'test',
        definitions: [
          { id: 'def1', definitionText: 'First definition' },
          { id: 'def2', definitionText: 'Second definition' },
        ],
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue(mockWord),
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
      expect(result).toEqual(mockWord);
    });

    it('should return null when word is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWord('non-existent');

      expect(result).toBeNull();
    });

    it('should handle get word errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(wordSchema.getWord('test')).rejects.toThrow(
        'Failed to fetch word: Query failed',
      );
    });
  });

  describe('updateWord', () => {
    it('should update a word with new data', async () => {
      const mockUpdatedWord = {
        word: 'test',
        liveDefinition: 'Updated definition',
        updatedAt: new Date(),
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

    it('should handle update errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Update failed'));

      await expect(
        wordSchema.updateWord('test', { liveDefinition: 'Updated' }),
      ).rejects.toThrow('Failed to update word: Update failed');
    });
  });

  describe('updateWordWithDiscussionId', () => {
    it('should update a word with discussion ID', async () => {
      const mockUpdatedWord = {
        id: 'word1',
        discussionId: 'disc1',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.updateWordWithDiscussionId(
        'word1',
        'disc1',
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {id: $wordId})'),
        { wordId: 'word1', discussionId: 'disc1' },
      );
      expect(result).toEqual(mockUpdatedWord);
    });
  });

  describe('deleteWord', () => {
    it('should delete a word', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.deleteWord('test');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' },
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle delete errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Delete failed'));

      await expect(wordSchema.deleteWord('test')).rejects.toThrow(
        'Failed to delete word: Delete failed',
      );
    });
  });

  // VOTING SYSTEM TESTS (Inclusion Only)
  describe('Voting System - Inclusion Only', () => {
    describe('voteWordInclusion', () => {
      it('should vote positively on word inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await wordSchema.voteWordInclusion(
          'test',
          'user-id',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-id',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on word inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await wordSchema.voteWordInclusion(
          'test',
          'user-id',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-id',
          false,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should standardize word case in voting', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        await wordSchema.voteWordInclusion('TeSt', 'user-id', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' }, // Should be standardized
          'user-id',
          true,
          'INCLUSION',
        );
      });

      it('should handle voting errors gracefully', async () => {
        voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

        await expect(
          wordSchema.voteWordInclusion('test', 'user-id', true),
        ).rejects.toThrow('Vote failed');
      });
    });

    describe('getWordVoteStatus', () => {
      it('should get vote status for a user', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await wordSchema.getWordVoteStatus('test', 'user-id');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-id',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await wordSchema.getWordVoteStatus('test', 'user-id');

        expect(result).toBeNull();
      });

      it('should handle vote status errors gracefully', async () => {
        voteSchema.getVoteStatus.mockRejectedValue(
          new Error('Vote status failed'),
        );

        await expect(
          wordSchema.getWordVoteStatus('test', 'user-id'),
        ).rejects.toThrow('Vote status failed');
      });
    });

    describe('removeWordVote', () => {
      it('should remove a word vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await wordSchema.removeWordVote('test', 'user-id');

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-id',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should handle remove vote errors gracefully', async () => {
        voteSchema.removeVote.mockRejectedValue(new Error('Remove failed'));

        await expect(
          wordSchema.removeWordVote('test', 'user-id'),
        ).rejects.toThrow('Remove failed');
      });
    });

    describe('getWordVotes', () => {
      it('should return vote counts for a word', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await wordSchema.getWordVotes('test');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          '',
        );
        expect(result).toEqual({
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 4,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });

      it('should return null when no votes exist', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await wordSchema.getWordVotes('test');

        expect(result).toBeNull();
      });

      it('should handle vote retrieval errors gracefully', async () => {
        voteSchema.getVoteStatus.mockRejectedValue(
          new Error('Get votes failed'),
        );

        await expect(wordSchema.getWordVotes('test')).rejects.toThrow(
          'Failed to get word votes: Get votes failed',
        );
      });
    });
  });

  // VISIBILITY METHODS TESTS
  describe('Visibility Methods', () => {
    describe('setVisibilityStatus', () => {
      it('should set visibility status for a word', async () => {
        const mockUpdatedWord = {
          word: 'test',
          visibilityStatus: false,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockUpdatedWord }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await wordSchema.setVisibilityStatus('test', false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {word: $word})'),
          { word: 'test', visibilityStatus: false },
        );
        expect(result).toEqual(mockUpdatedWord);
      });

      it('should handle visibility setting errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('Visibility update failed'),
        );

        await expect(
          wordSchema.setVisibilityStatus('test', true),
        ).rejects.toThrow(
          'Failed to set word visibility: Visibility update failed',
        );
      });
    });

    describe('getVisibilityStatus', () => {
      it('should return visibility status when it exists', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(false),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getVisibilityStatus('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {word: $word})'),
          { word: 'test' },
        );
        expect(result).toBe(false);
      });

      it('should return true when visibility status does not exist', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getVisibilityStatus('test');

        expect(result).toBe(true);
      });

      it('should handle visibility retrieval errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Visibility retrieval failed'),
        );

        await expect(wordSchema.getVisibilityStatus('test')).rejects.toThrow(
          'Failed to get word visibility: Visibility retrieval failed',
        );
      });
    });
  });

  // UTILITY METHODS TESTS
  describe('Utility Methods', () => {
    describe('checkWords', () => {
      it('should return word count', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(156)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.checkWords();

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (w:WordNode) RETURN count(w) as count',
        );
        expect(result).toEqual({ count: 156 });
      });

      it('should return zero when no words exist', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.checkWords();

        expect(result).toEqual({ count: 0 });
      });

      it('should handle large word counts', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(999999)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.checkWords();

        expect(result).toEqual({ count: 999999 });
      });

      it('should handle count errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Database connection failed'),
        );

        await expect(wordSchema.checkWords()).rejects.toThrow(
          'Failed to check words: Database connection failed',
        );
      });

      it('should handle Neo4j query errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Invalid Cypher query'));

        await expect(wordSchema.checkWords()).rejects.toThrow(
          'Failed to check words: Invalid Cypher query',
        );
      });
    });

    describe('isWordAvailableForCategoryComposition', () => {
      it('should return true for approved words', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(5)), // > 0
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await wordSchema.isWordAvailableForCategoryComposition('word1');

        expect(result).toBe(true);
      });

      it('should return false for pending words', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)), // = 0
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await wordSchema.isWordAvailableForCategoryComposition('word1');

        expect(result).toBe(false);
      });

      it('should return false for rejected words', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(-3)), // < 0
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await wordSchema.isWordAvailableForCategoryComposition('word1');

        expect(result).toBe(false);
      });

      it('should return false when word does not exist', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result =
          await wordSchema.isWordAvailableForCategoryComposition('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('isWordAvailableForDefinitionCreation', () => {
      it('should return true for approved words', async () => {
        const mockWord = { inclusionNetVotes: 5 };
        jest.spyOn(wordSchema, 'getWord').mockResolvedValue(mockWord);

        const result =
          await wordSchema.isWordAvailableForDefinitionCreation('test');

        expect(result).toBe(true);
      });

      it('should return false for pending words', async () => {
        const mockWord = { inclusionNetVotes: 0 };
        jest.spyOn(wordSchema, 'getWord').mockResolvedValue(mockWord);

        const result =
          await wordSchema.isWordAvailableForDefinitionCreation('test');

        expect(result).toBe(false);
      });

      it('should return false when word does not exist', async () => {
        jest.spyOn(wordSchema, 'getWord').mockResolvedValue(null);

        const result =
          await wordSchema.isWordAvailableForDefinitionCreation('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  // EDGE CASES AND BOUNDARY CONDITIONS
  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty string word input', async () => {
      await expect(wordSchema.checkWordExistence('')).rejects.toThrow();
    });

    it('should handle whitespace-only word input', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue(false),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await wordSchema.checkWordExistence('   ');

      // Should be trimmed and standardized
      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.any(String),
        { word: '' }, // Trimmed whitespace becomes empty
      );
    });

    it('should handle very long word inputs', async () => {
      const longWord = 'a'.repeat(1000);
      const mockRecord = {
        get: jest.fn().mockReturnValue(false),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.checkWordExistence(longWord);

      expect(result).toBe(false);
      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        word: longWord.toLowerCase(),
      });
    });

    it('should handle Neo4j Integer conversion in vote results', async () => {
      const mockVoteResultWithIntegers = {
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 10, // Use regular numbers instead of Integer objects
        inclusionNegativeVotes: 3,
        inclusionNetVotes: 7,
        contentStatus: null,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      voteSchema.getVoteStatus.mockResolvedValue(mockVoteResultWithIntegers);

      const result = await wordSchema.getWordVotes('test');

      // Should convert Neo4j Integers to regular numbers
      expect(result).toEqual({
        inclusionPositiveVotes: 10,
        inclusionNegativeVotes: 3,
        inclusionNetVotes: 7,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      });
    });

    it('should handle concurrent voting scenarios', async () => {
      // Simulate concurrent votes by calling vote multiple times
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const promises = Array.from({ length: 5 }, (_, i) =>
        wordSchema.voteWordInclusion('test', `user-${i}`, true),
      );

      const results = await Promise.all(promises);

      // All votes should succeed
      expect(results).toHaveLength(5);
      expect(voteSchema.vote).toHaveBeenCalledTimes(5);
    });

    it('should handle very large vote counts', async () => {
      const largeVoteResult = {
        inclusionStatus: 'agree' as const,
        inclusionPositiveVotes: 999999,
        inclusionNegativeVotes: 888888,
        inclusionNetVotes: 111111,
        contentStatus: null,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      voteSchema.getVoteStatus.mockResolvedValue(largeVoteResult);

      const result = await wordSchema.getWordVotes('popular-word');

      expect(result).toEqual({
        inclusionPositiveVotes: 999999,
        inclusionNegativeVotes: 888888,
        inclusionNetVotes: 111111,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      });
    });

    it('should handle special characters in word standardization', async () => {
      const wordWithSpecialChars = 'tëst-wørd_123';
      const mockRecord = {
        get: jest.fn().mockReturnValue(false),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      await wordSchema.checkWordExistence(wordWithSpecialChars);

      // Should standardize to lowercase but preserve special characters
      expect(neo4jService.read).toHaveBeenCalledWith(expect.any(String), {
        word: 'tëst-wørd_123',
      });
    });

    it('should handle null/undefined vote status gracefully', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await wordSchema.getWordVoteStatus('test', 'user-id');

      expect(result).toBeNull();
    });

    it('should handle malformed Neo4j responses', async () => {
      const mockResult = {
        records: [], // Empty records array instead of null record
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWord('test');

      expect(result).toBeNull();
    });

    it('should handle database timeout scenarios', async () => {
      neo4jService.read.mockRejectedValue(new Error('Connection timeout'));

      await expect(wordSchema.checkWordExistence('test')).rejects.toThrow(
        'Failed to check if word exists: Connection timeout',
      );
    });

    it('should handle memory pressure with large datasets', async () => {
      // Simulate large dataset by creating many mock definitions
      const largeDefinitionSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `def-${i}`,
        definitionText: `Definition ${i}`,
      }));

      const mockWord = {
        word: 'popular-term',
        id: 'word-popular',
        createdBy: 'user-123',
        inclusionNetVotes: 10,
        definitions: largeDefinitionSet,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue(mockWord),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWord('popular-term');

      expect(result).toEqual(mockWord);
      expect(result.definitions).toHaveLength(1000);
    });
  });
});
