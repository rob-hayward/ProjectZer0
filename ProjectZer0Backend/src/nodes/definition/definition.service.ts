// src/nodes/definition/definition.service.ts - CLEAN VERSION WITH CORRECT ARCHITECTURE

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { DiscussionService } from '../discussion/discussion.service';
import { CommentService } from '../comment/comment.service';
import { TEXT_LIMITS } from '../../constants/validation';
import { v4 as uuidv4 } from 'uuid';
import type { VoteResult, VoteStatus } from '../../neo4j/schemas/vote.schema';

// Interface definitions
interface CreateDefinitionData {
  word: string;
  createdBy: string;
  definitionText: string;
  initialComment: string; // MANDATORY for discussion creation
  discussion?: string; // Legacy field - maps to initialComment
}

interface UpdateDefinitionData {
  definitionText?: string;
  discussionId?: string; // For internal updates only
}

@Injectable()
export class DefinitionService {
  private readonly logger = new Logger(DefinitionService.name);

  constructor(
    private readonly definitionSchema: DefinitionSchema,
    private readonly userSchema: UserSchema,
    private readonly discussionService: DiscussionService,
    private readonly commentService: CommentService,
  ) {}

  // CRUD OPERATIONS - HYBRID PATTERN IMPLEMENTATION

  /**
   * Create a new definition with mandatory discussion (like StatementService)
   */
  async createDefinition(definitionData: CreateDefinitionData) {
    try {
      this.validateCreateDefinitionData(definitionData);

      const definitionId = uuidv4();
      this.logger.log(`Creating definition for word: ${definitionData.word}`);

      // STEP 1: Create the definition first (without discussionId)
      const definitionToCreate = {
        id: definitionId,
        word: definitionData.word.toLowerCase().trim(),
        createdBy: definitionData.createdBy,
        definitionText: definitionData.definitionText.trim(),
      };

      const result =
        await this.definitionSchema.createDefinition(definitionToCreate);

      // STEP 2: Create mandatory discussion - MUST SUCCEED
      try {
        this.logger.debug(
          `Creating mandatory discussion for definition: ${result.id}`,
        );

        const discussion = await this.discussionService.createDiscussion({
          createdBy: definitionData.createdBy,
          associatedNodeId: result.id,
          associatedNodeType: 'DefinitionNode',
          initialComment:
            definitionData.initialComment || definitionData.discussion || '',
        });

        // STEP 3: Update definition with discussionId using BaseNodeSchema
        await this.definitionSchema.update(result.id, {
          discussionId: discussion.id,
        });

        this.logger.log(
          `Successfully created definition with discussion: ${result.id}`,
        );

        // STEP 4: Track user creation (optional - don't fail if this fails)
        try {
          if (definitionData.createdBy !== 'FreeDictionaryAPI') {
            await this.userSchema.addCreatedNode(
              definitionData.createdBy,
              result.id,
              'definition',
            );
          }
        } catch (trackingError) {
          this.logger.warn(
            `Failed to track definition creation: ${trackingError.message}`,
          );
        }

        // Return definition with discussionId for API compatibility
        return {
          ...result,
          discussionId: discussion.id,
        };
      } catch (error) {
        // CRITICAL: Clean up definition if discussion creation fails
        this.logger.error(
          `Failed to create mandatory discussion for definition ${result.id}: ${error.message}`,
        );

        try {
          await this.definitionSchema.delete(result.id);
          this.logger.warn(
            `Cleaned up definition ${result.id} due to discussion creation failure`,
          );
        } catch (deleteError) {
          this.logger.error(
            `Failed to cleanup definition ${result.id}: ${deleteError.message}`,
          );
        }

        throw new InternalServerErrorException(
          'Failed to create discussion for definition - definition creation aborted',
        );
      }
    } catch (error) {
      this.handleError(error, 'create definition');
    }
  }

