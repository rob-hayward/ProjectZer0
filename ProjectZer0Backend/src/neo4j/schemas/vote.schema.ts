// src/neo4j/schemas/vote.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

export interface VoteStatus {
  status: 'agree' | 'disagree' | null;
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
}

export interface VoteResult {
  positiveVotes: number;
  negativeVotes: number;
  netVotes: number;
}

@Injectable()
export class VoteSchema {
  private readonly logger = new Logger(VoteSchema.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async getVoteStatus(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
  ): Promise<VoteStatus | null> {
    const nodeKey = Object.keys(nodeIdentifier)[0];
    const nodeValue = nodeIdentifier[nodeKey];

    const result = await this.neo4jService.read(
      `
      MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
      WITH n
      OPTIONAL MATCH (u:User {sub: $sub})-[v:VOTED_ON]->(n)
      RETURN n.positiveVotes as positiveVotes,
             n.negativeVotes as negativeVotes,
             n.netVotes as netVotes,
             v.status as status,
             u IS NOT NULL as userExists
      `,
      { nodeValue, sub },
    );

    if (!result.records.length) return null;

    const record = result.records[0];
    const status = record.get('status');
    const userExists = record.get('userExists');

    // If user doesn't exist, create them
    if (!userExists && sub) {
      await this.neo4jService.write(`MERGE (u:User {sub: $sub})`, { sub });
    }

    return {
      status: status as 'agree' | 'disagree' | null,
      positiveVotes: this.toNumber(record.get('positiveVotes')),
      negativeVotes: this.toNumber(record.get('negativeVotes')),
      netVotes: this.toNumber(record.get('netVotes')),
    };
  }

  async vote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      const nodeKey = Object.keys(nodeIdentifier)[0];
      const nodeValue = nodeIdentifier[nodeKey];

      const result = await this.neo4jService.write(
        `
        MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
        MERGE (u:User {sub: $sub})
        WITH n, u
        OPTIONAL MATCH (u)-[oldVote:VOTED_ON]->(n)
        WITH n, u, oldVote,
             CASE WHEN oldVote.status = 'agree' THEN -1 ELSE 0 END as oldPosAdjust,
             CASE WHEN oldVote.status = 'disagree' THEN -1 ELSE 0 END as oldNegAdjust
        DELETE oldVote
        
        // First, create new vote relationship
        CREATE (u)-[v:VOTED_ON]->(n)
        SET v.status = $status,
            v.createdAt = datetime()
        
        // Update positive and negative vote counts
        WITH n, u, v, oldPosAdjust, oldNegAdjust
        SET n.positiveVotes = COALESCE(n.positiveVotes, 0) + oldPosAdjust + CASE WHEN $isPositive THEN 1 ELSE 0 END,
            n.negativeVotes = COALESCE(n.negativeVotes, 0) + oldNegAdjust + CASE WHEN $isPositive THEN 0 ELSE 1 END
        
        // Calculate net votes based on the updated positive and negative counts
        WITH n
        SET n.netVotes = n.positiveVotes - n.negativeVotes
        
        RETURN n.positiveVotes as positiveVotes, 
               n.negativeVotes as negativeVotes, 
               n.netVotes as netVotes
        `,
        {
          nodeValue,
          sub,
          isPositive,
          status: isPositive ? 'agree' : 'disagree',
        },
      );

      // Handle numeric conversions for Neo4j integers
      const voteResult = {
        positiveVotes: this.toNumber(result.records[0].get('positiveVotes')),
        negativeVotes: this.toNumber(result.records[0].get('negativeVotes')),
        netVotes: this.toNumber(result.records[0].get('netVotes')),
      };

      return voteResult;
    } catch (error) {
      this.logger.error(`Error in vote for ${nodeLabel}: ${error.message}`);
      throw new Error(`Failed to vote on ${nodeLabel}: ${error.message}`);
    }
  }

  async removeVote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
  ): Promise<VoteResult> {
    try {
      const nodeKey = Object.keys(nodeIdentifier)[0];
      const nodeValue = nodeIdentifier[nodeKey];

      const result = await this.neo4jService.write(
        `
        MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
        MATCH (u:User {sub: $sub})-[v:VOTED_ON]->(n)
        WITH n, v, 
             CASE WHEN v.status = 'agree' THEN -1 ELSE 0 END as posAdjust,
             CASE WHEN v.status = 'disagree' THEN -1 ELSE 0 END as negAdjust
        
        // Delete the vote relationship
        DELETE v
        
        // Update positive and negative vote counts
        SET n.positiveVotes = COALESCE(n.positiveVotes, 0) + posAdjust,
            n.negativeVotes = COALESCE(n.negativeVotes, 0) + negAdjust
        
        // Calculate net votes based on the updated positive and negative counts
        WITH n
        SET n.netVotes = n.positiveVotes - n.negativeVotes
        
        RETURN n.positiveVotes as positiveVotes, 
               n.negativeVotes as negativeVotes, 
               n.netVotes as netVotes
        `,
        { nodeValue, sub },
      );

      // Handle numeric conversions for Neo4j integers
      const voteResult = {
        positiveVotes: this.toNumber(result.records[0].get('positiveVotes')),
        negativeVotes: this.toNumber(result.records[0].get('negativeVotes')),
        netVotes: this.toNumber(result.records[0].get('netVotes')),
      };

      return voteResult;
    } catch (error) {
      this.logger.error(
        `Error removing vote for ${nodeLabel}: ${error.message}`,
      );
      throw new Error(
        `Failed to remove vote from ${nodeLabel}: ${error.message}`,
      );
    }
  }

  /**
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle Neo4j integer objects
    if (typeof value === 'object' && value !== null) {
      if ('low' in value) {
        return Number(value.low);
      } else if ('valueOf' in value) {
        return Number(value.valueOf());
      }
    }

    return Number(value);
  }
}
