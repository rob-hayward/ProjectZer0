import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { DiscussionService } from '../discussion/discussion.service';

describe('WordService', () => {
  let service: WordService;
  let schema: jest.Mocked<WordSchema>;
  let dictionaryService: jest.Mocked<DictionaryService>;
  let discussionService: jest.Mocked<DiscussionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordService,
        {
          provide: WordSchema,
          useValue: {
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
          },
        },
        {
          provide: DictionaryService,
          useValue: {
            getDefinition: jest.fn(),
          },
        },
        {
          provide: DiscussionService,
          useValue: {
            createDiscussion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WordService>(WordService);
    schema = module.get(WordSchema);
    dictionaryService = module.get(DictionaryService);
    discussionService = module.get(DiscussionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkWordExistence', () => {
    it('should call schema.checkWordExistence with correct parameters', async () => {
      const word = 'test';
      await service.checkWordExistence(word);
      expect(schema.checkWordExistence).toHaveBeenCalledWith(word);
    });
  });

  describe('createWord', () => {
    it('should call schema.createWord with correct parameters', async () => {
      const wordData = {
        word: 'test',
        createdBy: 'user-id',
        definition: 'Test definition',
        discussion: 'Initial comment',
        publicCredit: true,
      };
      schema.createWord.mockResolvedValue({ id: 'word-id', ...wordData });
      dictionaryService.getDefinition.mockResolvedValue('API definition');
      discussionService.createDiscussion.mockResolvedValue({
        id: 'discussion-id',
      });

      await service.createWord(wordData);

      expect(schema.createWord).toHaveBeenCalledWith({
        word: wordData.word,
        createdBy: wordData.createdBy,
        initialDefinition: wordData.definition,
        publicCredit: wordData.publicCredit,
      });
      expect(schema.addDefinition).toHaveBeenCalledWith({
        word: wordData.word,
        createdBy: 'FreeDictionaryAPI',
        definitionText: 'API definition',
      });
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: wordData.createdBy,
        associatedNodeId: 'word-id',
        associatedNodeType: 'WordNode',
        initialComment: wordData.discussion,
      });
      expect(schema.updateWordWithDiscussionId).toHaveBeenCalledWith(
        'word-id',
        'discussion-id',
      );
    });
  });

  describe('getWord', () => {
    it('should call schema.getWord with correct parameters', async () => {
      const word = 'test';
      await service.getWord(word);
      expect(schema.getWord).toHaveBeenCalledWith(word);
    });
  });

  describe('updateWord', () => {
    it('should call schema.updateWord with correct parameters', async () => {
      const word = 'test';
      const updateData = { liveDefinition: 'Updated definition' };
      await service.updateWord(word, updateData);
      expect(schema.updateWord).toHaveBeenCalledWith(word, updateData);
    });
  });

  describe('deleteWord', () => {
    it('should call schema.deleteWord with correct parameters', async () => {
      const word = 'test';
      await service.deleteWord(word);
      expect(schema.deleteWord).toHaveBeenCalledWith(word);
    });
  });

  describe('voteWord', () => {
    it('should call schema.voteWord with correct parameters', async () => {
      const word = 'test';
      const userId = 'user1';
      const isPositive = true;
      await service.voteWord(word, userId, isPositive);
      expect(schema.voteWord).toHaveBeenCalledWith(word, userId, isPositive);
    });
  });

  describe('getWordVotes', () => {
    it('should call schema.getWordVotes with correct parameters', async () => {
      const word = 'test';
      await service.getWordVotes(word);
      expect(schema.getWordVotes).toHaveBeenCalledWith(word);
    });
  });
  describe('setWordVisibilityStatus', () => {
    it('should call schema.setVisibilityStatus with correct parameters', async () => {
      const wordId = 'word1';
      const isVisible = false;
      const mockUpdatedWord = { id: wordId, visibilityStatus: isVisible };
      schema.setVisibilityStatus.mockResolvedValue(mockUpdatedWord);

      const result = await service.setWordVisibilityStatus(wordId, isVisible);

      expect(schema.setVisibilityStatus).toHaveBeenCalledWith(
        wordId,
        isVisible,
      );
      expect(result).toEqual(mockUpdatedWord);
    });
  });

  describe('getWordVisibilityStatus', () => {
    it('should call schema.getVisibilityStatus with correct parameters', async () => {
      const wordId = 'word1';
      const mockVisibilityStatus = true;
      schema.getVisibilityStatus.mockResolvedValue(mockVisibilityStatus);

      const result = await service.getWordVisibilityStatus(wordId);

      expect(schema.getVisibilityStatus).toHaveBeenCalledWith(wordId);
      expect(result).toEqual(mockVisibilityStatus);
    });
  });
});
