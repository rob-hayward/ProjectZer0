// src/nodes/category/category.module.ts

import { Module, Logger } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CategorySchema } from '../../neo4j/schemas/category.schema';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [VoteModule, DiscussionModule, CommentModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategorySchema, VoteSchema, Logger],
  exports: [CategoryService, CategorySchema],
})
export class CategoryModule {}
