// src/nodes/word/word.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WordService } from './word.service';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

// Define standardized DTO for word creation
interface CreateWordDto {
  word: string;
  definitionText?: string;
  discussion?: string;
  publicCredit: boolean;
  shareToX?: boolean; // For social media sharing
  createdBy: string;
}

@Controller('nodes/word')
@UseGuards(JwtAuthGuard)
export class WordController {
  private readonly logger = new Logger(WordController.name);

  constructor(
    private readonly wordService: WordService,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

  // IMPORTANT: The 'all' route must be defined before any parameterized routes
  // to ensure proper routing in NestJS
  @Get('all')
  async getAllWords() {
    this.logger.log('Received request to get all words');

    try {
      // Get words directly from the service
      const words = await this.wordService.getAllWords();

      // Add detailed logging
      if (words && words.length > 0) {
        this.logger.debug(`Found ${words.length} words in database`);
        this.logger.debug(
          `Sample words: ${words
            .slice(0, 5)
            .map((w) => w.word)
            .join(', ')}...`,
        );
      } else {
        this.logger.warn('No words found in database');
      }

      // Return the words array directly
      return words;
    } catch (error) {
      this.logger.error(
        `Error getting all words: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('check/:word')
  async checkWordExistence(@Param('word') word: string) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Checking existence of word: ${word}`);
    const exists = await this.wordService.checkWordExistence(word);
    this.logger.debug(`Word '${word}' exists: ${exists}`);
    return { exists };
  }

  @Post()
  async createWord(@Body() wordData: CreateWordDto) {
    if (!wordData.word) {
      throw new HttpException('Word is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Creating word: ${wordData.word}`);

    try {
      // Ensure we're using definitionText consistently
      const createdWord = await this.wordService.createWord({
        word: wordData.word,
        createdBy: wordData.createdBy,
        definitionText: wordData.definitionText,
        discussion: wordData.discussion,
        publicCredit: wordData.publicCredit,
      });

      this.logger.debug(`Created word: ${JSON.stringify(createdWord)}`);
      return createdWord;
    } catch (error) {
      this.logger.error(`Error creating word: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to create word: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':word')
  async getWord(@Param('word') word: string) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting word: ${word}`);
    const fetchedWord = await this.wordService.getWord(word.toLowerCase());

    if (!fetchedWord) {
      this.logger.debug(`Word not found: ${word}`);
      return null;
    }

    return fetchedWord;
  }

  @Put(':word')
  async updateWord(@Param('word') word: string, @Body() updateData: any) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(
      `Updating word: ${word} with data: ${JSON.stringify(updateData)}`,
    );

    const updatedWord = await this.wordService.updateWord(word, updateData);
    this.logger.debug(`Updated word: ${JSON.stringify(updatedWord)}`);
    return updatedWord;
  }

  @Delete(':word')
  async deleteWord(@Param('word') word: string) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Deleting word: ${word}`);
    const result = await this.wordService.deleteWord(word);
    this.logger.debug(`Deleted word: ${word}`);
    return result;
  }

  @Post(':word/vote')
  async voteWord(
    @Param('word') word: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(
      `Voting on word: ${word} with value: ${voteData.isPositive}`,
    );

    const result = await this.wordService.voteWord(
      word,
      req.user.sub,
      voteData.isPositive,
    );

    this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
    return result;
  }

  @Get(':word/vote')
  async getWordVoteStatus(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Getting vote status for word: ${word}`);

    const status = await this.wordService.getWordVoteStatus(word, req.user.sub);
    this.logger.debug(`Vote status: ${JSON.stringify(status)}`);
    return status;
  }

  @Post(':word/vote/remove')
  async removeWordVote(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!req.user?.sub) {
      throw new HttpException('User ID is required', HttpStatus.UNAUTHORIZED);
    }

    this.logger.debug(`Removing vote for word: ${word}`);

    const result = await this.wordService.removeWordVote(word, req.user.sub);
    this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
    return result;
  }

  @Get(':word/votes')
  async getWordVotes(@Param('word') word: string): Promise<VoteResult | null> {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting votes for word: ${word}`);

    const votes = await this.wordService.getWordVotes(word);
    this.logger.debug(`Votes: ${JSON.stringify(votes)}`);
    return votes;
  }

  @Put(':wordId/visibility')
  async setWordVisibilityStatus(
    @Param('wordId') wordId: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    if (!wordId) {
      throw new HttpException('Word ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Setting visibility for word ${wordId}: ${visibilityData.isVisible}`,
    );

    const updatedWord = await this.wordService.setWordVisibilityStatus(
      wordId,
      visibilityData.isVisible,
    );

    this.logger.debug(
      `Updated word visibility: ${JSON.stringify(updatedWord)}`,
    );
    return updatedWord;
  }

  @Get(':wordId/visibility')
  async getWordVisibilityStatus(@Param('wordId') wordId: string) {
    if (!wordId) {
      throw new HttpException('Word ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting visibility status for word ${wordId}`);

    const visibilityStatus =
      await this.wordService.getWordVisibilityStatus(wordId);

    this.logger.debug(`Visibility status: ${visibilityStatus}`);
    return { visibilityStatus };
  }

  // New endpoints for discussions and comments
  @Get(':word/discussion')
  async getWordWithDiscussion(@Param('word') word: string) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting word with discussion: ${word}`);
    const wordNode = await this.wordService.getWord(word.toLowerCase());

    if (!wordNode) {
      this.logger.debug(`Word not found: ${word}`);
      return null;
    }

    return wordNode; // The getWord method already includes discussion info
  }

  @Get(':word/comments')
  async getWordComments(@Param('word') word: string) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Getting comments for word: ${word}`);
    const wordNode = await this.wordService.getWord(word.toLowerCase());

    if (!wordNode) {
      this.logger.debug(`Word not found: ${word}`);
      return { comments: [] };
    }

    if (!wordNode.discussionId) {
      return { comments: [] };
    }

    const comments = await this.commentService.getCommentsByDiscussionId(
      wordNode.discussionId,
    );
    return { comments };
  }

  @Post(':word/comments')
  async addWordComment(
    @Param('word') word: string,
    @Body() commentData: { commentText: string; parentCommentId?: string },
    @Request() req: any,
  ) {
    if (!word) {
      throw new HttpException(
        'Word parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!commentData.commentText || commentData.commentText.trim() === '') {
      throw new HttpException(
        'Comment text is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.debug(`Adding comment to word: ${word}`);
    const wordNode = await this.wordService.getWord(word.toLowerCase());

    if (!wordNode) {
      this.logger.debug(`Word not found: ${word}`);
      throw new HttpException(`Word "${word}" not found`, HttpStatus.NOT_FOUND);
    }

    // If no discussion exists, create one
    let discussionId = wordNode.discussionId;

    if (!discussionId) {
      const discussion = await this.discussionService.createDiscussion({
        createdBy: req.user.sub,
        associatedNodeId: wordNode.id,
        associatedNodeType: 'WordNode',
      });

      discussionId = discussion.id;

      // Update word with discussion ID
      await this.wordService.updateWord(word, { discussionId });
    }

    // Create the comment
    const comment = await this.commentService.createComment({
      createdBy: req.user.sub,
      discussionId,
      commentText: commentData.commentText,
      parentCommentId: commentData.parentCommentId,
    });

    return comment;
  }
}
