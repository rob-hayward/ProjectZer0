// src/neo4j/schemas/definition.schema.ts
import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';
import { TEXT_LIMITS } from '../../constants/validation';
import type { VoteStatus, VoteResult } from './vote.schema';

@Injectable()
export class DefinitionSchema {
  private readonly logger = new Logger(DefinitionSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly userSchema: UserSchema,
    private readonly voteSchema: VoteSchema,
  ) {}

  async createDefinition(definitionData: {
    id: string;
    word: string;
    createdBy: string;
    definitionText: string;
    discussion?: string;
  }) {
    try {
      // Validate definition text length
      if (
        definitionData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
      ) {
        const errorMsg = `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`;
        this.logger.warn(`Definition validation failed: ${errorMsg}`);
        throw new BadRequestException(errorMsg);
      }

      // Log the creation attempt
      this.logger.log(`Creating definition for word: ${definitionData.word}`);
      this.logger.debug(`Definition data: ${JSON.stringify(definitionData)}`);

      const isApiDefinition = definitionData.createdBy === 'FreeDictionaryAPI';
      const isAICreated = definitionData.createdBy === 'ProjectZeroAI';

      const result = await this.neo4jService.write(
        `
        // Create User if needed (for non-API creators)
        CALL {
          WITH $createdBy as userId
          WITH userId
          WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
          MERGE (u:User {sub: userId})
          RETURN u
        }

        // Match Word and Create Definition
        MATCH (w:WordNode {word: $word})
        CREATE (d:DefinitionNode {
            id: $id,
            definitionText: $definitionText,
            createdBy: $createdBy,
            createdAt: datetime(),
            updatedAt: datetime(),
            positiveVotes: 0,
            negativeVotes: 0,
            netVotes: 0,
            visibilityStatus: true
        })
        CREATE (w)-[:HAS_DEFINITION]->(d)

        // Create CREATED relationship only (no initial vote)
        WITH d, $createdBy as userId
        WHERE NOT $isApiDefinition AND NOT $isAICreated
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'definition'
        }]->(d)

        // Create discussion node automatically
        WITH DISTINCT d
        CREATE (disc:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (d)-[:HAS_DISCUSSION]->(disc)
        
        // Create initial comment only if provided
        WITH d, disc, $discussion as initialComment
        WHERE initialComment IS NOT NULL AND size(initialComment) > 0
        CREATE (c:CommentNode {
          id: apoc.create.uuid(),
          createdBy: $createdBy,
          commentText: initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          visibilityStatus: true,
          parentCommentId: null
        })
        CREATE (disc)-[:HAS_COMMENT]->(c)

        RETURN d
        `,
        {
          ...definitionData,
          isApiDefinition,
          isAICreated,
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          `Failed to create definition for word: ${definitionData.word}`,
        );
      }

      const createdDefinition = result.records[0].get('d').properties;
      this.logger.log(`Created definition with ID: ${createdDefinition.id}`);
      this.logger.debug(
        `Definition details: ${JSON.stringify(createdDefinition)}`,
      );

      return createdDefinition;
    } catch (error) {
      // Re-throw BadRequestException since it's an expected error
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle Neo4j specific error for word not found
      if (
        error.message?.includes('not found') ||
        error.message?.includes('not connected')
      ) {
        this.logger.error(`Word not found: ${definitionData.word}`);
        throw new NotFoundException(`Word "${definitionData.word}" not found`);
      }

      this.logger.error(
        `Error creating definition: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to create definition: ${error.message}`);
    }
  }

