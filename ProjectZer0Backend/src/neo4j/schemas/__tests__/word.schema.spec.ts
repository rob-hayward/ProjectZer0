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

    it('should handle check existence errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      await expect(wordSchema.checkWordExistence('test')).rejects.toThrow(
        'Failed to check if word exists: Database error',
      );
    });
  });

  describe('createWord', () => {
    it('should create a word with initial definition', async () => {
      const mockWord = {
        word: 'test',
        createdBy: 'user-id',
        initialDefinition: 'Test definition',
        publicCredit: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: {
            ...mockWord,
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
          },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.createWord(mockWord);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (w:WordNode'),
        expect.objectContaining({
          word: 'test',
          createdBy: 'user-id',
          initialDefinition: 'Test definition',
          publicCredit: true,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should create an API word without user relationship', async () => {
      const apiWordData = {
        word: 'api-word',
        createdBy: 'FreeDictionaryAPI',
        initialDefinition: 'API definition',
        publicCredit: false,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: apiWordData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await wordSchema.createWord(apiWordData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining("WHERE userId <> 'FreeDictionaryAPI'"),
        expect.objectContaining(apiWordData),
      );
      expect(result).toBeDefined();
    });

    it('should standardize word case during creation', async () => {
      const mockWord = {
        word: 'TeSt',
        createdBy: 'user-id',
        initialDefinition: 'Test definition',
        publicCredit: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await wordSchema.createWord(mockWord);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          word: 'test', // Should be standardized to lowercase
        }),
      );
    });

    it('should handle word creation errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Creation failed'));

      await expect(
        wordSchema.createWord({
          word: 'test',
          createdBy: 'user-id',
          initialDefinition: 'Test definition',
          publicCredit: true,
        }),
      ).rejects.toThrow('Failed to create word: Creation failed');
    });
  });

  describe('getWord', () => {
    it('should return a word with definitions when found', async () => {
      const mockWord = {
        word: 'test',
        createdBy: 'user-id',
        inclusionPositiveVotes: 5,
        inclusionNegativeVotes: 1,
        inclusionNetVotes: 4,
      };

      const mockDefinitions = [
        { id: 'def-1', definitionText: 'First definition' },
        { id: 'def-2', definitionText: 'Second definition' },
      ];

      const mockRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'w') return { properties: mockWord };
          if (key === 'definitions')
            return mockDefinitions.map((d) => ({ properties: d }));
          if (key === 'disc') return { properties: { id: 'disc1' } };
          return null;
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await wordSchema.getWord('test');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode)'),
        { word: 'test' },
      );
      expect(result).toEqual({
        ...mockWord,
        definitions: mockDefinitions,
        discussionId: 'disc1',
      });
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
        'Failed to get word: Query failed',
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
        ).rejects.toThrow('Failed to vote on word: Vote failed');
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
        ).rejects.toThrow('Failed to get word vote status: Vote status failed');
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
        ).rejects.toThrow('Failed to remove word vote: Remove failed');
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
        expect(result).toEqual(mockVoteResult);
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
          id: 'word1',
          visibilityStatus: false,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockUpdatedWord }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await wordSchema.setVisibilityStatus('word1', false);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {id: $wordId})'),
          { wordId: 'word1', isVisible: false },
        );
        expect(result).toEqual(mockUpdatedWord);
      });

      it('should handle visibility setting errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('Visibility update failed'),
        );

        await expect(
          wordSchema.setVisibilityStatus('word1', true),
        ).rejects.toThrow(
          'Failed to set word visibility status: Visibility update failed',
        );
      });
    });

    describe('getVisibilityStatus', () => {
      it('should return visibility status when it exists', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(false) }],
        } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getVisibilityStatus('word1');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {id: $wordId})'),
          { wordId: 'word1' },
        );
        expect(result).toBe(false);
      });

      it('should return true when visibility status does not exist', async () => {
        const mockResult = {
          records: [{ get: jest.fn().mockReturnValue(null) }],
        } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getVisibilityStatus('word1');

        expect(result).toBe(true);
      });

      it('should handle visibility retrieval errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Visibility query failed'),
        );

        await expect(wordSchema.getVisibilityStatus('word1')).rejects.toThrow(
          'Failed to get word visibility status: Visibility query failed',
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
    it('should handle Neo4j Integer conversion in vote results', async () => {
      const voteResultWithIntegers = {
        inclusionPositiveVotes: Integer.fromNumber(6),
        inclusionNegativeVotes: Integer.fromNumber(2),
        inclusionNetVotes: Integer.fromNumber(4),
        contentPositiveVotes: Integer.fromNumber(0),
        contentNegativeVotes: Integer.fromNumber(0),
        contentNetVotes: Integer.fromNumber(0),
      };

      voteSchema.vote.mockResolvedValue(voteResultWithIntegers as any);

      const result = await wordSchema.voteWordInclusion(
        'test',
        'user-id',
        true,
      );

      expect(result).toEqual(voteResultWithIntegers);
    });

    it('should handle concurrent voting scenarios', async () => {
      voteSchema.vote
        .mockResolvedValueOnce(mockVoteResult)
        .mockResolvedValueOnce({
          ...mockVoteResult,
          inclusionPositiveVotes: 7,
          inclusionNetVotes: 5,
        });

      const result1 = await wordSchema.voteWordInclusion('test', 'user1', true);
      const result2 = await wordSchema.voteWordInclusion('test', 'user2', true);

      expect(result1.inclusionPositiveVotes).toBe(6);
      expect(result2.inclusionPositiveVotes).toBe(7);
    });

    it('should handle very large vote counts', async () => {
      const largeVoteResult = {
        inclusionPositiveVotes: 999999,
        inclusionNegativeVotes: 100000,
        inclusionNetVotes: 899999,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      voteSchema.vote.mockResolvedValue(largeVoteResult);

      const result = await wordSchema.voteWordInclusion(
        'test',
        'user-id',
        true,
      );

      expect(result).toEqual(largeVoteResult);
    });

    it('should handle special characters in word standardization', async () => {
      const specialWord = {
        word: 'Café-Résumé',
        createdBy: 'user-id',
        initialDefinition: 'Test definition',
        publicCredit: true,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: specialWord }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await wordSchema.createWord(specialWord);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          word: 'café-résumé', // Should be standardized to lowercase
        }),
      );
    });
  });
});
