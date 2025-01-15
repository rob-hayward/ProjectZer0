import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';

export interface VoteStatus {
  status: 'agree' | 'disagree' | null;
  positiveVotes: number;
  negativeVotes: number;
}

export interface VoteResult {
  positiveVotes: number;
  negativeVotes: number;
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

    this.logger.log(
      `Getting vote status for ${nodeLabel} with ${nodeKey}: ${nodeValue} by user: ${sub}`,
    );

    const result = await this.neo4jService.read(
      `
      MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
      WITH n
      OPTIONAL MATCH (u:User {sub: $sub})-[v:VOTED_ON]->(n)
      RETURN n.positiveVotes as positiveVotes,
             n.negativeVotes as negativeVotes,
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
    if (!userExists) {
      await this.neo4jService.write(`MERGE (u:User {sub: $sub})`, { sub });
    }

    this.logger.log(`Vote status result for ${nodeLabel} ${nodeValue}: `, {
      status,
      positiveVotes: record.get('positiveVotes'),
      negativeVotes: record.get('negativeVotes'),
    });

    return {
      status: status as 'agree' | 'disagree' | null,
      positiveVotes: record.get('positiveVotes') || 0,
      negativeVotes: record.get('negativeVotes') || 0,
    };
  }

  async vote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    const nodeKey = Object.keys(nodeIdentifier)[0];
    const nodeValue = nodeIdentifier[nodeKey];

    this.logger.log(
      `Processing vote for ${nodeLabel} with ${nodeKey}: ${nodeValue} by user: ${sub}, isPositive: ${isPositive}`,
    );

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
      CREATE (u)-[v:VOTED_ON]->(n)
      SET v.status = $status,
          v.createdAt = datetime(),
          n.positiveVotes = COALESCE(n.positiveVotes, 0) + oldPosAdjust + CASE WHEN $isPositive THEN 1 ELSE 0 END,
          n.negativeVotes = COALESCE(n.negativeVotes, 0) + oldNegAdjust + CASE WHEN $isPositive THEN 0 ELSE 1 END
      RETURN n.positiveVotes as positiveVotes, n.negativeVotes as negativeVotes
      `,
      {
        nodeValue,
        sub,
        isPositive,
        status: isPositive ? 'agree' : 'disagree',
      },
    );

    const voteResult = {
      positiveVotes: result.records[0].get('positiveVotes') || 0,
      negativeVotes: result.records[0].get('negativeVotes') || 0,
    };

    this.logger.log(`Vote result: ${JSON.stringify(voteResult)}`);
    return voteResult;
  }

  async removeVote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
  ): Promise<VoteResult> {
    const nodeKey = Object.keys(nodeIdentifier)[0];
    const nodeValue = nodeIdentifier[nodeKey];

    this.logger.log(
      `Removing vote for ${nodeLabel} with ${nodeKey}: ${nodeValue} by user: ${sub}`,
    );

    const result = await this.neo4jService.write(
      `
      MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
      MATCH (u:User {sub: $sub})-[v:VOTED_ON]->(n)
      WITH n, v, 
           CASE WHEN v.status = 'agree' THEN -1 ELSE 0 END as posAdjust,
           CASE WHEN v.status = 'disagree' THEN -1 ELSE 0 END as negAdjust
      DELETE v
      SET n.positiveVotes = COALESCE(n.positiveVotes, 0) + posAdjust,
          n.negativeVotes = COALESCE(n.negativeVotes, 0) + negAdjust
      RETURN n.positiveVotes as positiveVotes, n.negativeVotes as negativeVotes
      `,
      { nodeValue, sub },
    );

    const voteResult = {
      positiveVotes: result.records[0].get('positiveVotes') || 0,
      negativeVotes: result.records[0].get('negativeVotes') || 0,
    };

    this.logger.log(`Remove vote result: ${JSON.stringify(voteResult)}`);
    return voteResult;
  }
}
