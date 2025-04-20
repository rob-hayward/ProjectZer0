// src/nodes/word/word.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { HttpException } from '@nestjs/common';

describe('WordController', () => {
  let controller: WordController;
  let service: jest.Mocked<WordService>;

  beforeEach(async () => {
    service = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      getWord: jest.fn(),
      updateWord: jest.fn(),
      deleteWord: jest.fn(),
      voteWord: jest.fn(),
      getWordVotes: jest.fn(),
      setWordVisibilityStatus: jest.fn(),
      getWordVisibilityStatus: jest.fn(),
      getAllWords: jest.fn(),
      getWordVoteStatus: jest.fn(),
      removeWordVote: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordController],
      providers: [
        {
          provide: WordService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<WordController>(WordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkWordExistence', () => {
    it('should call service.checkWordExistence and return result', async () => {
      service.checkWordExistence.mockResolvedValue(true);

      const result = await controller.checkWordExistence('test');

      expect(service.checkWordExistence).toHaveBeenCalledWith('test');
      expect(result).toEqual({ exists: true });
    });

    it('should throw exception for empty word parameter', async () => {
      await expect(controller.checkWordExistence('')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createWord', () => {
    it('should call service.createWord with correct parameters', async () => {
      const wordData = {
        word: 'test',
        createdBy: 'user1',
        definitionText: 'A test word',
        publicCredit: true,
      };
      const mockWord = { id: 'word1', ...wordData };

      service.createWord.mockResolvedValue(mockWord);

      const result = await controller.createWord(wordData);

      expect(service.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'test',
          createdBy: 'user1',
          definitionText: 'A test word',
          publicCredit: true,
        }),
      );
      expect(result).toEqual(mockWord);
    });

    it('should throw exception for empty word', async () => {
      await expect(
        controller.createWord({
          word: '',
          createdBy: 'user1',
          publicCredit: true,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getWord', () => {
    it('should call service.getWord with correct parameters', async () => {
      const mockWord = { id: 'word1', word: 'test' };
      service.getWord.mockResolvedValue(mockWord);

      const result = await controller.getWord('test');

      expect(service.getWord).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockWord);
    });

    it('should handle case when word is not found', async () => {
      service.getWord.mockResolvedValue(null);

      const result = await controller.getWord('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllWords', () => {
    it('should call service.getAllWords', async () => {
      const mockWords = [{ id: 'word1', word: 'test' }];
      service.getAllWords.mockResolvedValue(mockWords);

      const result = await controller.getAllWords();

      expect(service.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });
  });

  describe('voteWord', () => {
    it('should call service.voteWord with correct parameters', async () => {
      const mockReq = { user: { sub: 'user1' } };
      const voteData = { isPositive: true };
      const mockResult = { positiveVotes: 1, negativeVotes: 0, netVotes: 1 };

      service.voteWord.mockResolvedValue(mockResult);

      const result = await controller.voteWord('test', voteData, mockReq);

      expect(service.voteWord).toHaveBeenCalledWith('test', 'user1', true);
      expect(result).toEqual(mockResult);
    });

    it('should throw exception when user is not authenticated', async () => {
      const mockReq = { user: {} }; // No sub
      const voteData = { isPositive: true };

      await expect(
        controller.voteWord('test', voteData, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('setWordVisibilityStatus', () => {
    it('should call service.setWordVisibilityStatus', async () => {
      const mockResult = { id: 'word1', visibilityStatus: false };
      service.setWordVisibilityStatus.mockResolvedValue(mockResult);

      const result = await controller.setWordVisibilityStatus('word1', {
        isVisible: false,
      });

      expect(service.setWordVisibilityStatus).toHaveBeenCalledWith(
        'word1',
        false,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getWordVisibilityStatus', () => {
    it('should call service.getWordVisibilityStatus', async () => {
      service.getWordVisibilityStatus.mockResolvedValue(true);

      const result = await controller.getWordVisibilityStatus('word1');

      expect(service.getWordVisibilityStatus).toHaveBeenCalledWith('word1');
      expect(result).toEqual({ visibilityStatus: true });
    });
  });
});
