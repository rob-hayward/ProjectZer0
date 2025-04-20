// src/nodes/word/word.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { DiscussionService } from '../discussion/discussion.service';
import { HttpException, Logger } from '@nestjs/common';

describe('WordService', () => {
  let service: WordService;
  let wordSchema: any;
  let dictionaryService: any;
  let discussionService: any;

  // Use unique test words to avoid conflicts with database
  const TEST_WORD = 'testUniqueXYZ123';
  const TEST_WORD_LOWERCASE = TEST_WORD.toLowerCase();
  const USER_DEFINITION = 'User provided definition';
  const API_DEFINITION = 'API provided definition';

  beforeEach(async () => {
    // Clear mocks before each test
    jest.clearAllMocks();

    // Create mock implementations
    wordSchema = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      getWord: jest.fn(),
      updateWord: jest.fn(),
      deleteWord: jest.fn(),
      voteWord: jest.fn(),
      getWordVotes: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
      addDefinition: jest.fn(),
      updateWordWithDiscussionId: jest.fn(),
      getAllWords: jest.fn(),
      getWordVoteStatus: jest.fn(),
      removeWordVote: jest.fn(),
    };

    dictionaryService = {
      // Fix the unused variable warning by removing the parameter
      getDefinition: jest.fn().mockImplementation(() => {
        return Promise.resolve(API_DEFINITION);
      }),
    };

    discussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordService,
        {
          provide: WordSchema,
          useValue: wordSchema,
        },
        {
          provide: DictionaryService,
          useValue: dictionaryService,
        },
        {
          provide: DiscussionService,
          useValue: discussionService,
        },
        {
          provide: Logger,
          useFactory: () => ({
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<WordService>(WordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkWordExistence', () => {
    it('should call schema.checkWordExistence with correct parameters', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(true);

      const result = await service.checkWordExistence(TEST_WORD);

      expect(wordSchema.checkWordExistence).toHaveBeenCalledWith(TEST_WORD);
      expect(result).toBe(true);
    });

    it('should throw exception when word is empty', async () => {
      await expect(service.checkWordExistence('')).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle errors from schema', async () => {
      wordSchema.checkWordExistence.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.checkWordExistence(TEST_WORD)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createWord', () => {
    it('should create word with user-provided definition and add API definition as alternative', async () => {
      // Setup mocks
      wordSchema.checkWordExistence.mockResolvedValue(false);
      dictionaryService.getDefinition.mockResolvedValue(API_DEFINITION);
      wordSchema.createWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
      });
      wordSchema.getWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
        definitions: [
          { definitionText: USER_DEFINITION },
          { definitionText: API_DEFINITION },
        ],
      });

      // Create word with user definition
      const wordData = {
        word: TEST_WORD,
        createdBy: 'user-id',
        definitionText: USER_DEFINITION,
        publicCredit: true,
      };

      const result = await service.createWord(wordData);

      // Verify mocks were called correctly
      expect(wordSchema.checkWordExistence).toHaveBeenCalledWith(TEST_WORD);

      // Important: API definition should ALWAYS be fetched now
      expect(dictionaryService.getDefinition).toHaveBeenCalledWith(TEST_WORD);

      // Word should be created with user definition as primary
      expect(wordSchema.createWord).toHaveBeenCalledWith({
        word: TEST_WORD,
        createdBy: 'user-id',
        initialDefinition: USER_DEFINITION,
        publicCredit: true,
      });

      // API definition should be added as alternative
      expect(wordSchema.addDefinition).toHaveBeenCalledWith({
        word: TEST_WORD,
        createdBy: 'FreeDictionaryAPI',
        definitionText: API_DEFINITION,
      });

      expect(result).toBeDefined();
      expect(result.definitions).toHaveLength(2);
      expect(result.definitions[0].definitionText).toBe(USER_DEFINITION);
      expect(result.definitions[1].definitionText).toBe(API_DEFINITION);
    });

    it('should create word with API definition when no user definition provided', async () => {
      // Setup mocks
      wordSchema.checkWordExistence.mockResolvedValue(false);
      dictionaryService.getDefinition.mockResolvedValue(API_DEFINITION);
      wordSchema.createWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
      });
      wordSchema.getWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
        definitions: [{ definitionText: API_DEFINITION }],
      });

      // Create word without user definition
      const wordData = {
        word: TEST_WORD,
        createdBy: 'user-id',
        publicCredit: true,
      };

      const result = await service.createWord(wordData);

      // Verify mocks were called correctly
      expect(wordSchema.checkWordExistence).toHaveBeenCalledWith(TEST_WORD);

      // Should call getDefinition
      expect(dictionaryService.getDefinition).toHaveBeenCalledWith(TEST_WORD);

      // Word should be created with API definition as primary
      expect(wordSchema.createWord).toHaveBeenCalledWith({
        word: TEST_WORD,
        createdBy: 'user-id',
        initialDefinition: API_DEFINITION,
        publicCredit: true,
      });

      // No alternative definition needed since there's only one definition
      expect(wordSchema.addDefinition).not.toHaveBeenCalled();

      expect(result).toBeDefined();
      expect(result.definitions).toHaveLength(1);
      expect(result.definitions[0].definitionText).toBe(API_DEFINITION);
    });

    it('should not add API definition as alternative when it matches user definition', async () => {
      // Setup - same definition for both user and API
      const SAME_DEFINITION = 'Same definition text';

      wordSchema.checkWordExistence.mockResolvedValue(false);
      dictionaryService.getDefinition.mockResolvedValue(SAME_DEFINITION);
      wordSchema.createWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
      });
      wordSchema.getWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
        definitions: [{ definitionText: SAME_DEFINITION }],
      });

      // Create word with definition matching API
      const wordData = {
        word: TEST_WORD,
        createdBy: 'user-id',
        definitionText: SAME_DEFINITION,
        publicCredit: true,
      };

      await service.createWord(wordData);

      // API definition should still be fetched
      expect(dictionaryService.getDefinition).toHaveBeenCalledWith(TEST_WORD);

      // Word should be created with user definition
      expect(wordSchema.createWord).toHaveBeenCalledWith({
        word: TEST_WORD,
        createdBy: 'user-id',
        initialDefinition: SAME_DEFINITION,
        publicCredit: true,
      });

      // Alternative definition should NOT be added since they match
      expect(wordSchema.addDefinition).not.toHaveBeenCalled();
    });

    it('should handle API definition fetch failure gracefully', async () => {
      // Setup mocks
      wordSchema.checkWordExistence.mockResolvedValue(false);
      dictionaryService.getDefinition.mockRejectedValue(
        new Error('API unavailable'),
      );
      wordSchema.createWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
      });
      wordSchema.getWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
        definitions: [{ definitionText: USER_DEFINITION }],
      });

      // Create word with user definition
      const wordData = {
        word: TEST_WORD,
        createdBy: 'user-id',
        definitionText: USER_DEFINITION,
        publicCredit: true,
      };

      const result = await service.createWord(wordData);

      // API definition should be attempted but failed
      expect(dictionaryService.getDefinition).toHaveBeenCalledWith(TEST_WORD);

      // Word should still be created with user definition
      expect(wordSchema.createWord).toHaveBeenCalledWith({
        word: TEST_WORD,
        createdBy: 'user-id',
        initialDefinition: USER_DEFINITION,
        publicCredit: true,
      });

      // No alternative definition added due to API failure
      expect(wordSchema.addDefinition).not.toHaveBeenCalled();

      expect(result).toBeDefined();
    });

    it('should create discussion when provided', async () => {
      // Setup mocks
      wordSchema.checkWordExistence.mockResolvedValue(false);
      dictionaryService.getDefinition.mockResolvedValue(API_DEFINITION);
      wordSchema.createWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
      });
      discussionService.createDiscussion.mockResolvedValue({
        id: 'discussion-id',
      });
      wordSchema.getWord.mockResolvedValue({
        id: 'word-id',
        word: TEST_WORD,
        discussionId: 'discussion-id',
        definitions: [{ definitionText: USER_DEFINITION }],
      });

      // Create word with discussion
      const wordData = {
        word: TEST_WORD,
        createdBy: 'user-id',
        definitionText: USER_DEFINITION,
        discussion: 'Initial comment',
        publicCredit: true,
      };

      await service.createWord(wordData);

      // Verify discussion was created
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user-id',
        associatedNodeId: 'word-id',
        associatedNodeType: 'WordNode',
        initialComment: 'Initial comment',
      });

      expect(wordSchema.updateWordWithDiscussionId).toHaveBeenCalledWith(
        'word-id',
        'discussion-id',
      );
    });

    it('should throw exception when word already exists', async () => {
      wordSchema.checkWordExistence.mockResolvedValue(true);

      const wordData = {
        word: TEST_WORD,
        createdBy: 'user-id',
        publicCredit: true,
      };

      await expect(service.createWord(wordData)).rejects.toThrow();
    });
  });

  describe('getWord', () => {
    it('should return word with discussion if available', async () => {
      const mockWord = {
        id: 'word-id',
        word: TEST_WORD_LOWERCASE, // Service converts to lowercase here
        discussionId: 'discussion-id',
      };
      const mockDiscussion = { id: 'discussion-id', comments: [] };

      wordSchema.getWord.mockResolvedValue(mockWord);
      discussionService.getDiscussion.mockResolvedValue(mockDiscussion);

      const result = await service.getWord(TEST_WORD);

      // The word is converted to lowercase in getWord
      expect(wordSchema.getWord).toHaveBeenCalledWith(TEST_WORD_LOWERCASE);
      expect(discussionService.getDiscussion).toHaveBeenCalledWith(
        'discussion-id',
      );
      expect(result).toEqual({
        ...mockWord,
        discussion: mockDiscussion,
      });
    });

    it('should return null when word not found', async () => {
      wordSchema.getWord.mockResolvedValue(null);

      const result = await service.getWord('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllWords', () => {
    it('should return all words from schema', async () => {
      const mockWords = [
        { id: 'word1', word: 'test1' },
        { id: 'word2', word: 'test2' },
      ];
      wordSchema.getAllWords.mockResolvedValue(mockWords);

      const result = await service.getAllWords();

      expect(wordSchema.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });
  });

  describe('updateWord', () => {
    it('should update word with given data', async () => {
      const mockUpdatedWord = {
        id: 'word-id',
        word: TEST_WORD,
        liveDefinition: 'Updated definition',
      };
      wordSchema.updateWord.mockResolvedValue(mockUpdatedWord);

      const result = await service.updateWord(TEST_WORD, {
        liveDefinition: 'Updated definition',
      });

      expect(wordSchema.updateWord).toHaveBeenCalledWith(TEST_WORD, {
        liveDefinition: 'Updated definition',
      });
      expect(result).toEqual(mockUpdatedWord);
    });
  });

  describe('voteWord', () => {
    it('should vote on word', async () => {
      const mockVoteResult = {
        positiveVotes: 6,
        negativeVotes: 2,
        netVotes: 4,
      };
      wordSchema.voteWord.mockResolvedValue(mockVoteResult);

      const result = await service.voteWord(TEST_WORD, 'user1', true);

      expect(wordSchema.voteWord).toHaveBeenCalledWith(
        TEST_WORD,
        'user1',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('visibility methods', () => {
    it('should set word visibility status', async () => {
      const mockUpdatedWord = {
        id: 'word-id',
        visibilityStatus: false,
      };
      wordSchema.setVisibilityStatus.mockResolvedValue(mockUpdatedWord);

      const result = await service.setWordVisibilityStatus('word-id', false);

      expect(wordSchema.setVisibilityStatus).toHaveBeenCalledWith(
        'word-id',
        false,
      );
      expect(result).toEqual(mockUpdatedWord);
    });

    it('should get word visibility status', async () => {
      wordSchema.getVisibilityStatus.mockResolvedValue(true);

      const result = await service.getWordVisibilityStatus('word-id');

      expect(wordSchema.getVisibilityStatus).toHaveBeenCalledWith('word-id');
      expect(result).toBe(true);
    });
  });
});