  /**
   * Get definition by ID - Uses BaseNodeSchema findById
   */
  async getDefinition(id: string) {
    try {
      this.validateId(id);

      const definition = await this.definitionSchema.findById(id);

      if (!definition) {
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      return definition;
    } catch (error) {
      this.handleError(error, `get definition ${id}`);
    }
  }

  /**
   * Get definition with discussion validation (like StatementService)
   */
  async getDefinitionWithDiscussion(id: string) {
    try {
      this.validateId(id);

      const definition = await this.getDefinition(id);

      if (!definition) {
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      // Validate definition has required discussionId
      if (!definition.discussionId) {
        this.logger.error(
          `CRITICAL: Definition ${id} missing discussionId - data integrity violation!`,
        );
        throw new InternalServerErrorException(
          `Definition ${id} is in an invalid state - missing required discussion`,
        );
      }

      return definition;
    } catch (error) {
      this.handleError(error, `get definition with discussion ${id}`);
    }
  }

  /**
   * Update definition - Hybrid pattern (simple updates use BaseNodeSchema)
   */
  async updateDefinition(id: string, updateData: UpdateDefinitionData) {
    try {
      this.validateId(id);
      this.validateUpdateDefinitionData(updateData);

      this.logger.log(`Updating definition: ${id}`);

      const result = await this.definitionSchema.update(id, updateData);

      if (!result) {
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `update definition ${id}`);
    }
  }

  /**
   * Delete definition - Uses BaseNodeSchema method
   */
  async deleteDefinition(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Deleting definition: ${id}`);

      const result = await this.definitionSchema.delete(id);

      this.logger.log(`Successfully deleted definition: ${id}`);
      return result;
    } catch (error) {
      this.handleError(error, `delete definition ${id}`);
    }
  }

  // VOTING OPERATIONS - Uses BaseNodeSchema methods

  /**
   * Vote on definition inclusion
   */
  async voteDefinitionInclusion(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Voting ${isPositive ? 'positive' : 'negative'} on definition inclusion: ${id}`,
      );

      return await this.definitionSchema.voteInclusion(id, userId, isPositive);
    } catch (error) {
      this.handleError(error, `vote on definition inclusion ${id}`);
    }
  }

