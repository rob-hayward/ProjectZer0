// src/neo4j/schemas/base-node.schema.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from '../vote.schema';
import { VoteKind } from '../../../config/voting.config';
import { Record } from 'neo4j-driver';

export interface BaseNodeData {
  id: string;
  createdBy: string;
  publicCredit: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  inclusionPositiveVotes?: number;
  inclusionNegativeVotes?: number;
  inclusionNetVotes?: number;
  contentPositiveVotes?: number;
  contentNegativeVotes?: number;
  contentNetVotes?: number;
  discussionId?: string;
}

export interface CreateDiscussionOptions {
  nodeId: string;
  nodeType: string;
  createdBy: string;
  initialComment?: string;
}

@Injectable()
export abstract class BaseNodeSchema<T extends BaseNodeData = BaseNodeData> {
  protected abstract readonly nodeLabel: string;
  protected abstract readonly idField: string;
  protected readonly logger: Logger;

  constructor(
    protected readonly neo4jService: Neo4jService,
    protected readonly voteSchema: VoteSchema,
    loggerContext: string,
  ) {
    this.logger = new Logger(loggerContext);
  }

  protected validateId(id: string, fieldName: string = 'ID'): void {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException(
        `${fieldName} is required and cannot be empty`,
      );
    }
  }

  protected validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new BadRequestException('User ID is required and cannot be empty');
    }
  }

  protected async createDiscussion(
    options: CreateDiscussionOptions,
  ): Promise<string> {
    try {
      const discussionId = `discussion-${options.nodeId}-${Date.now()}`;

      let query = `
        MATCH (n:${options.nodeType} {${this.idField}: $nodeId})
        
        CREATE (d:DiscussionNode {
          id: $discussionId,
          createdBy: $createdBy,
          associatedNodeId: $nodeId,
          associatedNodeType: $nodeType,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        
        CREATE (n)-[:HAS_DISCUSSION]->(d)
      `;

      if (options.initialComment && options.initialComment.trim() !== '') {
        query += `
        CREATE (c:CommentNode {
          id: $commentId,
          createdBy: $createdBy,
          discussionId: $discussionId,
          commentText: $initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
        
        CREATE (d)-[:HAS_COMMENT]->(c)
        `;
      }

      query += ` RETURN d.id as discussionId`;

      const params: any = {
        nodeId: options.nodeId,
        nodeType: options.nodeType,
        discussionId,
        createdBy: options.createdBy,
      };

      if (options.initialComment && options.initialComment.trim() !== '') {
        params.commentId = `comment-${discussionId}-${Date.now()}`;
        params.initialComment = options.initialComment;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create discussion');
      }

      return result.records[0].get('discussionId');
    } catch (error) {
      this.logger.error(
        `Error creating discussion for ${options.nodeType}: ${error.message}`,
      );
      throw this.standardError('create discussion', error);
    }
  }

  protected async getDiscussionId(nodeId: string): Promise<string | null> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (n:${this.nodeLabel} {${this.idField}: $nodeId})-[:HAS_DISCUSSION]->(d:DiscussionNode)
        RETURN d.id as discussionId
        `,
        { nodeId },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      return result.records[0].get('discussionId');
    } catch {
      return null;
    }
  }

  async createDiscussionForExistingNode(
    nodeId: string,
    createdBy: string,
    initialComment?: string,
  ): Promise<string> {
    this.validateId(nodeId);
    this.validateUserId(createdBy);

    const existingDiscussionId = await this.getDiscussionId(nodeId);
    if (existingDiscussionId) {
      throw new BadRequestException(
        `${this.getNodeTypeName()} already has a discussion`,
      );
    }

    const node = await this.findById(nodeId);
    if (!node) {
      throw new NotFoundException(
        `${this.getNodeTypeName()} with ${this.idField} '${nodeId}' not found`,
      );
    }

    return await this.createDiscussion({
      nodeId,
      nodeType: this.nodeLabel,
      createdBy,
      initialComment,
    });
  }

  async findById(id: string): Promise<T | null> {
    this.validateId(id);

    try {
      const result = await this.neo4jService.read(
        `MATCH (n:${this.nodeLabel} {${this.idField}: $id}) RETURN n`,
        { id },
      );

      if (result.records.length === 0) {
        return null;
      }

      return this.mapNodeFromRecord(result.records[0]);
    } catch (error) {
      this.logger.error(
        `Error finding ${this.nodeLabel} by ${this.idField}: ${error.message}`,
      );
      throw this.standardError('find', error);
    }
  }

  async update(id: string, updateData: Partial<T>): Promise<T | null> {
    this.validateId(id);

    try {
      const query = this.buildUpdateQuery(id, updateData);
      const result = await this.neo4jService.write(query.cypher, query.params);

      if (result.records.length === 0) {
        throw new NotFoundException(
          `${this.getNodeTypeName()} with ${this.idField} '${id}' not found`,
        );
      }

      return this.mapNodeFromRecord(result.records[0]);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error updating ${this.nodeLabel}: ${error.message}`);
      throw this.standardError('update', error);
    }
  }

  async delete(id: string): Promise<{ success: boolean }> {
    this.validateId(id);

    try {
      const existsResult = await this.neo4jService.read(
        `MATCH (n:${this.nodeLabel} {${this.idField}: $id}) RETURN COUNT(n) as count`,
        { id },
      );

      const count = this.toNumber(existsResult.records[0].get('count'));
      if (count === 0) {
        throw new NotFoundException(
          `${this.getNodeTypeName()} with ${this.idField} '${id}' not found`,
        );
      }

      await this.neo4jService.write(
        `
        MATCH (n:${this.nodeLabel} {${this.idField}: $id})
        OPTIONAL MATCH (n)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        DETACH DELETE n, d, c
        `,
        { id },
      );

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error deleting ${this.nodeLabel}: ${error.message}`);
      throw this.standardError('delete', error);
    }
  }

  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    return await this.voteSchema.vote(
      this.nodeLabel,
      { [this.idField]: id },
      userId,
      isPositive,
      'INCLUSION',
    );
  }

  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    if (!this.supportsContentVoting()) {
      throw new BadRequestException(
        `${this.getNodeTypeName()} does not support content voting`,
      );
    }

    return await this.voteSchema.vote(
      this.nodeLabel,
      { [this.idField]: id },
      userId,
      isPositive,
      'CONTENT',
    );
  }

  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    this.validateId(id);
    this.validateUserId(userId);

    return await this.voteSchema.getVoteStatus(
      this.nodeLabel,
      { [this.idField]: id },
      userId,
    );
  }

  async removeVote(
    id: string,
    userId: string,
    kind: VoteKind,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    return await this.voteSchema.removeVote(
      this.nodeLabel,
      { [this.idField]: id },
      userId,
      kind,
    );
  }

  async getVotes(id: string): Promise<VoteResult | null> {
    this.validateId(id);

    const voteStatus = await this.voteSchema.getVoteStatus(
      this.nodeLabel,
      { [this.idField]: id },
      '',
    );

    if (!voteStatus) {
      return null;
    }

    return {
      inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
      inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
      inclusionNetVotes: voteStatus.inclusionNetVotes,
      contentPositiveVotes: this.supportsContentVoting()
        ? voteStatus.contentPositiveVotes
        : 0,
      contentNegativeVotes: this.supportsContentVoting()
        ? voteStatus.contentNegativeVotes
        : 0,
      contentNetVotes: this.supportsContentVoting()
        ? voteStatus.contentNetVotes
        : 0,
    };
  }

  protected toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'object' && value !== null) {
      if ('low' in value && typeof value.low === 'number') {
        return Number(value.low);
      } else if ('valueOf' in value && typeof value.valueOf === 'function') {
        return Number(value.valueOf());
      }
    }

    return Number(value);
  }

  protected standardError(operation: string, error: Error): Error {
    const nodeType = this.getNodeTypeName();
    return new Error(`Failed to ${operation} ${nodeType}: ${error.message}`);
  }

  protected getNodeTypeName(): string {
    if (this.nodeLabel.endsWith('Node')) {
      const baseName = this.nodeLabel.slice(0, -4);
      return baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();
    }
    const name = this.nodeLabel.toLowerCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  protected abstract mapNodeFromRecord(record: Record): T;
  protected abstract buildUpdateQuery(
    id: string,
    data: Partial<T>,
  ): {
    cypher: string;
    params: any;
  };
  protected abstract supportsContentVoting(): boolean;
}
