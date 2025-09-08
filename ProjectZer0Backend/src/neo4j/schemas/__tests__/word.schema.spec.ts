// src/neo4j/schemas/__tests__/word.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { WordSchema } from '../word.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException } from '@nestjs/common';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('WordSchema with BaseNodeSchema', () => {
  let wordSchema: WordSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;
  let userSchema: jest.Mocked<UserSchema>;

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
    userSchema = module.get(UserSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // INHERITED BASE FUNCTIONALITY TESTS
  describe('Inherited Base Functionality', () => {
    describe('findById (inherited)', () => {
      it('should find word by word identifier using inherited method', async () => {
        const mockWordData = {
          word: 'test',
          createdBy: 'user-123',
          publicCredit: true,
          inclusionPositiveVotes: Integer.fromNumber(5),
          inclusionNegativeVotes: Integer.fromNumber(2),
          inclusionNetVotes: Integer.fromNumber(3),
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockWordData }),
        } as unknown as Record;
        const mockResult = { records: [mockRecord] } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.findById('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:WordNode {word: $id}) RETURN n',
          { id: 'test' },
        );
        expect(result?.word).toBe('test');
        expect(result?.inclusionPositiveVotes).toBe(5); // Neo4j Integer converted
      });

      it('should return null when word not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('voteInclusion (inherited)', () => {
      it('should vote on word inclusion using inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await wordSchema.voteInclusion('test', 'user-456', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should standardize word case in voting through inherited method', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        await wordSchema.voteInclusion('TeSt', 'user-456', true);

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' }, // Should be standardized by overridden voteInclusion method
          'user-456',
          true,
          'INCLUSION',
        );
      });

      it('should validate inputs using inherited validation', async () => {
        await expect(
          wordSchema.voteInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        await expect(
          wordSchema.voteInclusion('test', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('voteContent (inherited) - Should Reject', () => {
      it('should throw BadRequestException when trying to vote on content', async () => {
        await expect(
          wordSchema.voteContent('test', 'user-456', true),
        ).rejects.toThrow('Word does not support content voting');
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });
    });

    describe('getVoteStatus (inherited)', () => {
      it('should get vote status using inherited method', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await wordSchema.getVoteStatus('test', 'user-456');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });
    });

    describe('removeVote (inherited)', () => {
      it('should remove inclusion vote using inherited method', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await wordSchema.removeVote(
          'test',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });
    });

    describe('getVotes (inherited)', () => {
      it('should get aggregated votes with content votes zero for words', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await wordSchema.getVotes('test');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'WordNode',
          { word: 'test' },
          '',
        );
        expect(result).toEqual({
          inclusionPositiveVotes: 6,
          inclusionNegativeVotes: 2,
          inclusionNetVotes: 4,
          contentPositiveVotes: 0, // Always 0 for words
          contentNegativeVotes: 0,
          contentNetVotes: 0,
        });
      });
    });

    describe('update (inherited)', () => {
      it('should update word using inherited method', async () => {
        const updateData = { publicCredit: false };
        const mockUpdatedData = {
          word: 'test',
          publicCredit: false,
          updatedAt: new Date(),
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockUpdatedData }),
        } as unknown as Record;
        const mockResult = { records: [mockRecord] } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await wordSchema.update('test', updateData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (n:WordNode {word: $id})'),
          expect.objectContaining({ id: 'test', updateData }),
        );
        expect(result?.publicCredit).toBe(false);
      });
    });

    describe('delete (inherited)', () => {
      it('should delete word using inherited method', async () => {
        // Mock existence check
        const existsRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(1)),
        } as unknown as Record;
        neo4jService.read.mockResolvedValue({
          records: [existsRecord],
        } as unknown as Result);

        neo4jService.write.mockResolvedValue({} as Result);

        const result = await wordSchema.delete('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (n:WordNode {word: $id}) RETURN COUNT(n) as count',
          { id: 'test' },
        );
        expect(neo4jService.write).toHaveBeenCalledWith(
          'MATCH (n:WordNode {word: $id}) DETACH DELETE n',
          { id: 'test' },
        );
        expect(result).toEqual({ success: true });
      });
    });
  });

  // WORD-SPECIFIC FUNCTIONALITY TESTS
  describe('Word-Specific Functionality', () => {
    describe('standardizeWord', () => {
      it('should standardize words correctly', () => {
        // Access private method for testing
        const result = (wordSchema as any).standardizeWord('  TeSt  ');
        expect(result).toBe('test');
      });
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

      it('should handle database errors gracefully with standardized error', async () => {
        neo4jService.read.mockRejectedValue(new Error('Database error'));

        await expect(wordSchema.checkWordExistence('test')).rejects.toThrow(
          'Failed to check if word exists Word: Database error',
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

        const mockCreatedDefinition = {
          id: 'def-123',
          definitionText: 'A test word',
          createdBy: 'user-123',
        };

        const mockRecord = {
          get: jest.fn().mockImplementation((key) => {
            if (key === 'w') return { properties: mockCreatedWord };
            if (key === 'd') return { properties: mockCreatedDefinition };
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);
        userSchema.addCreatedNode.mockResolvedValue(undefined);

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
        expect(userSchema.addCreatedNode).toHaveBeenCalledTimes(2);
        expect(result.word).toEqual(mockCreatedWord);
        expect(result.definition).toEqual(mockCreatedDefinition);
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
          get: jest.fn().mockImplementation((key) => {
            if (key === 'w') return { properties: mockCreatedWord };
            if (key === 'd') return { properties: {} };
          }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        await wordSchema.createWord(apiWordData);

        // Should not call addCreatedNode for API words
        expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      });

      it('should handle creation errors gracefully with standardized error', async () => {
        neo4jService.write.mockRejectedValue(new Error('Creation failed'));

        await expect(wordSchema.createWord(mockWordData)).rejects.toThrow(
          'Failed to create word Word: Creation failed',
        );
      });
    });

    describe('addDefinition', () => {
      const mockDefinitionData = {
        word: 'test',
        createdBy: 'user-123',
        definition: 'A new definition',
        publicCredit: true,
      };

      it('should add definition to existing word', async () => {
        const mockCreatedDefinition = {
          id: 'def-456',
          definition: 'A new definition',
          createdBy: 'user-123',
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockCreatedDefinition }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);
        userSchema.addCreatedNode.mockResolvedValue(undefined);

        const result = await wordSchema.addDefinition(mockDefinitionData);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {word: $word})'),
          expect.objectContaining({
            word: 'test',
            definition: 'A new definition',
            createdBy: 'user-123',
            publicCredit: true,
          }),
        );
        expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
          'user-123',
          'def-456',
          'definition',
        );
        expect(result).toEqual(mockCreatedDefinition);
      });

      it('should handle add definition errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(new Error('Add failed'));

        await expect(
          wordSchema.addDefinition(mockDefinitionData),
        ).rejects.toThrow('Failed to add definition to word Word: Add failed');
      });
    });

    describe('getWord', () => {
      it('should retrieve word with definitions and discussion', async () => {
        const mockWordNode = {
          word: 'test',
          createdBy: 'user-123',
          inclusionPositiveVotes: Integer.fromNumber(5),
          inclusionNegativeVotes: Integer.fromNumber(2),
          inclusionNetVotes: Integer.fromNumber(3),
        };

        const mockDefinitions = [
          { properties: { id: 'def-1', definitionText: 'First definition' } },
          { properties: { id: 'def-2', definitionText: 'Second definition' } },
        ];

        const mockDiscussion = {
          properties: { id: 'disc-123' },
        };

        const mockRecord = {
          get: jest.fn().mockImplementation((key) => {
            if (key === 'w') return { properties: mockWordNode };
            if (key === 'definitions') return mockDefinitions;
            if (key === 'disc') return mockDiscussion;
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
        expect(result?.word).toBe('test');
        expect(result?.definitions).toHaveLength(2);
        expect(result?.discussionId).toBe('disc-123');
        expect(result?.inclusionPositiveVotes).toBe(5); // Neo4j Integer converted
      });

      it('should return null when word not found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getWord('nonexistent');

        expect(result).toBeNull();
      });

      it('should handle fetch errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Fetch failed'));

        await expect(wordSchema.getWord('test')).rejects.toThrow(
          'Failed to fetch word Word: Fetch failed',
        );
      });
    });

    describe('getAllWords', () => {
      it('should retrieve all words with definitions', async () => {
        const mockWords = [
          {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'w')
                return {
                  properties: {
                    word: 'test1',
                    inclusionPositiveVotes: Integer.fromNumber(5),
                  },
                };
              if (key === 'definitions') return [];
              if (key === 'disc') return null;
            }),
          },
          {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'w')
                return {
                  properties: {
                    word: 'test2',
                    inclusionPositiveVotes: Integer.fromNumber(3),
                  },
                };
              if (key === 'definitions') return [];
              if (key === 'disc') return null;
            }),
          },
        ] as unknown as Record[];

        const mockResult = { records: mockWords } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getAllWords();

        expect(result).toHaveLength(2);
        expect(result[0].word).toBe('test1');
        expect(result[1].word).toBe('test2');
      });
    });

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

      it('should handle count errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Database connection failed'),
        );

        await expect(wordSchema.checkWords()).rejects.toThrow(
          'Failed to check words Word: Database connection failed',
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

    describe('getApprovedWords', () => {
      it('should return approved words with default sorting', async () => {
        const mockWords = [
          {
            get: jest.fn().mockReturnValue({
              properties: {
                word: 'approved1',
                inclusionNetVotes: Integer.fromNumber(5),
              },
            }),
          },
          {
            get: jest.fn().mockReturnValue({
              properties: {
                word: 'approved2',
                inclusionNetVotes: Integer.fromNumber(3),
              },
            }),
          },
        ] as unknown as Record[];

        const mockResult = { records: mockWords } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await wordSchema.getApprovedWords();

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('WHERE w.inclusionNetVotes > 0'),
          { limit: 100, offset: 0 },
        );
        expect(result).toHaveLength(2);
        expect(result[0].word).toBe('approved1');
        expect(result[0].inclusionNetVotes).toBe(5);
      });

      it('should handle custom sorting and pagination', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        await wordSchema.getApprovedWords({
          limit: 50,
          offset: 20,
          sortBy: 'votes',
          sortDirection: 'desc',
        });

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY w.inclusionNetVotes DESC'),
          { limit: 50, offset: 20 },
        );
      });
    });
  });

  // VISIBILITY INTEGRATION TESTS - ❌ REMOVED METHODS
  describe('Visibility Integration - Removed Methods', () => {
    it('should not have setVisibilityStatus method (delegated to VisibilityService)', () => {
      expect((wordSchema as any).setVisibilityStatus).toBeUndefined();
    });

    it('should not have getVisibilityStatus method (delegated to VisibilityService)', () => {
      expect((wordSchema as any).getVisibilityStatus).toBeUndefined();
    });

    // Note: Visibility will now be handled by VisibilityService in the service layer
    // WordService will integrate with VisibilityService for user visibility preferences
  });

  // ERROR HANDLING CONSISTENCY TESTS
  describe('Error Handling Consistency', () => {
    it('should use standardized error messages from BaseNodeSchema', async () => {
      neo4jService.read.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(wordSchema.findById('test')).rejects.toThrow(
        'Failed to find Word: Database connection failed',
      );
    });

    it('should use standardized error format for word-specific methods', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query timeout'));

      await expect(wordSchema.checkWordExistence('test')).rejects.toThrow(
        'Failed to check if word exists Word: Query timeout',
      );
    });
  });

  // INTEGRATION LIFECYCLE TESTS
  describe('Integration Lifecycle Tests', () => {
    it('should handle complete word lifecycle with inherited and custom methods', async () => {
      // 1. Check existence (custom method)
      const existsRecord = {
        get: jest.fn().mockReturnValue(false),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [existsRecord],
      } as unknown as Result);

      const exists = await wordSchema.checkWordExistence('newword');
      expect(exists).toBe(false);

      // 2. Create word (custom method)
      const createRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'w') return { properties: { word: 'newword' } };
          if (key === 'd') return { properties: { id: 'def-1' } };
        }),
      } as unknown as Record;
      neo4jService.write.mockResolvedValueOnce({
        records: [createRecord],
      } as unknown as Result);

      await wordSchema.createWord({
        word: 'newword',
        createdBy: 'user-123',
        initialDefinition: 'A new word',
        publicCredit: true,
      });

      // 3. Vote on inclusion (inherited method)
      voteSchema.vote.mockResolvedValue(mockVoteResult);
      const voteResult = await wordSchema.voteInclusion(
        'newword',
        'user-456',
        true,
      );
      expect(voteResult).toEqual(mockVoteResult);

      // 4. Get vote status (inherited method)
      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);
      const voteStatus = await wordSchema.getVoteStatus('newword', 'user-456');
      expect(voteStatus).toEqual(mockVoteStatus);

      // 5. Retrieve word (custom method)
      const getRecord = {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'w') return { properties: { word: 'newword' } };
          if (key === 'definitions') return [];
          if (key === 'disc') return null;
        }),
      } as unknown as Record;
      neo4jService.read.mockResolvedValueOnce({
        records: [getRecord],
      } as unknown as Result);

      const retrievedWord = await wordSchema.getWord('newword');
      expect(retrievedWord?.word).toBe('newword');
    });
  });
});
