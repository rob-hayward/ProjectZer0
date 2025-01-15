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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WordService } from './word.service';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';

@Controller('nodes/word')
@UseGuards(JwtAuthGuard)
export class WordController {
  private readonly logger = new Logger(WordController.name);

  constructor(private readonly wordService: WordService) {}

  @Get('check/:word')
  async checkWordExistence(@Param('word') word: string) {
    this.logger.log(`Received request to check word: ${word}`);
    const exists = await this.wordService.checkWordExistence(word);
    this.logger.log(`Word '${word}' exists: ${exists}`);
    return { exists };
  }

  @Post()
  async createWord(@Body() wordData: any) {
    this.logger.log(
      `Received request to create word: ${JSON.stringify(wordData, null, 2)}`,
    );
    try {
      const createdWord = await this.wordService.createWord(wordData);
      this.logger.log(`Created word: ${JSON.stringify(createdWord, null, 2)}`);
      return createdWord;
    } catch (error) {
      this.logger.error(`Error creating word: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get(':word')
  async getWord(@Param('word') word: string) {
    this.logger.log(`Received request to get word: ${word}`);
    const fetchedWord = await this.wordService.getWord(word.toLowerCase());
    this.logger.log(`Fetched word: ${JSON.stringify(fetchedWord, null, 2)}`);
    return fetchedWord;
  }

  @Put(':word')
  async updateWord(@Param('word') word: string, @Body() updateData: any) {
    this.logger.log(
      `Received request to update word: ${word} with data: ${JSON.stringify(updateData, null, 2)}`,
    );
    const updatedWord = await this.wordService.updateWord(word, updateData);
    this.logger.log(`Updated word: ${JSON.stringify(updatedWord, null, 2)}`);
    return updatedWord;
  }

  @Delete(':word')
  async deleteWord(@Param('word') word: string) {
    this.logger.log(`Received request to delete word: ${word}`);
    const result = await this.wordService.deleteWord(word);
    this.logger.log(`Deleted word: ${word}`);
    return result;
  }

  @Post(':word/vote')
  async voteWord(
    @Param('word') word: string,
    @Body() voteData: { isPositive: boolean },
    @Request() req: any,
  ): Promise<VoteResult> {
    this.logger.log(
      `Received request to vote on word: ${word} with data: ${JSON.stringify(voteData, null, 2)}`,
    );
    const result = await this.wordService.voteWord(
      word,
      req.user.sub,
      voteData.isPositive,
    );
    this.logger.log(`Vote result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  @Get(':word/vote')
  async getWordVoteStatus(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<VoteStatus | null> {
    this.logger.log(
      `Received request to get vote status for word: ${word} from user: ${req.user.sub}`,
    );
    const status = await this.wordService.getWordVoteStatus(word, req.user.sub);
    this.logger.log(
      `Vote status for word ${word}: ${JSON.stringify(status, null, 2)}`,
    );
    return status;
  }

  @Post(':word/vote/remove')
  async removeWordVote(
    @Param('word') word: string,
    @Request() req: any,
  ): Promise<VoteResult> {
    this.logger.log(
      `Received request to remove vote for word: ${word} from user: ${req.user.sub}`,
    );
    const result = await this.wordService.removeWordVote(word, req.user.sub);
    this.logger.log(`Remove vote result: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  @Get(':word/votes')
  async getWordVotes(@Param('word') word: string): Promise<VoteResult | null> {
    this.logger.log(`Received request to get votes for word: ${word}`);
    const votes = await this.wordService.getWordVotes(word);
    this.logger.log(
      `Votes for word ${word}: ${JSON.stringify(votes, null, 2)}`,
    );
    return votes;
  }

  @Put(':wordId/visibility')
  async setWordVisibilityStatus(
    @Param('wordId') wordId: string,
    @Body() visibilityData: { isVisible: boolean },
  ) {
    this.logger.log(
      `Received request to set visibility status for word ${wordId}: ${visibilityData.isVisible}`,
    );
    const updatedWord = await this.wordService.setWordVisibilityStatus(
      wordId,
      visibilityData.isVisible,
    );
    this.logger.log(
      `Updated word visibility status: ${JSON.stringify(updatedWord, null, 2)}`,
    );
    return updatedWord;
  }

  @Get(':wordId/visibility')
  async getWordVisibilityStatus(@Param('wordId') wordId: string) {
    this.logger.log(
      `Received request to get visibility status for word ${wordId}`,
    );
    const visibilityStatus =
      await this.wordService.getWordVisibilityStatus(wordId);
    this.logger.log(
      `Visibility status for word ${wordId}: ${visibilityStatus}`,
    );
    return { visibilityStatus };
  }
}
