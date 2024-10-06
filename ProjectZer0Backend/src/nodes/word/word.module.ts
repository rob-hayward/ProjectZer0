// src/nodes/word/word.module.ts

import { Module } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';

@Module({
  controllers: [WordController],
  providers: [WordService, WordSchema],
  exports: [WordService],
})
export class WordModule {}
