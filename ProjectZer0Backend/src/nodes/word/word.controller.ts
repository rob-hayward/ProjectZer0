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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WordService } from './word.service';

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
      `Received request to create word: ${JSON.stringify(wordData)}`,
    );
    const createdWord = await this.wordService.createWord(wordData);
    this.logger.log(`Created word: ${JSON.stringify(createdWord)}`);
    return createdWord;
  }

  @Get(':word')
  async getWord(@Param('word') word: string) {
    this.logger.log(`Received request to get word: ${word}`);
    const fetchedWord = await this.wordService.getWord(word.toLowerCase());
    this.logger.log(`Fetched word: ${JSON.stringify(fetchedWord)}`);
    return fetchedWord;
  }

  @Put(':word')
  async updateWord(@Param('word') word: string, @Body() updateData: any) {
    this.logger.log(
      `Received request to update word: ${word} with data: ${JSON.stringify(updateData)}`,
    );
    const updatedWord = await this.wordService.updateWord(word, updateData);
    this.logger.log(`Updated word: ${JSON.stringify(updatedWord)}`);
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
    @Body() voteData: { userId: string; isPositive: boolean },
  ) {
    this.logger.log(
      `Received request to vote on word: ${word} with data: ${JSON.stringify(voteData)}`,
    );
    const result = await this.wordService.voteWord(
      word,
      voteData.userId,
      voteData.isPositive,
    );
    this.logger.log(`Vote result: ${JSON.stringify(result)}`);
    return result;
  }

  @Get(':word/votes')
  async getWordVotes(@Param('word') word: string) {
    this.logger.log(`Received request to get votes for word: ${word}`);
    const votes = await this.wordService.getWordVotes(word);
    this.logger.log(`Votes for word ${word}: ${JSON.stringify(votes)}`);
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
      `Updated word visibility status: ${JSON.stringify(updatedWord)}`,
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
