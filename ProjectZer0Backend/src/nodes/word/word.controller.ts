import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { WordService } from './word.service';

@Controller('nodes/word')
@UseGuards(JwtAuthGuard)
export class WordController {
  constructor(private readonly wordService: WordService) {}

  @Get('check/:word')
  async checkWordExistence(@Param('word') word: string) {
    const exists = await this.wordService.checkWordExistence(word);
    return { exists };
  }

  @Post()
  async createWord(@Body() wordData: any) {
    return this.wordService.createWord(wordData);
  }

  @Get(':word')
  async getWord(@Param('word') word: string) {
    return this.wordService.getWord(word);
  }

  @Put(':word')
  async updateWord(@Param('word') word: string, @Body() updateData: any) {
    return this.wordService.updateWord(word, updateData);
  }

  @Delete(':word')
  async deleteWord(@Param('word') word: string) {
    return this.wordService.deleteWord(word);
  }

  @Post(':word/vote')
  async voteWord(
    @Param('word') word: string,
    @Body() voteData: { userId: string; isPositive: boolean },
  ) {
    return this.wordService.voteWord(
      word,
      voteData.userId,
      voteData.isPositive,
    );
  }

  @Get(':word/votes')
  async getWordVotes(@Param('word') word: string) {
    return this.wordService.getWordVotes(word);
  }
}
