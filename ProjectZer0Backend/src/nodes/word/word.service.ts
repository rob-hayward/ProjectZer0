// src/nodes/word/word.service.ts
import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { DiscussionService } from '../discussion/discussion.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

@Injectable()
export class WordService {
  private readonly logger = new Logger(WordService.name);

  constructor(
    private readonly wordSchema: WordSchema,
    private readonly dictionaryService: DictionaryService,
    private readonly discussionService: DiscussionService,
  ) {}

  async checkWordExistence(word: string): Promise<boolean> {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Checking existence of word: ${word}`);
    try {
      const exists = await this.wordSchema.checkWordExistence(word);
      this.logger.debug(`Word '${word}' exists: ${exists}`);
      return exists;
    } catch (error) {
      this.logger.error(
        `Error checking word existence: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Error checking if word exists',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createWord(wordData: {
    word: string;
    createdBy: string;
    definitionText?: string;
    discussion?: string;
    publicCredit: boolean;
  }) {
    this.logger.log(`Creating word: ${JSON.stringify(wordData)}`);

    if (!wordData.word || wordData.word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    try {
      // Check if word already exists
      const exists = await this.checkWordExistence(wordData.word);
      if (exists) {
        this.logger.warn(`Attempted to create existing word: ${wordData.word}`);
        throw new ConflictException('Word already exists');
      }

      // Always attempt to get definition from API regardless of user input
      let freeDictionaryDefinition = null;
      try {
        freeDictionaryDefinition = await this.dictionaryService.getDefinition(
          wordData.word,
        );
        this.logger.debug(`API definition: ${freeDictionaryDefinition}`);
      } catch (error) {
        this.logger.warn(`Failed to get API definition: ${error.message}`);
        // Continue even if API definition fails
      }

      // Determine the primary definition
      const primaryDefinition =
        wordData.definitionText ||
        freeDictionaryDefinition ||
        'No definition available';

      this.logger.debug(
        `Using primary definition: "${primaryDefinition.substring(0, 30)}..."`,
      );

      // Create the word node with primary definition
      const wordNode = await this.wordSchema.createWord({
        word: wordData.word,
        createdBy: wordData.createdBy,
        initialDefinition: primaryDefinition,
        publicCredit: wordData.publicCredit,
      });

      // If user provided a definition AND API returned a different definition
      // Add the API definition as an alternative
      if (
        wordData.definitionText &&
        freeDictionaryDefinition &&
        freeDictionaryDefinition !== wordData.definitionText
      ) {
        try {
          this.logger.debug('Adding API definition as alternative definition');
          await this.wordSchema.addDefinition({
            word: wordData.word,
            createdBy: 'FreeDictionaryAPI',
            definitionText: freeDictionaryDefinition,
          });
        } catch (error) {
          this.logger.warn(`Failed to add API definition: ${error.message}`);
          // Continue even if adding the API definition fails
        }
      }

      // Create discussion if provided
      if (wordData.discussion) {
        try {
          this.logger.debug(`Creating discussion for word: ${wordData.word}`);
          const discussion = await this.discussionService.createDiscussion({
            createdBy: wordData.createdBy,
            associatedNodeId: wordNode.id,
            associatedNodeType: 'WordNode',
            initialComment: wordData.discussion,
          });

          await this.wordSchema.updateWordWithDiscussionId(
            wordNode.id,
            discussion.id,
          );
        } catch (error) {
          this.logger.warn(`Failed to create discussion: ${error.message}`);
          // Continue even if creating the discussion fails
        }
      }

      // Fetch and return the complete word node
      const completeWordNode = await this.getWord(wordData.word);
      return completeWordNode;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error in createWord: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to create word: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWord(word: string) {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Fetching word: ${word}`);

    try {
      const wordNode = await this.wordSchema.getWord(word.toLowerCase());
      if (!wordNode) {
        this.logger.debug(`Word not found: ${word}`);
        return null;
      }

      // Fetch associated discussion and comments
      if (wordNode.discussionId) {
        const discussion = await this.discussionService.getDiscussion(
          wordNode.discussionId,
        );
        wordNode.discussion = discussion;
        this.logger.debug(
          `Fetched discussion for word: ${JSON.stringify(discussion)}`,
        );
      }

      return wordNode;
    } catch (error) {
      this.logger.error(`Error in getWord: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to fetch word: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllWords() {
    this.logger.debug('Getting all words');
    try {
      const words = await this.wordSchema.getAllWords();
      this.logger.debug(`Retrieved ${words.length} words`);
      return words;
    } catch (error) {
      this.logger.error(`Error in getAllWords: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get all words: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateWord(word: string, updateData: any) {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Updating word: ${word} with data: ${JSON.stringify(updateData)}`,
    );

    try {
      const updatedWord = await this.wordSchema.updateWord(word, updateData);

      if (!updatedWord) {
        throw new NotFoundException(`Word "${word}" not found`);
      }

      this.logger.debug(`Updated word: ${JSON.stringify(updatedWord)}`);
      return updatedWord;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error in updateWord: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to update word: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteWord(word: string) {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Deleting word: ${word}`);

    try {
      const result = await this.wordSchema.deleteWord(word);
      this.logger.debug(`Deleted word: ${word}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in deleteWord: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to delete word: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async voteWord(
    word: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    if (!sub) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Voting on word: ${word} by user: ${sub}, isPositive: ${isPositive}`,
    );

    try {
      const result = await this.wordSchema.voteWord(word, sub, isPositive);
      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in voteWord: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to vote on word: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWordVotes(word: string): Promise<VoteResult | null> {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting votes for word: ${word}`);

    try {
      const votes = await this.wordSchema.getWordVotes(word);
      this.logger.debug(`Votes for word ${word}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(`Error in getWordVotes: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get word votes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWordVoteStatus(
    word: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    if (!sub) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting vote status for word: ${word} and user: ${sub}`);

    try {
      const status = await this.wordSchema.getWordVoteStatus(word, sub);
      this.logger.debug(
        `Vote status for word ${word} and user ${sub}: ${JSON.stringify(status)}`,
      );
      return status;
    } catch (error) {
      this.logger.error(
        `Error in getWordVoteStatus: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get word vote status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeWordVote(word: string, sub: string): Promise<VoteResult> {
    if (!word || word.trim() === '') {
      throw new HttpException('Word cannot be empty', HttpStatus.BAD_REQUEST);
    }

    if (!sub) {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Removing vote on word: ${word} by user: ${sub}`);

    try {
      const result = await this.wordSchema.removeWordVote(word, sub);
      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error in removeWordVote: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to remove word vote: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async setWordVisibilityStatus(wordId: string, isVisible: boolean) {
    if (!wordId) {
      throw new HttpException('Word ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(
      `Setting visibility status for word ${wordId}: ${isVisible}`,
    );

    try {
      const updatedWord = await this.wordSchema.setVisibilityStatus(
        wordId,
        isVisible,
      );
      this.logger.debug(
        `Updated word visibility status: ${JSON.stringify(updatedWord)}`,
      );
      return updatedWord;
    } catch (error) {
      this.logger.error(
        `Error in setWordVisibilityStatus: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to set word visibility status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWordVisibilityStatus(wordId: string) {
    if (!wordId) {
      throw new HttpException('Word ID is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.debug(`Getting visibility status for word ${wordId}`);

    try {
      const visibilityStatus =
        await this.wordSchema.getVisibilityStatus(wordId);
      this.logger.debug(
        `Visibility status for word ${wordId}: ${visibilityStatus}`,
      );
      return visibilityStatus;
    } catch (error) {
      this.logger.error(
        `Error in getWordVisibilityStatus: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get word visibility status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
