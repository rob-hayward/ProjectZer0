// src/neo4j/vote/vote.module.ts
import { Module } from '@nestjs/common';
import { VoteSchema } from '../schemas/vote.schema';

@Module({
  providers: [VoteSchema],
  exports: [VoteSchema],
})
export class VoteModule {}
