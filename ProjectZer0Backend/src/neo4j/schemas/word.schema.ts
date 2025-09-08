// src/neo4j/schemas/word.schema.ts
import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';

// Word-specific data interface extending BaseNodeData
export interface WordNode extends BaseNodeData {
  word: string; // The actual word text (unique identifier)
  createdBy: string;
  publicCredit: boolean;
  definitions?: any[]; // Will be populated by getWord()
  discussionId?: string; // Will be populated by getWord()
}

@Injectable()
export class WordSchema extends BaseNodeSchema<WordNode> {
  protected readonly nodeLabel = 'WordNode';
  protected readonly idField = 'word'; // WordSchema uses 'word' field as identifier

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, WordSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return false; // Words only support inclusion voting
  }

  protected mapNodeFromRecord(record: Record): WordNode {
    const props = record.get('n').properties;
    return {
      id: props.word, // Use word as id for BaseNodeData compatibility
      word: props.word,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // Words don't have content voting
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(word: string, data: Partial<WordNode>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id') // Don't update the id field
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:WordNode {word: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id: word, updateData: data },
    };
  }

  // WORD-SPECIFIC METHODS - Keep all unique functionality

  private standardizeWord(word: string): string {
    const standardized = word.trim().toLowerCase();
    this.logger.debug(`Standardized word: '${word}' to '${standardized}'`);
    return standardized;
  }

  async checkWordExistence(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);
    this.logger.debug(
      `Checking existence of standardized word: ${standardizedWord}`,
    );
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {word: $word})
        RETURN COUNT(w) > 0 as exists
        `,
        { word: standardizedWord },
      );
      const exists = result.records[0].get('exists');
      this.logger.debug(`Word '${standardizedWord}' exists: ${exists}`);
      return exists;
    } catch (error) {
      this.logger.error(
        `Error checking word existence: ${error.message}`,
        error.stack,
      );
      throw this.standardError('check if word exists', error);
    }
  }

  async createWord(wordData: {
    word: string;
    createdBy: string;
    initialDefinition: string;
    publicCredit: boolean;
  }) {
    this.logger.log(`Creating word with data: ${JSON.stringify(wordData)}`);
    const standardizedWord = this.standardizeWord(wordData.word);
    this.logger.debug(`Standardized word for creation: ${standardizedWord}`);
    const isApiDefinition = wordData.createdBy === 'FreeDictionaryAPI';
    const isAICreated = wordData.createdBy === 'ProjectZeroAI';

    try {
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

        // Create Word Node (inclusion voting only)
        CREATE (w:WordNode {
            id: apoc.create.uuid(),
            word: $word,
            createdBy: $createdBy,
            publicCredit: $publicCredit,
            createdAt: datetime(),
            updatedAt: datetime(),
            // Inclusion voting only (no content voting)
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0
        })

        // Create Definition Node (this will be updated later to use new DefinitionSchema)
        CREATE (d:DefinitionNode {
            id: apoc.create.uuid(),
            definitionText: $initialDefinition,
            createdBy: $createdBy,
            createdAt: datetime(),
            // Definition nodes will have both inclusion and content voting
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0,
            contentPositiveVotes: 0,
            contentNegativeVotes: 0,
            contentNetVotes: 0
        })

        // Create HAS_DEFINITION relationship
        CREATE (w)-[:HAS_DEFINITION]->(d)

        // Create CREATED relationships for user-created content
        WITH w, d, $createdBy as userId
        WHERE NOT $isApiDefinition AND NOT $isAICreated
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'word'
        }]->(w)
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'definition'
        }]->(d)

        RETURN w, d
        `,
        {
          ...wordData,
          word: standardizedWord,
          isApiDefinition,
          isAICreated,
        },
      );

      if (!result.records || !result.records[0]) {
        this.logger.error('No result returned from word creation');
        throw new Error('Failed to create word');
      }

      const createdWord = result.records[0].get('w').properties;
      const createdDefinition = result.records[0].get('d').properties;

      if (!isApiDefinition) {
        await this.userSchema.addCreatedNode(
          wordData.createdBy,
          createdWord.id,
          'word',
        );
        await this.userSchema.addCreatedNode(
          wordData.createdBy,
          createdDefinition.id,
          'definition',
        );
      }

      this.logger.log(
        `Successfully created word: ${createdWord.word} with definition: ${createdDefinition.id}`,
      );

      return {
        word: createdWord,
        definition: createdDefinition,
      };
    } catch (error) {
      this.logger.error(`Error creating word: ${error.message}`, error.stack);
      throw this.standardError('create word', error);
    }
  }

  async addDefinition(wordData: {
    word: string;
    createdBy: string;
    definition: string;
    publicCredit: boolean;
  }) {
    this.logger.log(`Adding definition to word: ${wordData.word}`);
    const standardizedWord = this.standardizeWord(wordData.word);

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {word: $word})
        CREATE (d:DefinitionNode {
          id: randomUUID(),
          definition: $definition,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0,
          wordAssociationScore: 1.0
        })
        CREATE (w)-[:HAS_DEFINITION]->(d)
        RETURN d
        `,
        {
          word: standardizedWord,
          definition: wordData.definition,
          createdBy: wordData.createdBy,
          publicCredit: wordData.publicCredit,
        },
      );

      const createdDefinition = result.records[0].get('d').properties;

      await this.userSchema.addCreatedNode(
        wordData.createdBy,
        createdDefinition.id,
        'definition',
      );

      this.logger.log(
        `Successfully added definition: ${createdDefinition.id} to word: ${standardizedWord}`,
      );

      return createdDefinition;
    } catch (error) {
      this.logger.error(
        `Error adding definition to word: ${error.message}`,
        error.stack,
      );
      throw this.standardError('add definition to word', error);
    }
  }

  async getWord(word: string) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.debug(`Getting word: ${standardizedWord}`);
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        WHERE toLower(w.word) = toLower($word)
        OPTIONAL MATCH (w)-[:HAS_DEFINITION]->(d:DefinitionNode)
        OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN w, collect(d) as definitions, disc
        `,
        { word: standardizedWord },
      );

      if (result.records.length === 0) {
        this.logger.debug(`Word not found: ${standardizedWord}`);
        return null;
      }

      const wordNode = result.records[0].get('w').properties;
      const definitions = result.records[0].get('definitions');
      const discussion = result.records[0].get('disc');

      const mappedDefinitions = definitions
        ? definitions.map((d: any) => d.properties)
        : [];

      const wordData = {
        ...wordNode,
        word: wordNode.word,
        inclusionPositiveVotes: this.toNumber(wordNode.inclusionPositiveVotes),
        inclusionNegativeVotes: this.toNumber(wordNode.inclusionNegativeVotes),
        inclusionNetVotes: this.toNumber(wordNode.inclusionNetVotes),
        definitions: mappedDefinitions,
        discussionId: discussion?.properties?.id,
      };

      this.logger.debug(`Retrieved word: ${JSON.stringify(wordData)}`);
      return wordData;
    } catch (error) {
      this.logger.error(`Error fetching word: ${error.message}`, error.stack);
      throw this.standardError('fetch word', error);
    }
  }

  async getAllWords() {
    this.logger.debug('Getting all words');
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        OPTIONAL MATCH (w)-[:HAS_DEFINITION]->(d:DefinitionNode)
        OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        RETURN w, collect(d) as definitions, disc
        ORDER BY w.createdAt DESC
        `,
        {},
      );

      const words = result.records.map((record) => {
        const wordNode = record.get('w').properties;
        const definitions = record.get('definitions');
        const discussion = record.get('disc');

        const mappedDefinitions = definitions
          ? definitions.map((d: any) => d.properties)
          : [];

        return {
          ...wordNode,
          inclusionPositiveVotes: this.toNumber(
            wordNode.inclusionPositiveVotes,
          ),
          inclusionNegativeVotes: this.toNumber(
            wordNode.inclusionNegativeVotes,
          ),
          inclusionNetVotes: this.toNumber(wordNode.inclusionNetVotes),
          definitions: mappedDefinitions,
          discussionId: discussion?.properties?.id,
        };
      });

      this.logger.debug(`Retrieved ${words.length} words`);
      return words;
    } catch (error) {
      this.logger.error('Error getting all words', error.stack);
      throw this.standardError('get all words', error);
    }
  }

  async updateWordWithDiscussionId(wordId: string, discussionId: string) {
    this.logger.log(
      `Updating word ${wordId} with discussion ID: ${discussionId}`,
    );

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {id: $wordId})
        MATCH (d:DiscussionNode {id: $discussionId})
        CREATE (w)-[:HAS_DISCUSSION]->(d)
        RETURN w
        `,
        { wordId, discussionId },
      );

      const updatedWord = result.records[0].get('w').properties;
      this.logger.log(
        `Successfully updated word ${wordId} with discussion ID: ${discussionId}`,
      );
      return updatedWord;
    } catch (error) {
      this.logger.error(
        `Error updating word with discussion ID: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update word with discussion ID', error);
    }
  }

  async checkWords() {
    this.logger.debug('Checking word count');
    try {
      const result = await this.neo4jService.read(
        'MATCH (w:WordNode) RETURN count(w) as count',
      );
      const count = this.toNumber(result.records[0].get('count'));
      this.logger.debug(`Total word count: ${count}`);
      return { count };
    } catch (error) {
      this.logger.error(`Error checking words: ${error.message}`, error.stack);
      throw this.standardError('check words', error);
    }
  }

  /**
   * Check if a word can be used for category composition (has passed inclusion threshold)
   */
  async isWordAvailableForCategoryComposition(
    wordId: string,
  ): Promise<boolean> {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {id: $wordId})
        RETURN w.inclusionNetVotes as inclusionNetVotes
        `,
        { wordId },
      );

      if (!result.records || result.records.length === 0) {
        return false;
      }

      const inclusionNetVotes = this.toNumber(
        result.records[0].get('inclusionNetVotes'),
      );
      return VotingUtils.hasPassedInclusion(inclusionNetVotes);
    } catch (error) {
      this.logger.error(
        `Error checking word availability for category composition: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Check if a word can be used for definition creation (has passed inclusion threshold)
   */
  async isWordAvailableForDefinitionCreation(word: string): Promise<boolean> {
    try {
      const wordData = await this.getWord(word);
      if (!wordData) return false;

      return VotingUtils.isDefinitionCreationAllowed(
        wordData.inclusionNetVotes,
      );
    } catch (error) {
      this.logger.error(
        `Error checking word availability for definition creation: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get words that have passed inclusion threshold (for category composition)
   */
  async getApprovedWords(
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'alphabetical' | 'votes' | 'created';
      sortDirection?: 'asc' | 'desc';
    } = {},
  ) {
    const {
      limit = 100,
      offset = 0,
      sortBy = 'alphabetical',
      sortDirection = 'asc',
    } = options;

    try {
      let orderByClause = '';
      switch (sortBy) {
        case 'alphabetical':
          orderByClause = `ORDER BY w.word ${sortDirection.toUpperCase()}`;
          break;
        case 'votes':
          orderByClause = `ORDER BY w.inclusionNetVotes ${sortDirection.toUpperCase()}`;
          break;
        case 'created':
          orderByClause = `ORDER BY w.createdAt ${sortDirection.toUpperCase()}`;
          break;
      }

      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        WHERE w.inclusionNetVotes > 0
        ${orderByClause}
        SKIP $offset
        LIMIT $limit
        RETURN w
        `,
        { limit, offset },
      );

      return result.records.map((record) => {
        const wordNode = record.get('w').properties;
        return {
          ...wordNode,
          inclusionPositiveVotes: this.toNumber(
            wordNode.inclusionPositiveVotes,
          ),
          inclusionNegativeVotes: this.toNumber(
            wordNode.inclusionNegativeVotes,
          ),
          inclusionNetVotes: this.toNumber(wordNode.inclusionNetVotes),
        };
      });
    } catch (error) {
      this.logger.error(
        `Error getting approved words: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get approved words', error);
    }
  }

  // ❌ REMOVED: All voting methods now inherited from BaseNodeSchema
  // - voteWordInclusion() -> use inherited voteInclusion()
  // - getWordVoteStatus() -> use inherited getVoteStatus()
  // - removeWordVote() -> use inherited removeVote()
  // - getWordVotes() -> use inherited getVotes()

  // ❌ REMOVED: All visibility methods now delegated to VisibilityService
  // - setVisibilityStatus() -> VisibilityService.setUserVisibilityPreference()
  // - getVisibilityStatus() -> VisibilityService.getObjectVisibility()
}
