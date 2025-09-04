// src/nodes/word/word.module.ts

import { Module, Logger } from '@nestjs/common';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { WordSchema } from '../../neo4j/schemas/word.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { DictionaryModule } from '../../dictionary/dictionary.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { CategoryModule } from '../category/category.module'; // NEW: Added CategoryModule for future word categorization

@Module({
  imports: [
    DictionaryModule,
    DiscussionModule,
    CommentModule,
    VoteModule,
    CategoryModule, // NEW: Added for future word-to-category relationships
  ],
  controllers: [WordController],
  providers: [WordService, WordSchema, UserSchema, VoteSchema, Logger],
  exports: [WordService, WordSchema], // Enhanced exports to include WordSchema
})
export class WordModule {}
