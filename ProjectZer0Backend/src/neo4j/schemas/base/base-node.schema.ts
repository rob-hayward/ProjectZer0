// src/neo4j/schemas/base/base-node.schema.ts - REFACTORED WITHOUT DISCUSSION LOGIC
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

/**
 * Base interface for all node data in the system
 */
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
  discussionId?: string; // Still keep this field for nodes that have discussions
}

/**
 * Abstract base schema for all Neo4j node types.
 * Provides common functionality for:
 * - CRUD operations
 * - Voting operations (inclusion and content)
 * - Validation utilities
 * - Error handling
 *
 * Note: Discussion creation has been moved to DiscussionSchema
 */
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

  // ============================================
  // VALIDATION UTILITIES
  // ============================================

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

  // ============================================
  // CRUD OPERATIONS
  // ============================================

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
      this.logger.error(`Error updating ${this.nodeLabel}: ${error.message}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw this.standardError('update', error);
    }
  }

  async delete(id: string): Promise<{ success: boolean }> {
    this.validateId(id);

    try {
      // First check if the node exists
      const checkResult = await this.neo4jService.read(
        `MATCH (n:${this.nodeLabel} {${this.idField}: $id}) 
         RETURN COUNT(n) as count`,
        { id },
      );

      const count = this.toNumber(checkResult.records[0].get('count'));
      if (count === 0) {
        throw new NotFoundException(
          `${this.getNodeTypeName()} with ${this.idField} '${id}' not found`,
        );
      }

      // Delete the node and all its relationships
      await this.neo4jService.write(
        `MATCH (n:${this.nodeLabel} {${this.idField}: $id})
         DETACH DELETE n`,
        { id },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting ${this.nodeLabel}: ${error.message}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw this.standardError('delete', error);
    }
  }

  // ============================================
  // VOTING OPERATIONS
  // ============================================

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
      '', // Empty user ID to get aggregate votes only
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

  // ============================================
  // UTILITY METHODS
  // ============================================

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

  // ============================================
  // ABSTRACT METHODS
  // ============================================

  /**
   * Maps a Neo4j record to the node's data structure
   */
  protected abstract mapNodeFromRecord(record: Record): T;

  /**
   * Builds an update query for the node
   */
  protected abstract buildUpdateQuery(
    id: string,
    data: Partial<T>,
  ): {
    cypher: string;
    params: any;
  };

  /**
   * Determines if this node type supports content voting
   */
  protected abstract supportsContentVoting(): boolean;
}
