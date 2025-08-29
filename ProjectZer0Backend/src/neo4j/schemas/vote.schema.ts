// src/neo4j/schemas/vote.schema.ts

import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteKind, NODE_VOTING_RULES } from '../../config/voting.config';

export interface VoteStatus {
  // Inclusion vote data
  inclusionStatus: 'agree' | 'disagree' | null;
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  inclusionNetVotes: number;

  // Content vote data (null if not applicable)
  contentStatus: 'agree' | 'disagree' | null;
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  contentNetVotes: number;
}

export interface VoteResult {
  // Inclusion votes
  inclusionPositiveVotes: number;
  inclusionNegativeVotes: number;
  inclusionNetVotes: number;

  // Content votes
  contentPositiveVotes: number;
  contentNegativeVotes: number;
  contentNetVotes: number;
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
      OPTIONAL MATCH (u:User {sub: $sub})-[inclusionVote:VOTED_ON {kind: 'INCLUSION'}]->(n)
      OPTIONAL MATCH (u)-[contentVote:VOTED_ON {kind: 'CONTENT'}]->(n)
      
      RETURN n.inclusionPositiveVotes as inclusionPositiveVotes,
             n.inclusionNegativeVotes as inclusionNegativeVotes,
             n.inclusionNetVotes as inclusionNetVotes,
             n.contentPositiveVotes as contentPositiveVotes,
             n.contentNegativeVotes as contentNegativeVotes,
             n.contentNetVotes as contentNetVotes,
             inclusionVote.status as inclusionStatus,
             contentVote.status as contentStatus,
             u IS NOT NULL as userExists
      `,
      { nodeValue, sub },
    );

    if (!result.records.length) return null;

    const record = result.records[0];
    const userExists = record.get('userExists');

    // If user doesn't exist, create them
    if (!userExists && sub) {
      await this.neo4jService.write(`MERGE (u:User {sub: $sub})`, { sub });
    }

    return {
      inclusionStatus: record.get('inclusionStatus') as
        | 'agree'
        | 'disagree'
        | null,
      inclusionPositiveVotes: this.toNumber(
        record.get('inclusionPositiveVotes'),
      ),
      inclusionNegativeVotes: this.toNumber(
        record.get('inclusionNegativeVotes'),
      ),
      inclusionNetVotes: this.toNumber(record.get('inclusionNetVotes')),

      contentStatus: record.get('contentStatus') as 'agree' | 'disagree' | null,
      contentPositiveVotes: this.toNumber(record.get('contentPositiveVotes')),
      contentNegativeVotes: this.toNumber(record.get('contentNegativeVotes')),
      contentNetVotes: this.toNumber(record.get('contentNetVotes')),
    };
  }

  async vote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
    isPositive: boolean,
    kind: VoteKind,
  ): Promise<VoteResult> {
    try {
      const nodeKey = Object.keys(nodeIdentifier)[0];
      const nodeValue = nodeIdentifier[nodeKey];

      // Validate that this node type supports the requested vote kind
      const nodeType = nodeLabel as keyof typeof NODE_VOTING_RULES;
      const rules = NODE_VOTING_RULES[nodeType];

      if (kind === 'CONTENT' && !rules?.hasContent) {
        throw new Error(`${nodeLabel} does not support content voting`);
      }

      if (kind === 'INCLUSION' && !rules?.hasInclusion) {
        throw new Error(`${nodeLabel} does not support inclusion voting`);
      }

      // Determine which vote properties to update
      const voteProps =
        kind === 'INCLUSION'
          ? {
              positiveField: 'inclusionPositiveVotes',
              negativeField: 'inclusionNegativeVotes',
              netField: 'inclusionNetVotes',
            }
          : {
              positiveField: 'contentPositiveVotes',
              negativeField: 'contentNegativeVotes',
              netField: 'contentNetVotes',
            };

      const result = await this.neo4jService.write(
        `
        MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
        MERGE (u:User {sub: $sub})
        WITH n, u
        
        // Remove any existing vote of this kind
        OPTIONAL MATCH (u)-[oldVote:VOTED_ON {kind: $kind}]->(n)
        WITH n, u, oldVote,
             CASE WHEN oldVote.status = 'agree' THEN -1 ELSE 0 END as oldPosAdjust,
             CASE WHEN oldVote.status = 'disagree' THEN -1 ELSE 0 END as oldNegAdjust
        DELETE oldVote
        
        // Create new vote relationship
        CREATE (u)-[v:VOTED_ON]->(n)
        SET v.status = $status,
            v.kind = $kind,
            v.createdAt = datetime()
        
        // Update vote counts for this kind
        WITH n, u, v, oldPosAdjust, oldNegAdjust
        SET n.${voteProps.positiveField} = COALESCE(n.${voteProps.positiveField}, 0) + oldPosAdjust + CASE WHEN $isPositive THEN 1 ELSE 0 END,
            n.${voteProps.negativeField} = COALESCE(n.${voteProps.negativeField}, 0) + oldNegAdjust + CASE WHEN $isPositive THEN 0 ELSE 1 END
        
