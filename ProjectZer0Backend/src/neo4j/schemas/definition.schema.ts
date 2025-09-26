// src/neo4j/schemas/definition.schema.ts - REFACTORED

import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { TaggedNodeSchema, TaggedNodeData } from './base/tagged.schema';
import { UserSchema } from './user.schema';
import { DiscussionSchema } from './discussion.schema';
import { VotingUtils } from '../../config/voting.config';
import { TEXT_LIMITS } from '../../constants/validation';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * DefinitionNode data interface
 * Definitions provide meaning for words in the system
 */
export interface DefinitionData extends TaggedNodeData {
  word: string; // The word this definition belongs to
  definitionText: string;
  isApiDefinition?: boolean; // From FreeDictionaryAPI
  isAICreated?: boolean; // From ProjectZeroAI
  // Inherited from TaggedNodeData:
  // - keywords (will be just the word being defined)
  // Inherited from BaseNodeData through TaggedNodeData:
  // - All voting fields (both inclusion and content)
  // - discussionId, createdBy, publicCredit, etc.
}

/**
 * Schema for DefinitionNode - provides meanings for words.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> DefinitionSchema
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Both inclusion and content voting (dual voting)
 * - Has discussions (via injected DiscussionSchema)
 * - IS taggable (single tag: the word being defined)
 * - NOT categorizable (definitions aren't put into categories)
 * - Parent word must pass inclusion threshold first
 * - Content voting only after inclusion threshold passed
 */
@Injectable()
export class DefinitionSchema extends TaggedNodeSchema<DefinitionData> {
  protected readonly nodeLabel = 'DefinitionNode';
  protected readonly idField = 'id'; // Standard ID field

