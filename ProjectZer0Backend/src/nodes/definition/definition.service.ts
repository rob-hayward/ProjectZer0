// src/nodes/definition/definition.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { v4 as uuidv4 } from 'uuid';
import type { VoteStatus, VoteResult } from '../../neo4j/schemas/vote.schema';
import { TEXT_LIMITS } from '../../constants/validation';
import { DiscussionService } from '../discussion/discussion.service';

@Injectable()
export class DefinitionService {
  private readonly logger = new Logger(DefinitionService.name);

  constructor(
    private readonly definitionSchema: DefinitionSchema,
    private readonly userSchema: UserSchema,
    private readonly discussionService: DiscussionService,
  ) {}

  async createDefinition(definitionData: {
    word: string;
    createdBy: string;
    definitionText: string;
    discussion?: string;
  }) {
    // Input validation
    if (!definitionData.word || definitionData.word.trim() === '') {
      this.logger.warn('Attempted to create definition with empty word');
      throw new BadRequestException('Word cannot be empty');
    }

    if (
      !definitionData.definitionText ||
      definitionData.definitionText.trim() === ''
    ) {
      this.logger.warn(
        `Attempted to create empty definition for word: ${definitionData.word}`,
      );
      throw new BadRequestException('Definition text cannot be empty');
    }

    if (
      definitionData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      this.logger.warn(
        `Definition text exceeds maximum length for word: ${definitionData.word}`,
      );
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }

    try {
      this.logger.log(`Creating definition for word: ${definitionData.word}`);
      this.logger.debug(`Definition data: ${JSON.stringify(definitionData)}`);

      const definitionWithId = {
        ...definitionData,
        id: uuidv4(),
      };

      const result =
        await this.definitionSchema.createDefinition(definitionWithId);

      // Create discussion if provided
      if (definitionData.discussion) {
        try {
          const discussion = await this.discussionService.createDiscussion({
            createdBy: definitionData.createdBy,
            associatedNodeId: result.id,
            associatedNodeType: 'DefinitionNode',
            initialComment: definitionData.discussion,
          });

          await this.definitionSchema.updateDefinitionWithDiscussionId(
            result.id,
            discussion.id,
          );

          this.logger.debug(
            `Created discussion for definition: ${JSON.stringify(discussion)}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to create discussion: ${error.message}`);
          // Continue even if creating the discussion fails
        }
      }

      // Track creation for non-API users
      if (
        definitionData.createdBy !== 'FreeDictionaryAPI' &&
        definitionData.createdBy !== 'ProjectZeroAI'
      ) {
        try {
          await this.userSchema.addCreatedNode(
            definitionData.createdBy,
            result.id,
            'definition',
          );
          this.logger.debug(
            `Tracked creation for user: ${definitionData.createdBy}`,
          );
        } catch (error) {
          // Log but don't fail the overall operation if tracking fails
          this.logger.warn(
            `Failed to track definition creation for user ${definitionData.createdBy}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Successfully created definition with ID: ${result.id}`);
      return result;
    } catch (error) {
      // Re-throw BadRequestException as it's an expected error
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle NotFoundException separately to provide more context
      if (error instanceof NotFoundException) {
        this.logger.error(
          `Word not found for definition: ${definitionData.word}`,
        );
        throw new NotFoundException(
          `Cannot create definition: Word "${definitionData.word}" not found`,
        );
      }

      this.logger.error(
        `Error creating definition: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to create definition: ${error.message}`);
    }
  }

  async getDefinition(id: string) {
    if (!id || id.trim() === '') {
      this.logger.warn('Attempted to get definition with empty ID');
      throw new BadRequestException('Definition ID cannot be empty');
    }

    try {
      this.logger.log(`Retrieving definition: ${id}`);
      const definition = await this.definitionSchema.getDefinition(id);

      if (!definition) {
        this.logger.warn(`Definition not found: ${id}`);
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      this.logger.debug(`Retrieved definition: ${JSON.stringify(definition)}`);
      return definition;
    } catch (error) {
      // Re-throw expected exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error retrieving definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to retrieve definition: ${error.message}`);
    }
  }

  async getDefinitionWithDiscussion(id: string) {
    if (!id || id.trim() === '') {
      this.logger.warn('Attempted to get definition with empty ID');
      throw new BadRequestException('Definition ID cannot be empty');
    }

    try {
      const definition = await this.getDefinition(id);

      if (!definition) {
        return null;
      }

      // Fetch associated discussion if exists
      if (definition.discussionId) {
        const discussion = await this.discussionService.getDiscussion(
          definition.discussionId,
        );
        definition.discussion = discussion;
      }

      return definition;
    } catch (error) {
      // Re-throw expected exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting definition with discussion ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get definition with discussion: ${error.message}`,
      );
    }
  }

  async updateDefinition(
    id: string,
    updateData: { definitionText?: string; discussionId?: string },
  ) {
    if (!id || id.trim() === '') {
      this.logger.warn('Attempted to update definition with empty ID');
      throw new BadRequestException('Definition ID cannot be empty');
    }

    if (
      updateData.definitionText !== undefined &&
      updateData.definitionText.trim() === ''
    ) {
      this.logger.warn(`Attempted to update definition ${id} with empty text`);
      throw new BadRequestException('Definition text cannot be empty');
    }

    if (
      updateData.definitionText &&
      updateData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      this.logger.warn(
        `Definition text exceeds maximum length for update: ${id}`,
      );
      throw new BadRequestException(
        `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }

    try {
      this.logger.log(`Updating definition ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      const updatedDefinition = await this.definitionSchema.updateDefinition(
        id,
        updateData,
      );
      if (!updatedDefinition) {
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      this.logger.log(`Successfully updated definition: ${id}`);
      this.logger.debug(
        `Updated definition: ${JSON.stringify(updatedDefinition)}`,
      );

      return updatedDefinition;
    } catch (error) {
      // Re-throw expected exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to update definition: ${error.message}`);
    }
  }

  async deleteDefinition(id: string) {
    if (!id || id.trim() === '') {
      this.logger.warn('Attempted to delete definition with empty ID');
      throw new BadRequestException('Definition ID cannot be empty');
    }

    try {
      this.logger.log(`Deleting definition: ${id}`);
      const result = await this.definitionSchema.deleteDefinition(id);
      this.logger.log(`Successfully deleted definition: ${id}`);
      return result;
    } catch (error) {
      // Re-throw NotFoundException as it's an expected error
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error deleting definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to delete definition: ${error.message}`);
    }
  }

  async voteDefinition(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID cannot be empty');
    }

    if (!sub || sub.trim() === '') {
      throw new BadRequestException('User ID cannot be empty');
    }

    try {
      this.logger.log(
        `Processing vote on definition ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.definitionSchema.voteDefinition(
        id,
        sub,
        isPositive,
      );

      // Track participation for voting
      try {
        await this.userSchema.addParticipation(sub, id, 'voted');
        this.logger.debug(`Tracked vote participation for user: ${sub}`);
      } catch (error) {
        // Log but don't fail the overall operation if tracking fails
        this.logger.warn(
          `Failed to track vote participation for user ${sub}: ${error.message}`,
        );
      }

      this.logger.debug(`Vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      // Re-throw BadRequestException as it's an expected error
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error processing vote on definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on definition: ${error.message}`);
    }
  }

  async getDefinitionVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID cannot be empty');
    }

    if (!sub || sub.trim() === '') {
      throw new BadRequestException('User ID cannot be empty');
    }

    try {
      this.logger.debug(
        `Getting vote status for definition ${id} by user ${sub}`,
      );
      const status = await this.definitionSchema.getDefinitionVoteStatus(
        id,
        sub,
      );
      this.logger.debug(`Retrieved vote status: ${JSON.stringify(status)}`);
      return status;
    } catch (error) {
      // Re-throw BadRequestException as it's an expected error
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting vote status for definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get definition vote status: ${error.message}`);
    }
  }

  async removeDefinitionVote(id: string, sub: string): Promise<VoteResult> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID cannot be empty');
    }

    if (!sub || sub.trim() === '') {
      throw new BadRequestException('User ID cannot be empty');
    }

    try {
      this.logger.log(`Removing vote from definition ${id} by user ${sub}`);
      const result = await this.definitionSchema.removeDefinitionVote(id, sub);
      this.logger.debug(`Remove vote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      // Re-throw BadRequestException as it's an expected error
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error removing vote from definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove definition vote: ${error.message}`);
    }
  }

  async getDefinitionVotes(id: string): Promise<VoteResult | null> {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID cannot be empty');
    }

    try {
      this.logger.log(`Getting votes for definition: ${id}`);
      const voteStatus = await this.definitionSchema.getDefinitionVotes(id);

      if (!voteStatus) {
        this.logger.debug(`No votes found for definition: ${id}`);
      } else {
        this.logger.debug(`Retrieved votes: ${JSON.stringify(voteStatus)}`);
      }

      return voteStatus;
    } catch (error) {
      // Re-throw BadRequestException as it's an expected error
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error getting votes for definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get definition votes: ${error.message}`);
    }
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID cannot be empty');
    }

    try {
      this.logger.log(`Setting visibility for definition ${id}: ${isVisible}`);
      const updatedDefinition = await this.definitionSchema.setVisibilityStatus(
        id,
        isVisible,
      );
      this.logger.log(`Updated visibility status for definition ${id}`);
      this.logger.debug(
        `Updated definition: ${JSON.stringify(updatedDefinition)}`,
      );
      return updatedDefinition;
    } catch (error) {
      // Re-throw expected exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility for definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to set definition visibility: ${error.message}`);
    }
  }

  async getVisibilityStatus(id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Definition ID cannot be empty');
    }

    try {
      this.logger.log(`Getting visibility status for definition: ${id}`);
      const status = await this.definitionSchema.getVisibilityStatus(id);
      this.logger.debug(`Retrieved visibility status: ${status}`);
      return status;
    } catch (error) {
      // Re-throw expected exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get definition visibility status: ${error.message}`,
      );
    }
  }
}
