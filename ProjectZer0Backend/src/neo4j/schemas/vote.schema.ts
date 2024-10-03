// src/neo4j/schemas/vote.schema.ts
import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

@Injectable()
export class VoteSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  private async createBaseVote(voteData: {
    userId: string;
    targetId: string;
    targetType: string;
    voteType: 'singleChoice' | 'boolean' | 'quantityChoice';
    value: number | boolean;
  }) {
    const result = await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MATCH (t {id: $targetId})
      WHERE t:BeliefNode OR t:CommentNode OR t:DefinitionNode
      MERGE (u)-[v:VOTED_ON]->(t)
      ON CREATE SET 
        v.createdAt = datetime(),
        v.voteType = $voteType,
        v.value = $value
      ON MATCH SET 
        v.updatedAt = datetime(),
        v.voteType = $voteType,
        v.value = $value
      RETURN v
    `,
      voteData,
    );
    return result.records[0].get('v').properties;
  }

  async createSingleChoiceVote(
    userId: string,
    targetId: string,
    targetType: string,
  ) {
    return this.createBaseVote({
      userId,
      targetId,
      targetType,
      voteType: 'singleChoice',
      value: 1,
    });
  }

  async createBooleanVote(
    userId: string,
    targetId: string,
    targetType: string,
    value: boolean,
  ) {
    return this.createBaseVote({
      userId,
      targetId,
      targetType,
      voteType: 'boolean',
      value: value ? 1 : -1,
    });
  }

  async createQuantityChoiceVote(
    userId: string,
    targetId: string,
    targetType: string,
    value: number,
  ) {
    return this.createBaseVote({
      userId,
      targetId,
      targetType,
      voteType: 'quantityChoice',
      value,
    });
  }

  async getVoteTally(
    targetId: string,
    voteType: 'singleChoice' | 'boolean' | 'quantityChoice',
  ) {
    const result = await this.neo4jService.read(
      `
      MATCH (t {id: $targetId})<-[v:VOTED_ON {voteType: $voteType}]-()
      RETURN count(v) as totalVotes, sum(v.value) as voteSum, 
             avg(v.value) as voteAverage, collect(v.value) as allVotes
    `,
      { targetId, voteType },
    );
    return result.records[0].toObject();
  }

  // ... other methods for retrieving and managing votes ...
}
