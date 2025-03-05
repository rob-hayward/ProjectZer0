// src/nodes/word/word.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
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
    this.logger.log(`Checking existence of word: ${word}`);
    const exists = await this.wordSchema.checkWordExistence(word);
    this.logger.log(`Word '${word}' exists: ${exists}`);
    return exists;
  }

  async createWord(wordData: {
    word: string;
    createdBy: string;
    definitionText?: string;
    discussion?: string;
    publicCredit: boolean;
  }) {
    this.logger.log(`Creating word: ${JSON.stringify(wordData, null, 2)}`);
    try {
      const exists = await this.checkWordExistence(wordData.word);
      if (exists) {
        this.logger.warn(`Attempted to create existing word: ${wordData.word}`);
        throw new HttpException('Word already exists', HttpStatus.CONFLICT);
      }

      const freeDictionaryDefinition =
        await this.dictionaryService.getDefinition(wordData.word);
      this.logger.log(
        `Free Dictionary definition: ${freeDictionaryDefinition}`,
      );

      // Determine the primary definition
      // If user provided a definition, it becomes the primary
      // Otherwise use the API definition or a fallback
      const primaryDefinition =
        wordData.definitionText ||
        freeDictionaryDefinition ||
        'No definition available';

      this.logger.log(
        `Using primary definition: "${primaryDefinition.substring(0, 30)}..."`,
      );
      this.logger.log(
        `Definition source: ${wordData.definitionText ? 'User' : freeDictionaryDefinition ? 'API' : 'Default'}`,
      );

      // Create the word node with primary definition
      const wordNode = await this.wordSchema.createWord({
        word: wordData.word,
        createdBy: wordData.createdBy,
        initialDefinition: primaryDefinition,
        publicCredit: wordData.publicCredit,
      });
      this.logger.log(
        `Created word node: ${JSON.stringify(wordNode, null, 2)}`,
      );

      // If user provided a definition AND API returned a different definition
      // Add the API definition as an alternative
      if (
        wordData.definitionText &&
        freeDictionaryDefinition &&
        freeDictionaryDefinition !== wordData.definitionText
      ) {
        try {
          this.logger.log('Adding API definition as alternative definition');
          const freeDefinition = await this.wordSchema.addDefinition({
            word: wordData.word,
            createdBy: 'FreeDictionaryAPI',
            definitionText: freeDictionaryDefinition,
          });
          this.logger.log(
            `Added API definition as alternative: ${JSON.stringify(freeDefinition, null, 2)}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to add API definition: ${error.message}`);
        }
      }

      // Create discussion if provided
      if (wordData.discussion) {
        try {
          this.logger.log(`Creating discussion for word: ${wordData.word}`);
          const discussion = await this.discussionService.createDiscussion({
            createdBy: wordData.createdBy,
            associatedNodeId: wordNode.id,
            associatedNodeType: 'WordNode',
            initialComment: wordData.discussion,
          });
          this.logger.log(
            `Created discussion: ${JSON.stringify(discussion, null, 2)}`,
          );

          await this.wordSchema.updateWordWithDiscussionId(
            wordNode.id,
            discussion.id,
          );
          this.logger.log(
            `Updated word node with discussion ID: ${discussion.id}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to create discussion: ${error.message}`);
        }
      }

      // Fetch and return the complete word node
      const completeWordNode = await this.getWord(wordData.word);
      this.logger.log(
        `Fetched complete word node: ${JSON.stringify(completeWordNode, null, 2)}`,
      );
      return completeWordNode;
    } catch (error) {
      this.logger.error(`Error in createWord: ${error.message}`);
      this.logger.error(error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create word',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWord(word: string) {
    this.logger.log(`Fetching word: ${word}`);
    try {
      const wordNode = await this.wordSchema.getWord(word.toLowerCase());
      if (!wordNode) {
        this.logger.warn(`Word not found: ${word}`);
        return null;
      }

      // Fetch associated discussion and comments
      if (wordNode.discussionId) {
        const discussion = await this.discussionService.getDiscussion(
          wordNode.discussionId,
        );
        wordNode.discussion = discussion;
        this.logger.log(
          `Fetched discussion for word: ${JSON.stringify(discussion, null, 2)}`,
        );
      }

      this.logger.log(
        `Fetched word node: ${JSON.stringify(wordNode, null, 2)}`,
      );
      return wordNode;
    } catch (error) {
      this.logger.error(`Error in getWord: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to fetch word',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateWord(word: string, updateData: any) {
    this.logger.log(
      `Updating word: ${word} with data: ${JSON.stringify(updateData, null, 2)}`,
    );
    try {
      const updatedWord = await this.wordSchema.updateWord(word, updateData);
      this.logger.log(`Updated word: ${JSON.stringify(updatedWord, null, 2)}`);
      return updatedWord;
    } catch (error) {
      this.logger.error(`Error in updateWord: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to update word',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteWord(word: string) {
    this.logger.log(`Deleting word: ${word}`);
    try {
      const result = await this.wordSchema.deleteWord(word);
      this.logger.log(`Deleted word: ${word}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in deleteWord: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to delete word',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async voteWord(
    word: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.logger.log(
      `Voting on word: ${word} by user: ${sub}, isPositive: ${isPositive}`,
    );
    try {
      const result = await this.wordSchema.voteWord(word, sub, isPositive);
      this.logger.log(`Vote result: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in voteWord: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to vote on word',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWordVotes(word: string): Promise<VoteResult | null> {
    this.logger.log(`Getting votes for word: ${word}`);
    try {
      const votes = await this.wordSchema.getWordVotes(word);
      this.logger.log(
        `Votes for word ${word}: ${JSON.stringify(votes, null, 2)}`,
      );
      return votes;
    } catch (error) {
      this.logger.error(`Error in getWordVotes: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to get word votes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWordVoteStatus(
    word: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    this.logger.log(`Getting vote status for word: ${word} and user: ${sub}`);
    try {
      const status = await this.wordSchema.getWordVoteStatus(word, sub);
      this.logger.log(
        `Vote status for word ${word} and user ${sub}: ${JSON.stringify(status, null, 2)}`,
      );
      return status;
    } catch (error) {
      this.logger.error(`Error in getWordVoteStatus: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to get word vote status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeWordVote(word: string, sub: string): Promise<VoteResult> {
    this.logger.log(`Removing vote on word: ${word} by user: ${sub}`);
    try {
      const result = await this.wordSchema.removeWordVote(word, sub);
      this.logger.log(`Remove vote result: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in removeWordVote: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to remove word vote',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async setWordVisibilityStatus(wordId: string, isVisible: boolean) {
    this.logger.log(
      `Setting visibility status for word ${wordId}: ${isVisible}`,
    );
    try {
      const updatedWord = await this.wordSchema.setVisibilityStatus(
        wordId,
        isVisible,
      );
      this.logger.log(
        `Updated word visibility status: ${JSON.stringify(updatedWord, null, 2)}`,
      );
      return updatedWord;
    } catch (error) {
      this.logger.error(`Error in setWordVisibilityStatus: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to set word visibility status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getWordVisibilityStatus(wordId: string) {
    this.logger.log(`Getting visibility status for word ${wordId}`);
    try {
      const visibilityStatus =
        await this.wordSchema.getVisibilityStatus(wordId);
      this.logger.log(
        `Visibility status for word ${wordId}: ${visibilityStatus}`,
      );
      return visibilityStatus;
    } catch (error) {
      this.logger.error(`Error in getWordVisibilityStatus: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Failed to get word visibility status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
