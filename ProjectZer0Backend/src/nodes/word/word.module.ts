import { Module } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { DictionaryModule } from '../../dictionary/dictionary.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [DictionaryModule, DiscussionModule, CommentModule],
  controllers: [WordController],
  providers: [WordService, WordSchema],
  exports: [WordService],
})
export class WordModule {}
