// src/neo4j/schemas/word.schema.ts - REFACTORED

import { Injectable, BadRequestException } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';
import { DiscussionSchema } from './discussion.schema';
import { TaggedNodeSchema, TaggedNodeData } from './base/tagged.schema';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * WordNode data interface
 * Words are the foundation of the tagging system
 */
export interface WordNodeData extends TaggedNodeData {
  word: string; // The actual word (also serves as ID)
  definitions?: any[]; // Associated definitions
  // Inherited from TaggedNodeData:
  // - keywords (will be just itself for self-tagging)
  // - relatedNodes (other nodes tagged with this word)
  // Inherited from BaseNodeData through TaggedNodeData:
  // - All voting fields, discussionId, createdBy, publicCredit, etc.
}

/**
 * Schema for WordNode - the foundation of the tagging/keyword system.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> WordSchema
 *
 * Key characteristics:
 * - Uses 'word' as the ID field (not 'id')
 * - Self-tagging: each word is tagged with itself
 * - Inclusion voting only (no content voting)
 * - Has discussions (via injected DiscussionSchema)
 * - Not categorizable (doesn't extend CategorizedSchema)
 * - All words are standardized to lowercase
 */
@Injectable()
export class WordSchema extends TaggedNodeSchema<WordNodeData> {
  protected readonly nodeLabel = 'WordNode';
  protected readonly idField = 'word'; // IMPORTANT: Uses 'word' not 'id'