  // Override to false since definitions are tagged with existing words
  protected readonly validateKeywordInclusion = false;

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly userSchema: UserSchema,
    private readonly discussionSchema: DiscussionSchema,
  ) {
    super(neo4jService, voteSchema, DefinitionSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return true; // Definitions support both inclusion and content voting
  }

  protected mapNodeFromRecord(record: Record): DefinitionData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      word: props.word,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      definitionText: props.definitionText,
      isApiDefinition: props.isApiDefinition,
      isAICreated: props.isAICreated,
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
      .filter((key) => key !== 'id' && key !== 'word') // Don't update id or word
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

  // ============================================
  // OVERRIDE VOTING METHODS WITH BUSINESS LOGIC
  // ============================================

  /**
   * Content voting with business logic validation.
   * Definitions must pass inclusion threshold before content voting is allowed.
   */
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<any> {
    this.validateId(id);
    this.validateUserId(userId);

    // Check if definition has passed inclusion threshold
    const definition = await this.findById(id);
    if (
      !definition ||
      !VotingUtils.hasPassedInclusion(definition.inclusionNetVotes || 0)
    ) {
      throw new BadRequestException(
        'Definition must pass inclusion threshold before content voting is allowed',
      );
    }

    // Call parent implementation
    return super.voteContent(id, userId, isPositive);
  }

  // ============================================
  // DEFINITION-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new definition for a word.
   * The parent word must have passed inclusion threshold.
   */
  async createDefinition(definitionData: {
    id?: string; // Optional, will generate if not provided
    word: string;
    createdBy: string;
    definitionText: string;
    publicCredit?: boolean;
    initialComment?: string;
    isApiDefinition?: boolean;
    isAICreated?: boolean;
  }): Promise<DefinitionData> {
    // Validate inputs
    if (!definitionData.word || definitionData.word.trim() === '') {
      throw new BadRequestException('Word is required');
    }
    if (
      !definitionData.definitionText ||
      definitionData.definitionText.trim() === ''
    ) {
      throw new BadRequestException('Definition text cannot be empty');
    }
    if (
      definitionData.definitionText.length > TEXT_LIMITS.MAX_DEFINITION_LENGTH
    ) {
      throw new BadRequestException(
        `Definition text cannot exceed ${TEXT_LIMITS.MAX_DEFINITION_LENGTH} characters`,
      );
    }

    const definitionId = definitionData.id || uuidv4();
    const standardizedWord = definitionData.word.toLowerCase().trim();
    const isApiDefinition =
      definitionData.isApiDefinition ||
      definitionData.createdBy === 'FreeDictionaryAPI';
    const isAICreated =
      definitionData.isAICreated ||
      definitionData.createdBy === 'ProjectZeroAI';

    try {
      const query = `
        // Verify parent word exists and has passed inclusion threshold
        MATCH (w:WordNode {word: $word})
        WHERE w.inclusionNetVotes > 0
        
        // Create the definition node with dual voting fields
        CREATE (d:DefinitionNode {
            id: $id,
            word: $word,
            definitionText: $definitionText,
            createdBy: $createdBy,
            publicCredit: $publicCredit,
            isApiDefinition: $isApiDefinition,
            isAICreated: $isAICreated,
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
        
        // Create TAGGED relationship to the word (definitions are tagged with the word they define)
        CREATE (d)-[:TAGGED {
          frequency: 1,
          source: 'definition',
          createdAt: datetime()
        }]->(w)
        
        // Create user relationship for non-API/AI definitions
        WITH d, w, $createdBy as userId
        WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            nodeType: 'definition'
        }]->(d)
        
        RETURN d as n
      `;

      const params = {
        id: definitionId,
        word: standardizedWord,
        definitionText: definitionData.definitionText.trim(),
        createdBy: definitionData.createdBy,
        publicCredit: definitionData.publicCredit ?? true,
        isApiDefinition,
        isAICreated,
      };

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create definition - parent word may not exist or have not passed inclusion threshold',
        );
      }

      const createdDefinition = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: definitionId,
          nodeType: this.nodeLabel,
          nodeIdField: 'id', // Definitions use standard 'id' field
          createdBy: definitionData.createdBy,
          initialComment: definitionData.initialComment,
        });

      createdDefinition.discussionId = discussionResult.discussionId;

      // Track user creation for non-API/AI definitions
      if (!isApiDefinition && !isAICreated) {
        try {
          await this.userSchema.addCreatedNode(
            definitionData.createdBy,
            definitionId,
            'definition',
          );
        } catch (error) {
          this.logger.warn(
            `Could not track user creation for definition ${definitionId}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Successfully created definition: ${definitionId}`);
      return createdDefinition;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('parent word may not exist')) {
        throw new BadRequestException(
          `Word '${standardizedWord}' does not exist or has not passed inclusion threshold. ` +
            'Definitions can only be created for approved words.',
        );
      }

      this.logger.error(
        `Error creating definition: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create definition', error);
    }
  }

  /**
   * Gets all definitions for a specific word
   */
  async getDefinitionsByWord(word: string): Promise<DefinitionData[]> {
    if (!word || word.trim() === '') {
      throw new BadRequestException('Word cannot be empty');
    }

    const standardizedWord = word.toLowerCase().trim();
    this.logger.debug(`Getting definitions for word: ${standardizedWord}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {word: $word})
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN d as n, disc.id as discussionId
        ORDER BY d.inclusionNetVotes DESC, d.contentNetVotes DESC
        `,
        { word: standardizedWord },
      );

      return result.records.map((record) => {
        const definition = this.mapNodeFromRecord(record);
        definition.discussionId = record.get('discussionId');
        return definition;
      });
    } catch (error) {
      this.logger.error(`Error getting definitions for word: ${error.message}`);
      throw this.standardError('get definitions by word', error);
    }
  }

  /**
   * Gets the top definition for a word (highest voting scores)
   */
  async getTopDefinitionForWord(word: string): Promise<DefinitionData | null> {
    const definitions = await this.getDefinitionsByWord(word);

    if (definitions.length === 0) {
      return null;
    }

    // Filter to only approved definitions
    const approvedDefinitions = definitions.filter((d) =>
      VotingUtils.hasPassedInclusion(d.inclusionNetVotes || 0),
    );

    if (approvedDefinitions.length === 0) {
      return null;
    }

    // Sort by content votes (quality) among approved definitions
    approvedDefinitions.sort(
      (a, b) => (b.contentNetVotes || 0) - (a.contentNetVotes || 0),
    );

    return approvedDefinitions[0];
  }

  /**
   * Gets all definitions created by a specific user
   */
  async getDefinitionsByUser(userId: string): Promise<DefinitionData[]> {
    this.validateUserId(userId);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode {createdBy: $userId})
        OPTIONAL MATCH (d)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN d as n, disc.id as discussionId
        ORDER BY d.createdAt DESC
        `,
        { userId },
      );

      return result.records.map((record) => {
        const definition = this.mapNodeFromRecord(record);
        definition.discussionId = record.get('discussionId');
        return definition;
      });
    } catch (error) {
      this.logger.error(`Error getting definitions by user: ${error.message}`);
      throw this.standardError('get definitions by user', error);
    }
  }

  /**
   * Checks if a user can create a definition for a word
   * (word must exist and have passed inclusion threshold)
   */
  async canCreateDefinitionForWord(word: string): Promise<boolean> {
    const standardizedWord = word.toLowerCase().trim();

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {word: $word})
        WHERE w.inclusionNetVotes > 0
        RETURN COUNT(w) > 0 as canCreate
        `,
        { word: standardizedWord },
      );

      return result.records[0]?.get('canCreate') || false;
    } catch {
      return false;
    }
  }

  /**
   * Gets definition statistics
   */
  async getDefinitionStats(): Promise<{
    totalDefinitions: number;
    approvedDefinitions: number;
    apiDefinitions: number;
    userDefinitions: number;
  }> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (d:DefinitionNode)
        RETURN 
          COUNT(d) as totalDefinitions,
          COUNT(CASE WHEN d.inclusionNetVotes > 0 THEN 1 END) as approvedDefinitions,
          COUNT(CASE WHEN d.isApiDefinition = true THEN 1 END) as apiDefinitions,
          COUNT(CASE WHEN d.isApiDefinition <> true AND d.isAICreated <> true THEN 1 END) as userDefinitions
        `,
      );

      const record = result.records[0];
      return {
        totalDefinitions: this.toNumber(record.get('totalDefinitions')),
        approvedDefinitions: this.toNumber(record.get('approvedDefinitions')),
        apiDefinitions: this.toNumber(record.get('apiDefinitions')),
        userDefinitions: this.toNumber(record.get('userDefinitions')),
      };
    } catch (error) {
      this.logger.error(`Error getting definition stats: ${error.message}`);
      throw this.standardError('get definition stats', error);
    }
  }
}