  async getDefinition(id: string) {
    try {
      this.logger.debug(`Retrieving definition: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {id: $id})
        // Get discussion
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN d, disc.id as discussionId
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        this.logger.debug(`Definition not found: ${id}`);
        return null;
      }

      const definition = result.records[0].get('d').properties;
      definition.discussionId = result.records[0].get('discussionId');
      this.logger.debug(`Retrieved definition: ${JSON.stringify(definition)}`);
      return definition;
    } catch (error) {
      this.logger.error(
        `Error retrieving definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to retrieve definition: ${error.message}`);
    }
  }

  async getDefinitionWithDiscussion(id: string) {
    try {
      this.logger.debug(`Retrieving definition with discussion: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {id: $id})
        // Get discussion
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN d, disc
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        this.logger.debug(`Definition not found: ${id}`);
        return null;
      }

      const definition = result.records[0].get('d').properties;
      const discussion = result.records[0].get('disc');

      if (discussion) {
        definition.discussion = discussion.properties;
        definition.discussionId = discussion.properties.id;
      }

      this.logger.debug(
        `Retrieved definition with discussion: ${JSON.stringify(definition)}`,
      );
      return definition;
    } catch (error) {
      this.logger.error(
        `Error retrieving definition with discussion ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to retrieve definition with discussion: ${error.message}`,
      );
    }
  }

  async updateDefinition(
    id: string,
    updateData: {
      definitionText?: string;
      discussionId?: string;
    },
  ) {
    try {
      // Validate definition text length if provided
      if (
        updateData.definitionText &&
        updateData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
      ) {
        const errorMsg = `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`;
        this.logger.warn(`Definition update validation failed: ${errorMsg}`);
        throw new BadRequestException(errorMsg);
      }

      this.logger.log(`Updating definition ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      const result = await this.neo4jService.write(
        `
        MATCH (d:DefinitionNode {id: $id})
        SET d += $updateData, d.updatedAt = datetime()
        RETURN d
        `,
        { id, updateData },
      );

      if (!result.records || result.records.length === 0) {
        this.logger.warn(`Definition not found for update: ${id}`);
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      const updatedDefinition = result.records[0].get('d').properties;
      this.logger.log(`Updated definition ${id}`);
      this.logger.debug(
        `Updated definition: ${JSON.stringify(updatedDefinition)}`,
      );
      return updatedDefinition;
    } catch (error) {
      // Re-throw BadRequestException and NotFoundException as they're expected errors
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

  async updateDefinitionWithDiscussionId(
    definitionId: string,
    discussionId: string,
  ) {
    try {
      this.logger.debug(
        `Updating definition ${definitionId} with discussion ID ${discussionId}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (d:DefinitionNode {id: $definitionId})
        SET d.discussionId = $discussionId,
            d.updatedAt = datetime()
        RETURN d
        `,
        { definitionId, discussionId },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(
          `Definition with ID ${definitionId} not found`,
        );
      }

      const updatedDefinition = result.records[0].get('d').properties;
      this.logger.debug(
        `Updated definition with discussion ID: ${JSON.stringify(updatedDefinition)}`,
      );
      return updatedDefinition;
    } catch (error) {
      this.logger.error(
        `Error updating definition with discussion ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteDefinition(id: string) {
    try {
      this.logger.log(`Deleting definition: ${id}`);

      const checkResult = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {id: $id})
        RETURN d
        `,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
        this.logger.warn(`Definition not found for deletion: ${id}`);
        throw new NotFoundException(`Definition with ID ${id} not found`);
      }

      // Delete definition and all related nodes (discussion, comments)
      await this.neo4jService.write(
        `
        MATCH (d:DefinitionNode {id: $id})
        // Get associated discussion and comments to delete as well
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        OPTIONAL MATCH (disc)-[:HAS_COMMENT]->(c:CommentNode)
        // Delete everything
        DETACH DELETE d, disc, c
        `,
        { id },
      );

      this.logger.log(`Successfully deleted definition: ${id}`);
      return {
        success: true,
        message: `Definition ${id} deleted successfully`,
      };
    } catch (error) {
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

  async getDefinitionVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      this.logger.debug(
        `Getting vote status for definition ${id} by user ${sub}`,
      );
      return await this.voteSchema.getVoteStatus('DefinitionNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error getting vote status for definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get definition vote status: ${error.message}`);
    }
  }

  async voteDefinition(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.logger.log(
        `Processing vote on definition ${id} by user ${sub}: ${isPositive}`,
      );
      return await this.voteSchema.vote(
        'DefinitionNode',
        { id },
        sub,
        isPositive,
      );
    } catch (error) {
      this.logger.error(
        `Error voting on definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on definition: ${error.message}`);
    }
  }

  async removeDefinitionVote(id: string, sub: string): Promise<VoteResult> {
    try {
      this.logger.log(`Removing vote from definition ${id} by user ${sub}`);
      return await this.voteSchema.removeVote('DefinitionNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error removing vote from definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove definition vote: ${error.message}`);
    }
  }

  async getDefinitionVotes(id: string): Promise<VoteResult | null> {
    try {
      this.logger.debug(`Getting votes for definition ${id}`);

      const voteStatus = await this.voteSchema.getVoteStatus(
        'DefinitionNode',
        { id },
        '', // Empty string as we don't need user-specific status
      );

      if (!voteStatus) {
        this.logger.debug(`No votes found for definition: ${id}`);
        return null;
      }

      const votes = {
        positiveVotes: voteStatus.positiveVotes,
        negativeVotes: voteStatus.negativeVotes,
        netVotes: voteStatus.netVotes,
      };

      this.logger.debug(`Votes for definition ${id}: ${JSON.stringify(votes)}`);
      return votes;
    } catch (error) {
      this.logger.error(
        `Error getting votes for definition ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get definition votes: ${error.message}`);
    }
  }

  async setVisibilityStatus(definitionId: string, isVisible: boolean) {
    try {
      this.logger.log(
        `Setting visibility status for definition ${definitionId}: ${isVisible}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (d:DefinitionNode {id: $definitionId})
        SET d.visibilityStatus = $isVisible, d.updatedAt = datetime()
        RETURN d
        `,
        { definitionId, isVisible },
      );

      if (!result.records || result.records.length === 0) {
        this.logger.warn(
          `Definition not found for visibility update: ${definitionId}`,
        );
        throw new NotFoundException(
          `Definition with ID ${definitionId} not found`,
        );
      }

      const updatedDefinition = result.records[0].get('d').properties;
      this.logger.log(`Updated definition visibility status to ${isVisible}`);
      this.logger.debug(
        `Updated definition: ${JSON.stringify(updatedDefinition)}`,
      );
      return updatedDefinition;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error setting visibility status for definition ${definitionId}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to set definition visibility status: ${error.message}`,
      );
    }
  }

  async getVisibilityStatus(definitionId: string): Promise<boolean> {
    try {
      this.logger.debug(
        `Getting visibility status for definition ${definitionId}`,
      );

      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {id: $definitionId})
        RETURN d.visibilityStatus
        `,
        { definitionId },
      );

      if (!result.records || result.records.length === 0) {
        this.logger.warn(
          `Definition not found for visibility check: ${definitionId}`,
        );
        throw new NotFoundException(
          `Definition with ID ${definitionId} not found`,
        );
      }

      const visibilityStatus =
        result.records[0]?.get('d.visibilityStatus') ?? true;
      this.logger.debug(
        `Visibility status for definition ${definitionId}: ${visibilityStatus}`,
      );
      return visibilityStatus;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Error getting visibility status for definition ${definitionId}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get definition visibility status: ${error.message}`,
      );
    }
  }
}
