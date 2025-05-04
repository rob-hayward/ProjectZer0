// src/nodes/word/word.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { HttpException } from '@nestjs/common';

describe('WordController', () => {
  let controller: WordController;
  let wordService: jest.Mocked<WordService>;
  let discussionService: jest.Mocked<DiscussionService>;
  let commentService: jest.Mocked<CommentService>;

  beforeEach(async () => {
    wordService = {
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

    discussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
    } as any;

    commentService = {
      createComment: jest.fn(),
      getCommentsByDiscussionId: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordController],
      providers: [
        {
          provide: WordService,
          useValue: wordService,
        },
        {
          provide: DiscussionService,
          useValue: discussionService,
        },
        {
          provide: CommentService,
          useValue: commentService,
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
      wordService.checkWordExistence.mockResolvedValue(true);

      const result = await controller.checkWordExistence('test');

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('test');
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
        discussion: 'Initial discussion comment',
      };
      const mockWord = { id: 'word1', ...wordData };

      wordService.createWord.mockResolvedValue(mockWord);

      const result = await controller.createWord(wordData);

      expect(wordService.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          word: 'test',
          createdBy: 'user1',
          definitionText: 'A test word',
          publicCredit: true,
          discussion: 'Initial discussion comment',
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
      wordService.getWord.mockResolvedValue(mockWord);

      const result = await controller.getWord('test');

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockWord);
    });

    it('should handle case when word is not found', async () => {
      wordService.getWord.mockResolvedValue(null);

      const result = await controller.getWord('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllWords', () => {
    it('should call service.getAllWords', async () => {
      const mockWords = [{ id: 'word1', word: 'test' }];
      wordService.getAllWords.mockResolvedValue(mockWords);

      const result = await controller.getAllWords();

      expect(wordService.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });
  });

  describe('voteWord', () => {
    it('should call service.voteWord with correct parameters', async () => {
      const mockReq = { user: { sub: 'user1' } };
      const voteData = { isPositive: true };
      const mockResult = { positiveVotes: 1, negativeVotes: 0, netVotes: 1 };

      wordService.voteWord.mockResolvedValue(mockResult);

      const result = await controller.voteWord('test', voteData, mockReq);

      expect(wordService.voteWord).toHaveBeenCalledWith('test', 'user1', true);
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
      wordService.setWordVisibilityStatus.mockResolvedValue(mockResult);

      const result = await controller.setWordVisibilityStatus('word1', {
        isVisible: false,
      });

      expect(wordService.setWordVisibilityStatus).toHaveBeenCalledWith(
        'word1',
        false,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getWordVisibilityStatus', () => {
    it('should call service.getWordVisibilityStatus', async () => {
      wordService.getWordVisibilityStatus.mockResolvedValue(true);

      const result = await controller.getWordVisibilityStatus('word1');

      expect(wordService.getWordVisibilityStatus).toHaveBeenCalledWith('word1');
      expect(result).toEqual({ visibilityStatus: true });
    });
  });

  // New tests for discussion functionality
  describe('getWordWithDiscussion', () => {
    it('should call service.getWord and return word with discussion', async () => {
      const mockWordWithDiscussion = {
        id: 'word1',
        word: 'test',
        discussionId: 'disc1',
        discussion: {
          id: 'disc1',
          createdBy: 'user1',
          createdAt: new Date().toISOString(),
        },
      };

      wordService.getWord.mockResolvedValue(mockWordWithDiscussion);

      const result = await controller.getWordWithDiscussion('test');

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockWordWithDiscussion);
    });

    it('should return null if word is not found', async () => {
      wordService.getWord.mockResolvedValue(null);

      const result = await controller.getWordWithDiscussion('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw exception for empty word', async () => {
      await expect(controller.getWordWithDiscussion('')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getWordComments', () => {
    it('should get comments for a word with discussion', async () => {
      const mockWord = {
        id: 'word1',
        word: 'test',
        discussionId: 'disc1',
      };

      const mockComments = [
        { id: 'comment1', commentText: 'Comment 1', createdBy: 'user1' },
        { id: 'comment2', commentText: 'Comment 2', createdBy: 'user2' },
      ];

      wordService.getWord.mockResolvedValue(mockWord);
      commentService.getCommentsByDiscussionId.mockResolvedValue(mockComments);

      const result = await controller.getWordComments('test');

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(commentService.getCommentsByDiscussionId).toHaveBeenCalledWith(
        'disc1',
      );
      expect(result).toEqual({ comments: mockComments });
    });

    it('should return empty comments array if word has no discussion', async () => {
      const mockWord = {
        id: 'word1',
        word: 'test',
        // No discussionId
      };

      wordService.getWord.mockResolvedValue(mockWord);

      const result = await controller.getWordComments('test');

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(commentService.getCommentsByDiscussionId).not.toHaveBeenCalled();
      expect(result).toEqual({ comments: [] });
    });

    it('should return empty comments array if word is not found', async () => {
      wordService.getWord.mockResolvedValue(null);

      const result = await controller.getWordComments('nonexistent');

      expect(wordService.getWord).toHaveBeenCalledWith('nonexistent');
      expect(commentService.getCommentsByDiscussionId).not.toHaveBeenCalled();
      expect(result).toEqual({ comments: [] });
    });

    it('should throw exception for empty word', async () => {
      await expect(controller.getWordComments('')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('addWordComment', () => {
    const mockReq = { user: { sub: 'user1' } };
    const validCommentData = { commentText: 'Test comment' };

    it('should add comment to existing discussion', async () => {
      const mockWord = {
        id: 'word1',
        word: 'test',
        discussionId: 'disc1',
      };

      const mockCreatedComment = {
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'disc1',
        commentText: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      wordService.getWord.mockResolvedValue(mockWord);
      commentService.createComment.mockResolvedValue(mockCreatedComment);

      const result = await controller.addWordComment(
        'test',
        validCommentData,
        mockReq,
      );

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user1',
        discussionId: 'disc1',
        commentText: 'Test comment',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockCreatedComment);
    });

    it('should create discussion and add comment if word has no discussion', async () => {
      const mockWord = {
        id: 'word1',
        word: 'test',
        // No discussionId
      };

      const mockCreatedDiscussion = {
        id: 'new-disc1',
        createdBy: 'user1',
        associatedNodeId: 'word1',
        associatedNodeType: 'WordNode',
      };

      const mockCreatedComment = {
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'new-disc1',
        commentText: 'Test comment',
        createdAt: new Date().toISOString(),
      };

      wordService.getWord.mockResolvedValue(mockWord);
      discussionService.createDiscussion.mockResolvedValue(
        mockCreatedDiscussion,
      );
      wordService.updateWord.mockResolvedValue({
        ...mockWord,
        discussionId: 'new-disc1',
      });
      commentService.createComment.mockResolvedValue(mockCreatedComment);

      const result = await controller.addWordComment(
        'test',
        validCommentData,
        mockReq,
      );

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user1',
        associatedNodeId: 'word1',
        associatedNodeType: 'WordNode',
      });
      expect(wordService.updateWord).toHaveBeenCalledWith('test', {
        discussionId: 'new-disc1',
      });
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user1',
        discussionId: 'new-disc1',
        commentText: 'Test comment',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockCreatedComment);
    });

    it('should throw HttpException for empty word', async () => {
      await expect(
        controller.addWordComment('', validCommentData, mockReq),
      ).rejects.toThrow(HttpException);
    });

    it('should throw HttpException for empty comment text', async () => {
      await expect(
        controller.addWordComment('test', { commentText: '' }, mockReq),
      ).rejects.toThrow(HttpException);
    });

    it('should throw HttpException when word not found', async () => {
      wordService.getWord.mockResolvedValue(null);

      await expect(
        controller.addWordComment('nonexistent', validCommentData, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });
});