  // Override to false since words tag themselves (no validation needed)
  protected readonly validateKeywordInclusion = false;

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly userSchema: UserSchema,
    private readonly discussionSchema: DiscussionSchema,
  ) {
    super(neo4jService, voteSchema, WordSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return false; // Words only have inclusion voting
  }

  protected mapNodeFromRecord(record: Record): WordNodeData {
    const props = record.get('n').properties;
    return {
      id: props.word, // Use word as ID
      word: props.word,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Inclusion voting only
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // No content voting for words
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(word: string, data: Partial<WordNodeData>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id' && key !== 'word') // Don't update word field
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:WordNode {word: $word})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { word: this.standardizeWord(word), updateData: data },
    };
  }

  // ============================================
  // WORD STANDARDIZATION
  // ============================================

  /**
   * Standardizes a word to lowercase for consistency
   */
  private standardizeWord(word: string): string {
    if (!word || typeof word !== 'string') {
      throw new BadRequestException('Word must be a non-empty string');
    }
    return word.toLowerCase().trim();
  }

  // ============================================
  // OVERRIDE INHERITED METHODS FOR WORD STANDARDIZATION
  // ============================================

  async findById(word: string): Promise<WordNodeData | null> {
    return super.findById(this.standardizeWord(word));
  }

  async update(
    word: string,
    updateData: Partial<WordNodeData>,
  ): Promise<WordNodeData | null> {
    return super.update(this.standardizeWord(word), updateData);
  }

  async delete(word: string): Promise<{ success: boolean }> {
    return super.delete(this.standardizeWord(word));
  }

  async voteInclusion(word: string, userId: string, isPositive: boolean) {
    return super.voteInclusion(this.standardizeWord(word), userId, isPositive);
  }

  async getVoteStatus(word: string, userId: string) {
    return super.getVoteStatus(this.standardizeWord(word), userId);
  }

  async removeVote(word: string, userId: string, kind: any) {
    return super.removeVote(this.standardizeWord(word), userId, kind);
  }

  async getVotes(word: string) {
    return super.getVotes(this.standardizeWord(word));
  }

  // Override TaggedNodeSchema methods for word standardization
  async getKeywords(word: string) {
    // For words, the keyword is itself
    return super.getKeywords(this.standardizeWord(word));
  }

  async updateKeywords() {
    // Words shouldn't update their keywords (always self-tagged)
    // Method signature matches parent class but parameters not used
    throw new BadRequestException(
      'Cannot update keywords for a word node - words are self-tagged',
    );
  }

  // ============================================
  // WORD-SPECIFIC METHODS
  // ============================================

  /**
   * Checks if a word exists in the system
   */
  async checkWordExistence(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);

    try {
      const result = await this.neo4jService.read(
        `MATCH (w:WordNode {word: $word}) RETURN w IS NOT NULL as exists`,
        { word: standardizedWord },
      );

      return result.records.length > 0 && result.records[0].get('exists');
    } catch (error) {
      this.logger.error(`Error checking word existence: ${error.message}`);
      throw this.standardError('check if word exists', error);
    }
  }

  /**
   * Creates a new word with optional initial definition
   * Handles both user-created and API/AI-created words
   */
  async createWord(wordData: {
    word: string;
    createdBy: string;
    publicCredit?: boolean;
    initialDefinition?: string;
    initialComment?: string;
    isApiDefinition?: boolean;
    isAICreated?: boolean;
  }) {
    const standardizedWord = this.standardizeWord(wordData.word);

    // Check if word already exists
    const exists = await this.checkWordExistence(standardizedWord);
    if (exists) {
      throw new BadRequestException(
        `Word '${standardizedWord}' already exists`,
      );
    }

    const isApiDefinition = wordData.isApiDefinition || false;
    const isAICreated = wordData.isAICreated || false;
    const definitionId = uuidv4();

    try {
      // Create word and optional initial definition in one transaction
      let query = `
        CREATE (w:WordNode {
          word: $word,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes: toInteger(0),
          inclusionNegativeVotes: toInteger(0),
          inclusionNetVotes: toInteger(0)
        })
      `;

      const params: any = {
        word: standardizedWord,
        createdBy: wordData.createdBy,
        publicCredit: wordData.publicCredit ?? true,
      };

      // Add initial definition if provided
      if (wordData.initialDefinition) {
        query += `
        CREATE (d:DefinitionNode {
          id: $definitionId,
          word: $word,
          definitionText: $initialDefinition,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          isApiDefinition: $isApiDefinition,
          isAICreated: $isAICreated,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes: toInteger(0),
          inclusionNegativeVotes: toInteger(0),
          inclusionNetVotes: toInteger(0),
          contentPositiveVotes: toInteger(0),
          contentNegativeVotes: toInteger(0),
          contentNetVotes: toInteger(0)
        })
        CREATE (d)-[:DEFINES]->(w)
        `;

        params.definitionId = definitionId;
        params.initialDefinition = wordData.initialDefinition;
        params.isApiDefinition = isApiDefinition;
        params.isAICreated = isAICreated;
      }

      // Create self-tagging relationship (words are tagged with themselves)
      // This is the key difference from other tagged nodes
      query += `
        CREATE (w)-[:TAGGED {
          frequency: 1,
          source: 'self',
          createdAt: datetime()
        }]->(w)
      `;

      // Create user relationships if not API/AI created
      if (!isApiDefinition && !isAICreated) {
        query += `
        WITH w${wordData.initialDefinition ? ', d' : ''}
        MATCH (u:User {sub: $createdBy})
        CREATE (u)-[:CREATED {
          createdAt: datetime(),
          nodeType: 'word'
        }]->(w)
        `;

        if (wordData.initialDefinition) {
          query += `
          CREATE (u)-[:CREATED {
            createdAt: datetime(),
            nodeType: 'definition'
          }]->(d)
          `;
        }
      }

      query += `
        RETURN w${wordData.initialDefinition ? ', d' : ', null as d'}
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || !result.records[0]) {
        throw new Error('Failed to create word');
      }

      const createdWord = result.records[0].get('w').properties;
      const createdDefinition = result.records[0].get('d')?.properties;

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: standardizedWord,
          nodeType: this.nodeLabel,
          nodeIdField: 'word', // Important: words use 'word' as ID
          createdBy: wordData.createdBy,
          initialComment: wordData.initialComment,
        });

      createdWord.discussionId = discussionResult.discussionId;

      // Track user participation if not API/AI created
      if (!isApiDefinition && !isAICreated) {
        await this.userSchema.addCreatedNode(
          wordData.createdBy,
          standardizedWord,
          'word',
        );

        if (createdDefinition) {
          await this.userSchema.addCreatedNode(
            wordData.createdBy,
            createdDefinition.id,
            'definition',
          );
        }
      }

      return {
        word: createdWord,
        definition: createdDefinition,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating word: ${error.message}`);
      throw this.standardError('create word', error);
    }
  }

  /**
   * Gets a word with its definitions and discussion
   */
  async getWord(word: string): Promise<WordNodeData | null> {
    const standardizedWord = this.standardizeWord(word);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {word: $word})
        OPTIONAL MATCH (w)<-[:DEFINES]-(d:DefinitionNode)
        WHERE d.inclusionNetVotes >= 0
        OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN w, 
               collect(d) as definitions,
               disc.id as discussionId
        ORDER BY d.inclusionNetVotes DESC
        `,
        { word: standardizedWord },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const definitions = record.get('definitions');
      const discussionId = record.get('discussionId');

      const mappedDefinitions = definitions
        ? definitions.map((d: any) => d.properties)
        : [];

      return {
        ...this.mapNodeFromRecord(record),
        definitions: mappedDefinitions,
        discussionId: discussionId,
      };
    } catch (error) {
      this.logger.error(`Error getting word: ${error.message}`);
      throw this.standardError('get word', error);
    }
  }

  /**
   * Gets all words (with optional filtering)
   */
  async getAllWords(
    options: {
      limit?: number;
      offset?: number;
      includeUnapproved?: boolean;
    } = {},
  ) {
    const { limit = 100, offset = 0, includeUnapproved = false } = options;

    try {
      const whereClause = includeUnapproved
        ? ''
        : 'WHERE w.inclusionNetVotes > 0';

      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        ${whereClause}
        OPTIONAL MATCH (w)<-[:DEFINES]-(d:DefinitionNode)
        OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN w, 
               collect(d) as definitions,
               disc.id as discussionId
        ORDER BY w.word ASC
        SKIP $offset
        LIMIT $limit
        `,
        { offset, limit },
      );

      return result.records.map((record) => {
        const definitions = record.get('definitions');
        const discussionId = record.get('discussionId');

        return {
          ...this.mapNodeFromRecord(record),
          definitions: definitions
            ? definitions.map((d: any) => d.properties)
            : [],
          discussionId: discussionId,
        };
      });
    } catch (error) {
      this.logger.error(`Error getting all words: ${error.message}`);
      throw this.standardError('get all words', error);
    }
  }

  /**
   * Gets approved words (passed inclusion threshold)
   */
  async getApprovedWords(
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'alphabetical' | 'votes' | 'created';
      sortDirection?: 'ASC' | 'DESC';
    } = {},
  ) {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'alphabetical',
      sortDirection = 'ASC',
    } = options;

    const orderByClause =
      sortBy === 'votes'
        ? `w.inclusionNetVotes ${sortDirection}`
        : sortBy === 'created'
          ? `w.createdAt ${sortDirection}`
          : `w.word ${sortDirection}`;

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        WHERE w.inclusionNetVotes > 0
        RETURN w
        ORDER BY ${orderByClause}
        SKIP $offset
        LIMIT $limit
        `,
        { offset, limit },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(`Error getting approved words: ${error.message}`);
      throw this.standardError('get approved words', error);
    }
  }

  /**
   * Checks if a word has passed inclusion threshold for definition creation
   */
  async isWordAvailableForDefinitionCreation(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);

    try {
      const wordData = await this.getWord(standardizedWord);
      if (!wordData) return false;

      return VotingUtils.isDefinitionCreationAllowed(
        wordData.inclusionNetVotes || 0,
      );
    } catch {
      return false;
    }
  }

  /**
   * Checks if a word is available for category composition
   */
  async isWordAvailableForCategoryComposition(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {word: $word})
        RETURN w.inclusionNetVotes as inclusionNetVotes
        `,
        { word: standardizedWord },
      );

      if (!result.records || result.records.length === 0) {
        return false;
      }

      const inclusionNetVotes = this.toNumber(
        result.records[0].get('inclusionNetVotes'),
      );

      return VotingUtils.hasPassedInclusion(inclusionNetVotes);
    } catch {
      return false;
    }
  }

  /**
   * Gets word statistics
   */
  async checkWords(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (w:WordNode) RETURN count(w) as count',
      );

      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      this.logger.error(`Error checking words: ${error.message}`);
      throw this.standardError('check words', error);
    }
  }
}
