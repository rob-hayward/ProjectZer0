// src/nodes/statement/statement.module.ts
import { Module } from '@nestjs/common';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';
import { WordModule } from '../word/word.module';
import { VoteModule } from '../../neo4j/vote/vote.module';
import { VoteSchema } from '../../neo4j/schemas/vote.schema';
import { DiscussionModule } from '../discussion/discussion.module';
import { CommentModule } from '../comment/comment.module';
import { Neo4jModule } from '../../neo4j/neo4j.module'; // Add this

@Module({
  imports: [
    KeywordExtractionModule,
    WordModule,
    VoteModule,
    DiscussionModule,
    CommentModule,
    Neo4jModule, // Add this
  ],
  controllers: [StatementController],
  providers: [StatementService, StatementSchema, VoteSchema],
  exports: [StatementService],
})
export class StatementModule {}
