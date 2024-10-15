import { Test, TestingModule } from '@nestjs/testing';
import { WordController } from './word.controller';
import { WordService } from './word.service';

describe('WordController', () => {
  let controller: WordController;
  let service: WordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordController],
      providers: [
        {
          provide: WordService,
          useValue: {
            checkWordExistence: jest.fn(),
            createWord: jest.fn(),
            getWord: jest.fn(),
            updateWord: jest.fn(),
            deleteWord: jest.fn(),
            voteWord: jest.fn(),
            getWordVotes: jest.fn(),
            setWordVisibilityStatus: jest.fn(),
            getWordVisibilityStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WordController>(WordController);
    service = module.get<WordService>(WordService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkWordExistence', () => {
    it('should call service.checkWordExistence with correct parameters', async () => {
      const word = 'test';
      jest.spyOn(service, 'checkWordExistence').mockResolvedValue(true);
      const result = await controller.checkWordExistence(word);
      expect(service.checkWordExistence).toHaveBeenCalledWith(word);
      expect(result).toEqual({ exists: true });
    });
  });

  describe('createWord', () => {
    it('should call service.createWord with correct parameters', async () => {
      const wordData = { word: 'test', initialDefinition: 'A test word' };
      await controller.createWord(wordData);
      expect(service.createWord).toHaveBeenCalledWith(wordData);
    });
  });

  describe('getWord', () => {
    it('should call service.getWord with correct parameters', async () => {
      const word = 'test';
      await controller.getWord(word);
      expect(service.getWord).toHaveBeenCalledWith(word);
    });
  });

  describe('updateWord', () => {
    it('should call service.updateWord with correct parameters', async () => {
      const word = 'test';
      const updateData = { definition: 'Updated definition' };
      await controller.updateWord(word, updateData);
      expect(service.updateWord).toHaveBeenCalledWith(word, updateData);
    });
  });

  describe('deleteWord', () => {
    it('should call service.deleteWord with correct parameters', async () => {
      const word = 'test';
      await controller.deleteWord(word);
      expect(service.deleteWord).toHaveBeenCalledWith(word);
    });
  });

  describe('voteWord', () => {
    it('should call service.voteWord with correct parameters', async () => {
      const word = 'test';
      const voteData = { userId: 'user1', isPositive: true };
      await controller.voteWord(word, voteData);
      expect(service.voteWord).toHaveBeenCalledWith(
        word,
        voteData.userId,
        voteData.isPositive,
      );
    });
  });

  describe('getWordVotes', () => {
    it('should call service.getWordVotes with correct parameters', async () => {
      const word = 'test';
      await controller.getWordVotes(word);
      expect(service.getWordVotes).toHaveBeenCalledWith(word);
    });
  });
  describe('setWordVisibilityStatus', () => {
    it('should call service.setWordVisibilityStatus with correct parameters', async () => {
      const wordId = 'word1';
      const visibilityData = { isVisible: false };
      const mockUpdatedWord = { id: wordId, visibilityStatus: false };
      jest
        .spyOn(service, 'setWordVisibilityStatus')
        .mockResolvedValue(mockUpdatedWord);

      const result = await controller.setWordVisibilityStatus(
        wordId,
        visibilityData,
      );

      expect(service.setWordVisibilityStatus).toHaveBeenCalledWith(
        wordId,
        false,
      );
      expect(result).toEqual(mockUpdatedWord);
    });
  });

  describe('getWordVisibilityStatus', () => {
    it('should call service.getWordVisibilityStatus with correct parameters', async () => {
      const wordId = 'word1';
      const mockVisibilityStatus = true;
      jest
        .spyOn(service, 'getWordVisibilityStatus')
        .mockResolvedValue(mockVisibilityStatus);

      const result = await controller.getWordVisibilityStatus(wordId);

      expect(service.getWordVisibilityStatus).toHaveBeenCalledWith(wordId);
      expect(result).toEqual({ visibilityStatus: mockVisibilityStatus });
    });
  });
});
