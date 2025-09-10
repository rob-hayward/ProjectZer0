// src/nodes/word/word.controller.spec.ts - COMPLETE FIXED VERSION

import { Test, TestingModule } from '@nestjs/testing';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { HttpException } from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

describe('WordController with BaseNodeSchema Integration', () => {
  let controller: WordController;
  let wordService: jest.Mocked<WordService>;
  let discussionService: jest.Mocked<DiscussionService>;
  let commentService: jest.Mocked<CommentService>;

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 6,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 4,
    contentStatus: null,
    contentPositiveVotes: 0,
    contentNegativeVotes: 0,
    contentNetVotes: 0,
  };

  const mockWordData = {
    id: 'word-123',
    word: 'test',
    createdBy: 'user-123',
    publicCredit: true,
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    definitions: [{ id: 'def-1', definitionText: 'First definition' }],
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
  };

  const mockCommentData: CommentData = {
    id: 'comment-1',
    createdBy: 'user-123',
    discussionId: 'discussion-123',
    commentText: 'Test comment',
    parentCommentId: undefined,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 2,
    contentNegativeVotes: 1,
    contentNetVotes: 1,
  };

  beforeEach(async () => {
    // ✅ FIXED: Complete mock setup with all required methods
    const mockWordService = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      getWord: jest.fn(),
      getWordWithVisibility: jest.fn(), // ✅ ADDED: Missing method
      getAllWords: jest.fn(),
      updateWord: jest.fn(),
      deleteWord: jest.fn(),
      voteWord: jest.fn(),
      getWordVoteStatus: jest.fn(),
      removeWordVote: jest.fn(),
      getWordVotes: jest.fn(),
      setWordVisibilityPreference: jest.fn(),
      getWordVisibilityForUser: jest.fn(),
    };

    const mockDiscussionService = {
      createDiscussion: jest.fn(),
      getDiscussion: jest.fn(),
      updateDiscussion: jest.fn(),
      deleteDiscussion: jest.fn(),
      getDiscussionsByAssociatedNode: jest.fn(),
      getDiscussionWithComments: jest.fn(),
      getDiscussionCommentCount: jest.fn(),
    };

    const mockCommentService = {
      createComment: jest.fn(),
      getCommentsByDiscussionId: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      voteComment: jest.fn(),
      getCommentVoteStatus: jest.fn(),
      removeCommentVote: jest.fn(),
      getCommentVotes: jest.fn(),
      setCommentVisibilityPreference: jest.fn(),
      getCommentVisibility: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordController],
      providers: [
        {
          provide: WordService,
          useValue: mockWordService,
        },
        {
          provide: DiscussionService,
          useValue: mockDiscussionService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    controller = module.get<WordController>(WordController);
    wordService = module.get(WordService);
    discussionService = module.get(DiscussionService);
    commentService = module.get(CommentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkWordExistence', () => {
    it('should check word existence successfully', async () => {
      wordService.checkWordExistence.mockResolvedValue(true);

      const result = await controller.checkWordExistence('test');

      expect(wordService.checkWordExistence).toHaveBeenCalledWith('test');
      expect(result).toEqual({ exists: true });
    });

    it('should throw HttpException for empty word', async () => {
      await expect(controller.checkWordExistence('')).rejects.toThrow(
        HttpException,
      );

      expect(wordService.checkWordExistence).not.toHaveBeenCalled();
    });
  });

  describe('createWord', () => {
    const validWordData = {
      word: 'test',
      createdBy: 'user-123',
      definitionText: 'Test definition',
      discussion: 'Test discussion',
      publicCredit: true,
    };

    it('should create a word successfully', async () => {
      wordService.createWord.mockResolvedValue(mockWordData);

      const result = await controller.createWord(validWordData);

      expect(wordService.createWord).toHaveBeenCalledWith(validWordData);
      expect(result).toEqual(mockWordData);
    });

    it('should throw HttpException for invalid input', async () => {
      const invalidData = { ...validWordData, word: '' };

      await expect(controller.createWord(invalidData)).rejects.toThrow(
        HttpException,
      );

      expect(wordService.createWord).not.toHaveBeenCalled();
    });
  });

  describe('getWord', () => {
    const mockReq = { user: { sub: 'user-123' } };

    it('should get word successfully', async () => {
      // ✅ FIXED: Use getWordWithVisibility method
      wordService.getWordWithVisibility.mockResolvedValue(mockWordData);

      const result = await controller.getWord('test', mockReq);

      // ✅ FIXED: Expect getWordWithVisibility to be called with word and userId
      expect(wordService.getWordWithVisibility).toHaveBeenCalledWith(
        'test',
        'user-123',
      );
      expect(result).toEqual(mockWordData);
    });

    it('should throw HttpException when word not found', async () => {
      // ✅ FIXED: Use getWordWithVisibility method
      wordService.getWordWithVisibility.mockResolvedValue(null);

      await expect(controller.getWord('nonexistent', mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateWord', () => {
    const updateData = { publicCredit: false };

    it('should update word successfully', async () => {
      const updatedWord = { ...mockWordData, ...updateData };
      wordService.updateWord.mockResolvedValue(updatedWord);

      const result = await controller.updateWord('test', updateData);

      expect(wordService.updateWord).toHaveBeenCalledWith('test', updateData);
      expect(result).toEqual(updatedWord);
    });
  });

  describe('deleteWord', () => {
    it('should delete word successfully', async () => {
      wordService.deleteWord.mockResolvedValue({ success: true });

      const result = await controller.deleteWord('test');

      expect(wordService.deleteWord).toHaveBeenCalledWith('test');
      expect(result).toEqual({ success: true });
    });
  });

  describe('voteWord', () => {
    const mockReq = { user: { sub: 'user-456' } };
    const voteData = { isPositive: true };

    it('should vote on word inclusion successfully', async () => {
      wordService.voteWord.mockResolvedValue(mockVoteResult);

      const result = await controller.voteWord('test', voteData, mockReq);

      expect(wordService.voteWord).toHaveBeenCalledWith(
        'test',
        'user-456',
        true,
      );
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('getWordVoteStatus', () => {
    const mockReq = { user: { sub: 'user-456' } };

    it('should get word vote status successfully', async () => {
      wordService.getWordVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await controller.getWordVoteStatus('test', mockReq);

      expect(wordService.getWordVoteStatus).toHaveBeenCalledWith(
        'test',
        'user-456',
      );
      expect(result).toEqual(mockVoteStatus);
    });
  });

  describe('addWordComment', () => {
    const mockReq = { user: { sub: 'user-123' } };
    const validCommentData = { commentText: 'Test comment' };

    it('should add comment to word with existing discussion', async () => {
      const mockWordWithDiscussion = {
        ...mockWordData,
        discussionId: 'discussion-123',
      };

      wordService.getWord.mockResolvedValue(mockWordWithDiscussion);
      commentService.createComment.mockResolvedValue(mockCommentData);

      const result = await controller.addWordComment(
        'test',
        validCommentData,
        mockReq,
      );

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user-123',
        discussionId: 'discussion-123',
        commentText: 'Test comment',
        parentCommentId: undefined,
      });
      expect(result).toEqual(mockCommentData);
    });

    it('should create discussion and add comment for word without discussion', async () => {
      const mockWordWithoutDiscussion = {
        ...mockWordData,
        // No discussionId
      };

      // ✅ FIXED: Complete DiscussionData with proper Date objects
      const mockCreatedDiscussion: DiscussionData = {
        id: 'new-discussion-123',
        createdBy: 'user-123',
        associatedNodeId: 'word-123',
        associatedNodeType: 'WordNode',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
        inclusionPositiveVotes: 0,
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      const mockCreatedComment: CommentData = {
        ...mockCommentData,
        id: 'new-comment-123',
        createdBy: 'user-123',
        discussionId: 'new-discussion-123',
        commentText: 'Test comment',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z'),
      };

      wordService.getWord.mockResolvedValue(mockWordWithoutDiscussion);
      discussionService.createDiscussion.mockResolvedValue(
        mockCreatedDiscussion,
      );
      wordService.updateWord.mockResolvedValue({
        ...mockWordWithoutDiscussion,
        discussionId: 'new-discussion-123',
      });
      commentService.createComment.mockResolvedValue(mockCreatedComment);

      const result = await controller.addWordComment(
        'test',
        validCommentData,
        mockReq,
      );

      expect(wordService.getWord).toHaveBeenCalledWith('test');
      expect(discussionService.createDiscussion).toHaveBeenCalledWith({
        createdBy: 'user-123',
        associatedNodeId: 'word-123',
        associatedNodeType: 'WordNode',
      });
      expect(wordService.updateWord).toHaveBeenCalledWith('test', {
        discussionId: 'new-discussion-123',
      });
      expect(commentService.createComment).toHaveBeenCalledWith({
        createdBy: 'user-123',
        discussionId: 'new-discussion-123',
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
        controller.addWordComment('test', validCommentData, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getAllWords', () => {
    it('should get all words successfully', async () => {
      const mockWords = [mockWordData];
      wordService.getAllWords.mockResolvedValue(mockWords);

      const mockReq = { user: { sub: 'user-123' } };
      const result = await controller.getAllWords(mockReq);

      expect(wordService.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });
  });

  describe('setWordVisibilityPreference', () => {
    const mockReq = { user: { sub: 'user-456' } };
    const visibilityData = { isVisible: false };

    it('should set word visibility preference successfully', async () => {
      const mockVisibilityPreference = {
        isVisible: false,
        source: 'user' as const,
        timestamp: Date.now(),
      };

      wordService.setWordVisibilityPreference.mockResolvedValue(
        mockVisibilityPreference,
      );

      const result = await controller.setWordVisibilityPreference(
        'test',
        visibilityData,
        mockReq,
      );

      expect(wordService.setWordVisibilityPreference).toHaveBeenCalledWith(
        'user-456',
        'test',
        false,
      );
      expect(result).toEqual(mockVisibilityPreference);
    });
  });
});