        // Calculate net votes
        WITH n
        SET n.${voteProps.netField} = n.${voteProps.positiveField} - n.${voteProps.negativeField}
        
        RETURN n.inclusionPositiveVotes as inclusionPositiveVotes, 
               n.inclusionNegativeVotes as inclusionNegativeVotes, 
               n.inclusionNetVotes as inclusionNetVotes,
               n.contentPositiveVotes as contentPositiveVotes,
               n.contentNegativeVotes as contentNegativeVotes,
               n.contentNetVotes as contentNetVotes
        `,
        {
          nodeValue,
          sub,
          isPositive,
          kind,
          status: isPositive ? 'agree' : 'disagree',
        },
      );

      const voteResult: VoteResult = {
        inclusionPositiveVotes: this.toNumber(
          result.records[0].get('inclusionPositiveVotes'),
        ),
        inclusionNegativeVotes: this.toNumber(
          result.records[0].get('inclusionNegativeVotes'),
        ),
        inclusionNetVotes: this.toNumber(
          result.records[0].get('inclusionNetVotes'),
        ),
        contentPositiveVotes: this.toNumber(
          result.records[0].get('contentPositiveVotes'),
        ),
        contentNegativeVotes: this.toNumber(
          result.records[0].get('contentNegativeVotes'),
        ),
        contentNetVotes: this.toNumber(
          result.records[0].get('contentNetVotes'),
        ),
      };

      return voteResult;
    } catch (error) {
      this.logger.error(
        `Error in ${kind} vote for ${nodeLabel}: ${error.message}`,
      );
      throw new Error(
        `Failed to ${kind.toLowerCase()} vote on ${nodeLabel}: ${error.message}`,
      );
    }
  }

  async removeVote(
    nodeLabel: string,
    nodeIdentifier: { [key: string]: string },
    sub: string,
    kind: VoteKind,
  ): Promise<VoteResult> {
    try {
      const nodeKey = Object.keys(nodeIdentifier)[0];
      const nodeValue = nodeIdentifier[nodeKey];

      // Determine which vote properties to update
      const voteProps =
        kind === 'INCLUSION'
          ? {
              positiveField: 'inclusionPositiveVotes',
              negativeField: 'inclusionNegativeVotes',
              netField: 'inclusionNetVotes',
            }
          : {
              positiveField: 'contentPositiveVotes',
              negativeField: 'contentNegativeVotes',
              netField: 'contentNetVotes',
            };

      const result = await this.neo4jService.write(
        `
        MATCH (n:${nodeLabel} {${nodeKey}: $nodeValue})
        MATCH (u:User {sub: $sub})-[v:VOTED_ON {kind: $kind}]->(n)
        WITH n, v, 
             CASE WHEN v.status = 'agree' THEN -1 ELSE 0 END as posAdjust,
             CASE WHEN v.status = 'disagree' THEN -1 ELSE 0 END as negAdjust
        
        // Delete the vote relationship
        DELETE v
        
        // Update vote counts
        SET n.${voteProps.positiveField} = COALESCE(n.${voteProps.positiveField}, 0) + posAdjust,
            n.${voteProps.negativeField} = COALESCE(n.${voteProps.negativeField}, 0) + negAdjust
        
        // Calculate net votes
        WITH n
        SET n.${voteProps.netField} = n.${voteProps.positiveField} - n.${voteProps.negativeField}
        
        RETURN n.inclusionPositiveVotes as inclusionPositiveVotes, 
               n.inclusionNegativeVotes as inclusionNegativeVotes, 
               n.inclusionNetVotes as inclusionNetVotes,
               n.contentPositiveVotes as contentPositiveVotes,
               n.contentNegativeVotes as contentNegativeVotes,
               n.contentNetVotes as contentNetVotes
        `,
        { nodeValue, sub, kind },
      );

      const voteResult: VoteResult = {
        inclusionPositiveVotes: this.toNumber(
          result.records[0].get('inclusionPositiveVotes'),
        ),
        inclusionNegativeVotes: this.toNumber(
          result.records[0].get('inclusionNegativeVotes'),
        ),
        inclusionNetVotes: this.toNumber(
          result.records[0].get('inclusionNetVotes'),
        ),
        contentPositiveVotes: this.toNumber(
          result.records[0].get('contentPositiveVotes'),
        ),
        contentNegativeVotes: this.toNumber(
          result.records[0].get('contentNegativeVotes'),
        ),
        contentNetVotes: this.toNumber(
          result.records[0].get('contentNetVotes'),
        ),
      };

      return voteResult;
    } catch (error) {
      this.logger.error(
        `Error removing ${kind} vote for ${nodeLabel}: ${error.message}`,
      );
      throw new Error(
        `Failed to remove ${kind.toLowerCase()} vote from ${nodeLabel}: ${error.message}`,
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
