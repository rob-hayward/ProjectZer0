import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeywordExtractionService } from './keyword-extraction.service';
import keywordExtractionConfig from './keyword-extraction.config';

@Module({
  imports: [ConfigModule.forFeature(keywordExtractionConfig)],
  providers: [KeywordExtractionService],
  exports: [KeywordExtractionService],
})
export class KeywordExtractionModule {}
