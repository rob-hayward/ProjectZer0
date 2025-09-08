// src/nodes/word/word.controller.spec.ts - TYPE FIXES FOR COMMENT/DISCUSSION INTERFACES

import { Test, TestingModule } from '@nestjs/testing';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { HttpException } from '@nestjs/common';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';
import type { DiscussionData } from '../../neo4j/schemas/discussion.schema';
import type { CommentData } from '../../neo4j/schemas/comment.schema';

describe('WordController with BaseNodeSchema + VisibilityService Integration', () => {
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
  };

  // ✅ FIXED: Complete CommentData objects
  const mockCommentData: CommentData = {
    id: 'comment-1',
    createdBy: 'user-123',
    discussionId: 'discussion-123',
    commentText: 'Test comment',
    parentCommentId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    // BaseNodeData properties
    inclusionPositiveVotes: 0,
    inclusionNegativeVotes: 0,
    inclusionNetVotes: 0,
    contentPositiveVotes: 2,
    contentNegativeVotes: 1,
    contentNetVotes: 1,
  };

  // ✅ FIXED: Complete DiscussionData objects
  const mockDiscussionData: DiscussionData = {
    id: 'discussion-123',
    createdBy: 'user-123',
    associatedNodeId: 'word-123',
    associatedNodeType: 'WordNode',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    wordService = {
      checkWordExistence: jest.fn(),
      createWord: jest.fn(),
      getWord: jest.fn(),
      getWordWithVisibility: jest.fn(),
      getAllWords: jest.fn(),
      updateWord: jest.fn(),
      deleteWord: jest.fn(),
      voteWord: jest.fn(),
      getWordVotes: jest.fn(),
      getWordVoteStatus: jest.fn(),
      removeWordVote: jest.fn(),
      setWordVisibilityPreference: jest.fn(),
      getWordVisibilityForUser: jest.fn(),
      addDefinition: jest.fn(),
      isWordAvailableForDefinitionCreation: jest.fn(),
      isWordAvailableForCategoryComposition: jest.fn(),
      getApprovedWords: jest.fn(),
      checkWords: jest.fn(),
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

  afterEach(() => {
    jest.clearAllMocks();
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
    it('should call service.getWordWithVisibility for authenticated users', async () => {
      const mockReq = { user: { sub: 'user-456' } };
      const mockWordWithVisibility = { ...mockWordData, isVisible: true };
      wordService.getWordWithVisibility.mockResolvedValue(
        mockWordWithVisibility,
      );

      const result = await controller.getWord('test', mockReq);

      expect(wordService.getWordWithVisibility).toHaveBeenCalledWith(
        'test',
        'user-456',
      );
      expect(result).toEqual(mockWordWithVisibility);
    });

    it('should call service.getWordWithVisibility for anonymous users', async () => {
      const mockReq = {};
      const mockWordWithVisibility = { ...mockWordData, isVisible: true };
      wordService.getWordWithVisibility.mockResolvedValue(
        mockWordWithVisibility,
      );

      const result = await controller.getWord('test', mockReq);

      expect(wordService.getWordWithVisibility).toHaveBeenCalledWith(
        'test',
        undefined,
      );
      expect(result).toEqual(mockWordWithVisibility);
    });

    it('should handle case when word is not found', async () => {
      const mockReq = { user: { sub: 'user-456' } };
      wordService.getWordWithVisibility.mockResolvedValue(null);

      const result = await controller.getWord('nonexistent', mockReq);

      expect(result).toBeNull();
    });

    it('should throw exception for empty word parameter', async () => {
      const mockReq = { user: { sub: 'user-456' } };

      await expect(controller.getWord('', mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getAllWords', () => {
    it('should call service.getAllWords and return words', async () => {
      const mockReq = { user: { sub: 'user-456' } };
      const mockWords = [mockWordData, { ...mockWordData, word: 'test2' }];
      wordService.getAllWords.mockResolvedValue(mockWords);

      const result = await controller.getAllWords(mockReq);

      expect(wordService.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });

    it('should work for anonymous users', async () => {
      const mockReq = {};
      const mockWords = [mockWordData];
      wordService.getAllWords.mockResolvedValue(mockWords);

      const result = await controller.getAllWords(mockReq);

      expect(wordService.getAllWords).toHaveBeenCalled();
      expect(result).toEqual(mockWords);
    });
  });

  describe('updateWord', () => {
    it('should call service.updateWord with correct parameters', async () => {
      // ✅ FIX 1: Complete WordNode object with all required properties
      const mockUpdatedWord = {
        id: 'word1',
        word: 'test',
        createdBy: 'user-123', // ✅ Added required property
        publicCredit: true, // ✅ Added required property
        liveDefinition: 'Updated definition',
        inclusionPositiveVotes: 0, // ✅ Added voting properties
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };
      wordService.updateWord.mockResolvedValue(mockUpdatedWord);

      const result = await controller.updateWord('test', {
        liveDefinition: 'Updated definition',
      });

      expect(wordService.updateWord).toHaveBeenCalledWith('test', {
        liveDefinition: 'Updated definition',
      });
      expect(result).toEqual(mockUpdatedWord);
    });

    it('should throw exception for empty word parameter', async () => {
      await expect(
        controller.updateWord('', { liveDefinition: 'test' }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteWord', () => {
    it('should call service.deleteWord', async () => {
      wordService.deleteWord.mockResolvedValue({ success: true });

      const result = await controller.deleteWord('test');

      expect(wordService.deleteWord).toHaveBeenCalledWith('test');
      expect(result).toEqual({ success: true });
    });

    it('should throw exception for empty word parameter', async () => {
      await expect(controller.deleteWord('')).rejects.toThrow(HttpException);
    });
  });

  describe('voteWord', () => {
    it('should call service.voteWord with correct parameters', async () => {
      const mockReq = { user: { sub: 'user1' } };
      const voteData = { isPositive: true };
      wordService.voteWord.mockResolvedValue(mockVoteResult);

      const result = await controller.voteWord('test', voteData, mockReq);

      expect(wordService.voteWord).toHaveBeenCalledWith('test', 'user1', true);
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw exception when user is not authenticated', async () => {
      const mockReq = { user: {} };
      const voteData = { isPositive: true };

      await expect(
        controller.voteWord('test', voteData, mockReq),
      ).rejects.toThrow(HttpException);
    });

    it('should throw exception for empty word parameter', async () => {
      const mockReq = { user: { sub: 'user1' } };
      const voteData = { isPositive: true };

      await expect(controller.voteWord('', voteData, mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getWordVoteStatus', () => {
    it('should call service.getWordVoteStatus', async () => {
      const mockReq = { user: { sub: 'user1' } };
      wordService.getWordVoteStatus.mockResolvedValue(mockVoteStatus);

      const result = await controller.getWordVoteStatus('test', mockReq);

      expect(wordService.getWordVoteStatus).toHaveBeenCalledWith(
        'test',
        'user1',
      );
      expect(result).toEqual(mockVoteStatus);
    });

    it('should throw exception when user is not authenticated', async () => {
      const mockReq = { user: {} };

      await expect(
        controller.getWordVoteStatus('test', mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('removeWordVote', () => {
    it('should call service.removeWordVote', async () => {
      const mockReq = { user: { sub: 'user1' } };
      wordService.removeWordVote.mockResolvedValue(mockVoteResult);

      const result = await controller.removeWordVote('test', mockReq);

      expect(wordService.removeWordVote).toHaveBeenCalledWith('test', 'user1');
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw exception when user is not authenticated', async () => {
      const mockReq = { user: {} };

      await expect(controller.removeWordVote('test', mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getWordVotes', () => {
    it('should call service.getWordVotes', async () => {
      wordService.getWordVotes.mockResolvedValue(mockVoteResult);

      const result = await controller.getWordVotes('test');

      expect(wordService.getWordVotes).toHaveBeenCalledWith('test');
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw exception for empty word parameter', async () => {
      await expect(controller.getWordVotes('')).rejects.toThrow(HttpException);
    });
  });

  describe('setWordVisibilityPreference', () => {
    it('should call service.setWordVisibilityPreference', async () => {
      const mockReq = { user: { sub: 'user1' } };
      const visibilityData = { isVisible: false };
      // ✅ FIX 2: Use correct 'user' literal type instead of string
      const mockResult = {
        isVisible: false,
        source: 'user' as const, // ✅ Fixed: Use literal type
        timestamp: Date.now(),
      };
      wordService.setWordVisibilityPreference.mockResolvedValue(mockResult);

      const result = await controller.setWordVisibilityPreference(
        'word1',
        visibilityData,
        mockReq,
      );

      expect(wordService.setWordVisibilityPreference).toHaveBeenCalledWith(
        'user1',
        'word1',
        false,
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw exception when user is not authenticated', async () => {
      const mockReq = { user: {} };
      const visibilityData = { isVisible: false };

      await expect(
        controller.setWordVisibilityPreference(
          'word1',
          visibilityData,
          mockReq,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should throw exception for empty word ID', async () => {
      const mockReq = { user: { sub: 'user1' } };
      const visibilityData = { isVisible: false };

      await expect(
        controller.setWordVisibilityPreference('', visibilityData, mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getWordVisibilityStatus', () => {
    it('should call service.getWordVisibilityForUser for authenticated users', async () => {
      const mockReq = { user: { sub: 'user1' } };
      wordService.getWordVisibilityForUser.mockResolvedValue(true);

      const result = await controller.getWordVisibilityStatus('word1', mockReq);

      expect(wordService.getWordVisibilityForUser).toHaveBeenCalledWith(
        'word1',
        'user1',
      );
      expect(result).toEqual({ isVisible: true });
    });

    it('should call service.getWordVisibilityForUser for anonymous users', async () => {
      const mockReq = {};
      wordService.getWordVisibilityForUser.mockResolvedValue(false);

      const result = await controller.getWordVisibilityStatus('word1', mockReq);

      expect(wordService.getWordVisibilityForUser).toHaveBeenCalledWith(
        'word1',
        undefined,
      );
      expect(result).toEqual({ isVisible: false });
    });

    it('should throw exception for empty word ID', async () => {
      const mockReq = { user: { sub: 'user1' } };

      await expect(
        controller.getWordVisibilityStatus('', mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getApprovedWords', () => {
    it('should call service.getApprovedWords with query parameters', async () => {
      const mockWords = [mockWordData];
      wordService.getApprovedWords.mockResolvedValue(mockWords);

      const result = await controller.getApprovedWords(50, 10, 'votes', 'desc');

      expect(wordService.getApprovedWords).toHaveBeenCalledWith({
        limit: 50,
        offset: 10,
        sortBy: 'votes',
        sortDirection: 'desc',
      });
      expect(result).toEqual(mockWords);
    });

    it('should work without query parameters', async () => {
      const mockWords = [mockWordData];
      wordService.getApprovedWords.mockResolvedValue(mockWords);

      const result = await controller.getApprovedWords();

      expect(wordService.getApprovedWords).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        sortBy: undefined,
        sortDirection: undefined,
      });
      expect(result).toEqual(mockWords);
    });
  });

  describe('checkWordAvailabilityForDefinitionCreation', () => {
    it('should call service.isWordAvailableForDefinitionCreation', async () => {
      wordService.isWordAvailableForDefinitionCreation.mockResolvedValue(true);

      const result =
        await controller.checkWordAvailabilityForDefinitionCreation('test');

      expect(
        wordService.isWordAvailableForDefinitionCreation,
      ).toHaveBeenCalledWith('test');
      expect(result).toEqual({ isAvailable: true });
    });

    it('should throw exception for empty word parameter', async () => {
      await expect(
        controller.checkWordAvailabilityForDefinitionCreation(''),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('checkWordAvailabilityForCategoryComposition', () => {
    it('should call service.isWordAvailableForCategoryComposition', async () => {
      wordService.isWordAvailableForCategoryComposition.mockResolvedValue(
        false,
      );

      const result =
        await controller.checkWordAvailabilityForCategoryComposition('word1');

      expect(
        wordService.isWordAvailableForCategoryComposition,
      ).toHaveBeenCalledWith('word1');
      expect(result).toEqual({ isAvailable: false });
    });

    it('should throw exception for empty word ID parameter', async () => {
      await expect(
        controller.checkWordAvailabilityForCategoryComposition(''),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getWordCount', () => {
    it('should call service.checkWords', async () => {
      wordService.checkWords.mockResolvedValue({ count: 42 });

      const result = await controller.getWordCount();

      expect(wordService.checkWords).toHaveBeenCalled();
      expect(result).toEqual({ count: 42 });
    });
  });

  describe('getWordWithDiscussion', () => {
    it('should call service.getWord and return word with discussion', async () => {
      const mockWordWithDiscussion = {
        id: 'word1',
        word: 'test',
        discussionId: 'disc1',
        discussion: mockDiscussionData,
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
      // ✅ FIX 3: Complete WordNode object with all required properties
      const mockWord = {
        id: 'word1',
        word: 'test',
        createdBy: 'user-123', // ✅ Added required property
        publicCredit: true, // ✅ Added required property
        inclusionPositiveVotes: 0, // ✅ Added voting properties
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        discussionId: 'disc1',
      };

      // ✅ FIXED: Complete CommentData array
      const mockComments: CommentData[] = [
        {
          ...mockCommentData,
          id: 'comment1',
          commentText: 'Comment 1',
          createdBy: 'user1',
        },
        {
          ...mockCommentData,
          id: 'comment2',
          commentText: 'Comment 2',
          createdBy: 'user2',
        },
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

      // ✅ FIXED: Complete CommentData object
      const mockCreatedComment: CommentData = {
        ...mockCommentData,
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'disc1',
        commentText: 'Test comment',
        createdAt: new Date(),
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
      // ✅ FIX 3: Complete WordNode object with all required properties
      const mockWord = {
        id: 'word1',
        word: 'test',
        createdBy: 'user-123', // ✅ Added required property
        publicCredit: true, // ✅ Added required property
        inclusionPositiveVotes: 0, // ✅ Added voting properties
        inclusionNegativeVotes: 0,
        inclusionNetVotes: 0,
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
        // No discussionId
      };

      // ✅ FIXED: Complete DiscussionData object
      const mockCreatedDiscussion: DiscussionData = {
        id: 'new-disc1',
        createdBy: 'user1',
        associatedNodeId: 'word1',
        associatedNodeType: 'WordNode',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ FIXED: Complete CommentData object
      const mockCreatedComment: CommentData = {
        ...mockCommentData,
        id: 'comment1',
        createdBy: 'user1',
        discussionId: 'new-disc1',
        commentText: 'Test comment',
        createdAt: new Date(),
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
