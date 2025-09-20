// src/neo4j/schemas/definition.schema.ts - Fixed TypeScript Error

import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { UserSchema } from './user.schema';
import { VotingUtils } from '../../config/voting.config';
import { TEXT_LIMITS } from '../../constants/validation';
import { Record } from 'neo4j-driver';

// Definition-specific data interface extending BaseNodeData
export interface DefinitionData extends BaseNodeData {
  word: string; // The word this definition belongs to
  definitionText: string;
}

@Injectable()
export class DefinitionSchema extends BaseNodeSchema<DefinitionData> {
  protected readonly nodeLabel = 'DefinitionNode';
  protected readonly idField = 'id'; // Definitions use standard 'id' field

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, DefinitionSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return true; // Definitions support both inclusion and content voting
  }

  protected mapNodeFromRecord(record: Record): DefinitionData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      word: props.word,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit, // ✅ FIXED: Added missing publicCredit field
      definitionText: props.definitionText,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Both inclusion and content voting
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNegativeVotes: this.toNumber(props.contentNegativeVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<DefinitionData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id') // Don't update the id field
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:DefinitionNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // DEFINITION-SPECIFIC METHODS

  async createDefinition(definitionData: {
    id: string;
    word: string;
    createdBy: string;
    definitionText: string;
    initialComment?: string;
  }): Promise<DefinitionData> {
    // Validate definition text length
    if (
      definitionData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      const errorMsg = `Definition text must not exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`;
      this.logger.warn(`Definition validation failed: ${errorMsg}`);
      throw new BadRequestException(errorMsg);
    }

    // Additional definition-specific validations
    if (
      !definitionData.definitionText ||
      definitionData.definitionText.trim() === ''
    ) {
      throw new BadRequestException('Definition text cannot be empty');
    }

    this.logger.log(`Creating definition for word: ${definitionData.word}`);

    try {
      const isApiDefinition = definitionData.createdBy === 'FreeDictionaryAPI';
      const isAICreated = definitionData.createdBy === 'ProjectZeroAI';

      const result = await this.neo4jService.write(
        `
        // Validate parent Word exists and has passed inclusion threshold
        MATCH (w:WordNode {word: $word})
        WHERE w.inclusionNetVotes > 0 // Must have passed inclusion
        
        // Create User if needed (for non-API creators)
        CALL {
          WITH $createdBy as userId
          WITH userId
          WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
          MERGE (u:User {sub: userId})
          RETURN u
        }

        // Create Definition Node with dual voting
        CREATE (d:DefinitionNode {
            id: $id,
            word: $word,
            definitionText: $definitionText,
            createdBy: $createdBy,
            publicCredit: $publicCredit,
            createdAt: datetime(),
            updatedAt: datetime(),
            // Both inclusion and content voting
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0,
            contentPositiveVotes: 0,
            contentNegativeVotes: 0,
            contentNetVotes: 0
        })
        
        // Create relationship to parent word
        CREATE (d)-[:DEFINES]->(w)
        
        // Create user relationship for non-API definitions
        WITH d, $createdBy as userId
        WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'definition'
        }]->(d)
        
        RETURN d as n
        `,
        {
          id: definitionData.id,
          word: definitionData.word.toLowerCase(), // Standardize word
          definitionText: definitionData.definitionText,
          createdBy: definitionData.createdBy,
          publicCredit: true, // Default to true for definitions
        },
      );

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Parent word not found or has not passed inclusion threshold',
        );
      }

      const createdDefinition = this.mapNodeFromRecord(result.records[0]);

      // Always create discussion using standardized method
      const discussionId = await this.createDiscussion({
        nodeId: definitionData.id,
        nodeType: this.nodeLabel,
        createdBy: definitionData.createdBy,
        initialComment: definitionData.initialComment,
      });

      createdDefinition.discussionId = discussionId;

      // Track user creation for non-API definitions
      if (!isApiDefinition && !isAICreated) {
        try {
          await this.userSchema.addCreatedNode(
            definitionData.createdBy,
            definitionData.id,
            'definition',
          );
        } catch (error) {
          this.logger.warn(
            `Could not track user creation for definition ${definitionData.id}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Successfully created definition: ${definitionData.id}`);
      return createdDefinition;
    } catch (error) {
      this.logger.error(
        `Error creating definition: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create definition', error);
    }
  }

  // Content voting with business logic validation
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<any> {
    this.validateId(id);
    this.validateUserId(userId);

    // Check if definition has passed inclusion threshold before allowing content voting
    const definition = await this.findById(id);
    if (
      !definition ||
      !VotingUtils.hasPassedInclusion(definition.inclusionNetVotes)
    ) {
      throw new BadRequestException(
        'Definition must pass inclusion threshold before content voting is allowed',
      );
    }

    // Call parent implementation
    return super.voteContent(id, userId, isPositive);
  }

  // Additional definition-specific methods
  async getDefinitionsByWord(word: string): Promise<DefinitionData[]> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(`Getting definitions for word: ${word}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {word: $word})
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN d as n, disc.id as discussionId
        ORDER BY d.inclusionNetVotes DESC, d.contentNetVotes DESC, d.createdAt ASC
        `,
        { word: word.toLowerCase() },
      );

      return result.records.map((record) => {
        const definition = this.mapNodeFromRecord(record);
        definition.discussionId = record.get('discussionId');
        return definition;
      });
    } catch (error) {
      this.logger.error(
        `Error getting definitions for word: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get definitions for word', error);
    }
  }

  async getApprovedDefinitions(word: string): Promise<DefinitionData[]> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    this.logger.debug(`Getting approved definitions for word: ${word}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {word: $word})
        WHERE d.inclusionNetVotes > 0
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN d as n, disc.id as discussionId
        ORDER BY d.inclusionNetVotes DESC, d.contentNetVotes DESC, d.createdAt ASC
        `,
        { word: word.toLowerCase() },
      );

      return result.records.map((record) => {
        const definition = this.mapNodeFromRecord(record);
        definition.discussionId = record.get('discussionId');
        return definition;
      });
    } catch (error) {
      this.logger.error(
        `Error getting approved definitions: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get approved definitions', error);
    }
  }
}
