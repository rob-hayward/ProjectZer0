import { Test, TestingModule } from '@nestjs/testing';
import { WordSchema } from '../word.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema } from '../vote.schema';
import { Record, Result } from 'neo4j-driver';
// Not using these imports directly in the code, but needed for type checking
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('WordSchema', () => {
  let wordSchema: WordSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userSchema: jest.Mocked<UserSchema>;
  let voteSchema: jest.Mocked<VoteSchema>;

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
    userSchema = module.get(UserSchema);
    voteSchema = module.get(VoteSchema);
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
          properties: { ...mockWord, positiveVotes: 0, negativeVotes: 0 },
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
          ...mockWord,
          word: 'test',
          isApiDefinition: false,
          isAICreated: false,
        }),
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
        expect.objectContaining({
          ...mockDefinition,
          word: 'test',
          isApiDefinition: false,
          isAICreated: false,
        }),
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
      await wordSchema.deleteWord('test');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        { word: 'test' },
      );
    });
  });

  describe('voteWord', () => {
    it('should vote on a word', async () => {
      const mockVoteResult = {
        positiveVotes: 6,
        negativeVotes: 2,
        netVotes: 4,
      };

      voteSchema.vote.mockResolvedValue(mockVoteResult);

      const result = await wordSchema.voteWord('test', 'user-id', true);

      expect(voteSchema.vote).toHaveBeenCalledWith(
        'WordNode',
        { word: 'test' },
        'user-id',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('getWordVotes', () => {
    it('should return vote counts for a word', async () => {
      const mockVoteStatus = {
        status: 'agree' as const, // Using as const instead of as 'agree'
        positiveVotes: 6,
        negativeVotes: 2,
        netVotes: 4,
      };

      voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await wordSchema.getWordVotes('test');

      expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
        'WordNode',
        { word: 'test' },
        '',
      );
      expect(result).toEqual({
        positiveVotes: 6,
        negativeVotes: 2,
        netVotes: 4,
      });
    });

    it('should return null when vote status is not found', async () => {
      voteSchema.getVoteStatus.mockResolvedValue(null);

      const result = await wordSchema.getWordVotes('test');
      expect(result).toBeNull();
    });
  });

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
  });
});
