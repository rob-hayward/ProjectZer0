// src/neo4j/schemas/base-node.schema.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema, VoteResult, VoteStatus } from './vote.schema';
import { VoteKind } from '../../config/voting.config';
import { Record } from 'neo4j-driver';

export interface BaseNodeData {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
  inclusionPositiveVotes?: number;
  inclusionNegativeVotes?: number;
  inclusionNetVotes?: number;
  contentPositiveVotes?: number;
  contentNegativeVotes?: number;
  contentNetVotes?: number;
}

@Injectable()
export abstract class BaseNodeSchema<T extends BaseNodeData = BaseNodeData> {
  protected abstract readonly nodeLabel: string;
  protected abstract readonly idField: string; // 'id' for most, 'word' for WordSchema
  protected readonly logger: Logger;

  constructor(
    protected readonly neo4jService: Neo4jService,
    protected readonly voteSchema: VoteSchema,
    loggerContext: string,
  ) {
    this.logger = new Logger(loggerContext);
  }

  // STANDARDIZED INPUT VALIDATION

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

  // STANDARDIZED CRUD OPERATIONS

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
        error.stack,
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
      this.logger.error(
        `Error updating ${this.nodeLabel}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update', error);
    }
  }

  async delete(id: string): Promise<{ success: boolean }> {
    this.validateId(id);

    try {
      // Check if node exists first
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
        `MATCH (n:${this.nodeLabel} {${this.idField}: $id}) DETACH DELETE n`,
        { id },
      );

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error deleting ${this.nodeLabel}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('delete', error);
    }
  }

  // STANDARDIZED VOTING OPERATIONS

  async voteInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    try {
      this.logger.log(
        `Processing inclusion vote on ${this.nodeLabel} ${id} by user ${userId}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.voteSchema.vote(
        this.nodeLabel,
        { [this.idField]: id },
        userId,
        isPositive,
        'INCLUSION',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on ${this.nodeLabel} inclusion: ${error.message}`,
        error.stack,
      );
      throw this.standardError('vote on', error);
    }
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

    try {
      this.logger.log(
        `Processing content vote on ${this.nodeLabel} ${id} by user ${userId}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.voteSchema.vote(
        this.nodeLabel,
        { [this.idField]: id },
        userId,
        isPositive,
        'CONTENT',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on ${this.nodeLabel} content: ${error.message}`,
        error.stack,
      );
      throw this.standardError('vote on', error);
    }
  }

  async getVoteStatus(id: string, userId: string): Promise<VoteStatus | null> {
    this.validateId(id);
    this.validateUserId(userId);

    try {
      return await this.voteSchema.getVoteStatus(
        this.nodeLabel,
        { [this.idField]: id },
        userId,
      );
    } catch (error) {
      this.logger.error(
        `Error getting vote status for ${this.nodeLabel}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get vote status for', error);
    }
  }

  async removeVote(
    id: string,
    userId: string,
    kind: VoteKind,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    try {
      this.logger.log(
        `Removing ${kind} vote from ${this.nodeLabel} ${id} by user ${userId}`,
      );

      return await this.voteSchema.removeVote(
        this.nodeLabel,
        { [this.idField]: id },
        userId,
        kind,
      );
    } catch (error) {
      this.logger.error(
        `Error removing vote from ${this.nodeLabel}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('remove vote from', error);
    }
  }

  async getVotes(id: string): Promise<VoteResult | null> {
    this.validateId(id);

    try {
      const voteStatus = await this.voteSchema.getVoteStatus(
        this.nodeLabel,
        { [this.idField]: id },
        '', // Empty string for aggregate vote counts
      );

      if (!voteStatus) {
        this.logger.debug(`No votes found for ${this.nodeLabel}: ${id}`);
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
    } catch (error) {
      this.logger.error(
        `Error getting votes for ${this.nodeLabel}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get votes for', error);
    }
  }

  // ❌ VISIBILITY METHODS INTENTIONALLY REMOVED
  // These are now handled by the centralized VisibilityService
  // - setVisibilityStatus() -> VisibilityService.setUserVisibilityPreference()
  // - getVisibilityStatus() -> VisibilityService.getObjectVisibility()

  // STANDARDIZED UTILITIES

  protected toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle Neo4j Integer objects
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
    // Convert "WordNode" -> "Word", "DefinitionNode" -> "Definition", etc.
    // Only remove "Node" if it appears at the end, and capitalize first letter
    if (this.nodeLabel.endsWith('Node')) {
      const baseName = this.nodeLabel.slice(0, -4); // Remove last 4 characters ("Node")
      return baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();
    }
    const name = this.nodeLabel.toLowerCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // ABSTRACT METHODS - Must be implemented by subclasses

  /**
   * Maps a Neo4j record to the node type
   * CRITICAL: Must handle Neo4j Integer conversion using this.toNumber()
   */
  protected abstract mapNodeFromRecord(record: Record): T;

  /**
   * Builds update query for the specific node type
   * CRITICAL: Must handle the specific idField (id vs word)
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
   * Words and OpenQuestions: false
   * Definitions, Statements, Answers, Quantities: true
   */
  protected abstract supportsContentVoting(): boolean;
}