  /**
   * Vote on definition content
   */
  async voteDefinitionContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Voting ${isPositive ? 'positive' : 'negative'} on definition content: ${id}`,
      );

      return await this.definitionSchema.voteContent(id, userId, isPositive);
    } catch (error) {
      this.handleError(error, `vote on definition content ${id}`);
    }
  }

  /**
   * Get vote status for definition by user
   */
  async getDefinitionVoteStatus(
    id: string,
    userId: string,
  ): Promise<VoteStatus | null> {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      return await this.definitionSchema.getVoteStatus(id, userId);
    } catch (error) {
      this.handleError(error, `get vote status for definition ${id}`);
    }
  }

  /**
   * Remove vote from definition
   */
  async removeDefinitionVote(
    id: string,
    userId: string,
    voteType: 'INCLUSION' | 'CONTENT' = 'INCLUSION',
  ) {
    try {
      this.validateId(id);
      this.validateUserId(userId);

      this.logger.log(
        `Removing ${voteType} vote from definition ${id} by user ${userId}`,
      );

      return await this.definitionSchema.removeVote(id, userId, voteType);
    } catch (error) {
      this.handleError(error, `remove vote from definition ${id}`);
    }
  }

  /**
   * Get vote counts for definition
   */
  async getDefinitionVotes(id: string): Promise<VoteResult> {
    try {
      this.validateId(id);

      return await this.definitionSchema.getVotes(id);
    } catch (error) {
      this.handleError(error, `get votes for definition ${id}`);
    }
  }

  // COMMENT OPERATIONS - Following StatementService pattern

  /**
   * Add comment to definition (uses discussionId like StatementService)
   */
  async addDefinitionComment(
    definitionId: string,
    commentData: { commentText: string; parentCommentId?: string },
    userId: string,
  ) {
    try {
      this.validateId(definitionId);
      this.validateUserId(userId);

      if (!commentData.commentText || commentData.commentText.trim() === '') {
        throw new BadRequestException('Comment text is required');
      }

      this.logger.log(
        `Adding comment to definition ${definitionId} by user ${userId}`,
      );

      // Get definition to ensure it exists and has discussionId
      const definition = await this.getDefinition(definitionId);

      if (!definition) {
        throw new NotFoundException(
          `Definition with ID ${definitionId} not found`,
        );
      }

      // Validate definition has required discussionId
      if (!definition.discussionId) {
        this.logger.error(
          `CRITICAL: Definition ${definitionId} missing discussionId - data integrity violation!`,
        );
        throw new InternalServerErrorException(
          `Definition ${definitionId} is in an invalid state - missing required discussion`,
        );
      }

      // Create the comment
      const comment = await this.commentService.createComment({
        createdBy: userId,
        discussionId: definition.discussionId,
        commentText: commentData.commentText.trim(),
        parentCommentId: commentData.parentCommentId,
      });

      this.logger.log(
        `Successfully added comment to definition ${definitionId}`,
      );
      return comment;
    } catch (error) {
      this.handleError(error, `add comment to definition ${definitionId}`);
    }
  }

  // VISIBILITY OPERATIONS - Placeholder implementations

  /**
   * Set visibility status (placeholder - not implemented in schema)
   */
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      this.validateId(id);

      this.logger.warn(
        'setVisibilityStatus not implemented in DefinitionSchema - using placeholder',
      );

      return {
        success: true,
        message: 'Visibility status updated (placeholder)',
      };
    } catch (error) {
      this.handleError(error, `set visibility status for definition ${id}`);
    }
  }

  /**
   * Get visibility status (placeholder - not implemented in schema)
   */
  async getVisibilityStatus(id: string) {
    try {
      this.validateId(id);

      this.logger.warn(
        'getVisibilityStatus not implemented in DefinitionSchema - using placeholder',
      );

      return { isVisible: true };
    } catch (error) {
      this.handleError(error, `get visibility status for definition ${id}`);
    }
  }

  // UTILITY METHODS

  /**
   * Check if definition is approved (inclusion net votes > 0)
   */
  async isDefinitionApproved(id: string): Promise<boolean> {
    try {
      this.validateId(id);

      const votes = await this.getDefinitionVotes(id);
      if (!votes) {
        return false;
      }

      return votes.inclusionNetVotes > 0;
    } catch (error) {
      this.handleError(error, `check if definition is approved ${id}`);
      return false;
    }
  }

  /**
   * Check if content voting is available (passed inclusion threshold)
   */
  async isContentVotingAvailable(id: string): Promise<boolean> {
    try {
      this.validateId(id);

      const votes = await this.getDefinitionVotes(id);
      if (!votes) {
        return false;
      }

      return votes.inclusionNetVotes > 0;
    } catch (error) {
      this.handleError(
        error,
        `check content voting availability for definition ${id}`,
      );
      return false;
    }
  }

  /**
   * Get comprehensive definition statistics
   */
  async getDefinitionStats(id: string) {
    try {
      this.validateId(id);

      const definition = await this.getDefinition(id);
      const votes = await this.getDefinitionVotes(id);
      const isApproved = await this.isDefinitionApproved(id);
      const contentVotingAvailable = await this.isContentVotingAvailable(id);

      return {
        id: definition.id,
        word: definition.word,
        isApproved,
        contentVotingAvailable,
        votes,
        hasDiscussion: !!definition.discussionId,
      };
    } catch (error) {
      this.handleError(error, `get statistics for definition ${id}`);
    }
  }

  // VALIDATION METHODS

  private validateCreateDefinitionData(data: CreateDefinitionData) {
    if (!data.word || data.word.trim() === '') {
      throw new BadRequestException('Word is required');
    }

    if (!data.createdBy || data.createdBy.trim() === '') {
      throw new BadRequestException('Creator ID is required');
    }

    if (!data.definitionText || data.definitionText.trim() === '') {
      throw new BadRequestException('Definition text is required');
    }

    if (data.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH) {
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }

    // MANDATORY: All definitions must have initial comment for discussion
    const comment = data.initialComment || data.discussion;
    if (!comment || comment.trim() === '') {
      throw new BadRequestException(
        'Initial comment is required for definition discussion',
      );
    }

    if (comment.length > TEXT_LIMITS.MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `Initial comment must not exceed ${TEXT_LIMITS.MAX_COMMENT_LENGTH} characters`,
      );
    }
  }

  private validateUpdateDefinitionData(data: UpdateDefinitionData) {
    if (
      data.definitionText !== undefined &&
      data.definitionText.trim() === ''
    ) {
      throw new BadRequestException('Definition text cannot be empty');
    }

    if (
      data.definitionText &&
      data.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }
  }

  private validateId(id: string, fieldName: string = 'Definition ID') {
    if (!id || id.trim() === '') {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }
  }

  private validateUserId(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new BadRequestException('User ID cannot be empty');
    }
  }

  // ERROR HANDLING

  private handleError(error: any, operation: string): never {
    // Re-throw expected HTTP exceptions
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    // Log unexpected errors and convert to InternalServerErrorException
    this.logger.error(
      `Error during ${operation}: ${error.message}`,
      error.stack,
    );
    throw new InternalServerErrorException(
      `Failed to ${operation}: ${error.message}`,
    );
  }
}
