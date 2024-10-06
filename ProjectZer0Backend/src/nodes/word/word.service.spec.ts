import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';

describe('WordService', () => {
  let service: WordService;
  let schema: jest.Mocked<WordSchema>;

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
          },
        },
      ],
    }).compile();

    service = module.get<WordService>(WordService);
    schema = module.get(WordSchema);
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
      const wordData = { word: 'test', initialDefinition: 'A test word' };
      await service.createWord(wordData);
      expect(schema.createWord).toHaveBeenCalledWith(wordData);
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
      const updateData = { definition: 'Updated definition' };
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
});
