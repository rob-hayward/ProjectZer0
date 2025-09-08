// src/neo4j/schemas/word.schema.ts
import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';
import { VotingUtils } from '../../config/voting.config';
import type { VoteStatus, VoteResult } from './vote.schema';

@Injectable()
export class WordSchema {
  private readonly logger = new Logger(WordSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly userSchema: UserSchema,
    private readonly voteSchema: VoteSchema,
  ) {}

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
      throw new Error(`Failed to check if word exists: ${error.message}`);
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
      this.logger.log(`Created word node: ${JSON.stringify(createdWord)}`);
      return createdWord;
    } catch (error) {
      this.logger.error(`Error creating word: ${error.message}`, error.stack);
      throw new Error(`Failed to create word: ${error.message}`);
    }
  }

  async addDefinition(wordData: {
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    const standardizedWord = this.standardizeWord(wordData.word);
    this.logger.debug(`Adding definition to word: ${standardizedWord}`);

    // Check if parent word has passed inclusion threshold
    const parentWord = await this.getWord(standardizedWord);
    if (
      !parentWord ||
      !VotingUtils.isDefinitionCreationAllowed(parentWord.inclusionNetVotes)
    ) {
      throw new Error(
        'Parent word must pass inclusion threshold before definitions can be added',
      );
    }

    const isApiDefinition = wordData.createdBy === 'FreeDictionaryAPI';
    const isAICreated = wordData.createdBy === 'ProjectZeroAI';

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {word: $word})
        CREATE (d:DefinitionNode {
            id: apoc.create.uuid(),
            definitionText: $definitionText,
            createdBy: $createdBy,
            createdAt: datetime(),
            // Definition nodes have both inclusion and content voting
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0,
            contentPositiveVotes: 0,
            contentNegativeVotes: 0,
            contentNetVotes: 0
        })
        CREATE (w)-[:HAS_DEFINITION]->(d)

        WITH d, $createdBy as userId
        WHERE NOT $isApiDefinition AND NOT $isAICreated
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'definition'
        }]->(d)

        RETURN d
        `,
        { ...wordData, word: standardizedWord, isApiDefinition, isAICreated },
      );

      if (!result.records || !result.records[0]) {
        this.logger.error('No result returned from definition creation');
        throw new Error('Failed to create definition');
      }

      const addedDefinition = result.records[0].get('d').properties;
      this.logger.debug(`Added definition: ${JSON.stringify(addedDefinition)}`);
      return addedDefinition;
    } catch (error) {
      this.logger.error(
        `Error adding definition: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to add definition: ${error.message}`);
    }
  }

  async getWord(word: string) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.debug(`Fetching word: ${standardizedWord}`);

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
      wordNode.definitions = result.records[0]
        .get('definitions')
        .map((d) => d.properties);

      const discussion = result.records[0].get('disc');
      if (discussion) {
        wordNode.discussionId = discussion.properties.id;
      }

      // Convert Neo4j integers to JavaScript numbers (inclusion voting only)
      if (wordNode.inclusionPositiveVotes !== undefined) {
        wordNode.inclusionPositiveVotes = this.toNumber(
          wordNode.inclusionPositiveVotes,
        );
      }
      if (wordNode.inclusionNegativeVotes !== undefined) {
        wordNode.inclusionNegativeVotes = this.toNumber(
          wordNode.inclusionNegativeVotes,
        );
      }
      if (wordNode.inclusionNetVotes !== undefined) {
        wordNode.inclusionNetVotes = this.toNumber(wordNode.inclusionNetVotes);
      }

      this.logger.debug(`Fetched word node: ${JSON.stringify(wordNode)}`);
      return wordNode;
    } catch (error) {
      this.logger.error(`Error fetching word: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch word: ${error.message}`);
    }
  }

  async getAllWords() {
    this.logger.debug('Fetching all words from database');
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (n:WordNode) 
        RETURN n.id AS id, n.word AS word, 
               n.inclusionPositiveVotes AS inclusionPositiveVotes,
               n.inclusionNegativeVotes AS inclusionNegativeVotes,
               n.inclusionNetVotes AS inclusionNetVotes
        ORDER BY toLower(n.word)
        `,
        {},
      );

      if (!result.records || result.records.length === 0) {
        this.logger.debug('No words found in the database');
        return [];
      }

      const words = result.records
        .filter((record) => record.get('word') && record.get('id'))
        .map((record) => ({
          word: record.get('word'),
          id: record.get('id'),
          inclusionPositiveVotes: this.toNumber(
            record.get('inclusionPositiveVotes'),
          ),
          inclusionNegativeVotes: this.toNumber(
            record.get('inclusionNegativeVotes'),
          ),
          inclusionNetVotes: this.toNumber(record.get('inclusionNetVotes')),
        }));

      this.logger.debug(`Fetched ${words.length} words from database`);
      return words;
    } catch (error) {
      this.logger.error(
        `Error fetching all words: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch all words: ${error.message}`);
    }
  }

  async updateWord(
    word: string,
    updateData: {
      liveDefinition?: string;
    },
  ) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.debug(
      `Updating word: ${standardizedWord} with data: ${JSON.stringify(updateData)}`,
    );

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {word: $word})
        SET w += $updateData, w.updatedAt = datetime()
        RETURN w
        `,
        { word: standardizedWord, updateData },
      );

      if (!result.records || result.records.length <= 0) {
        this.logger.warn(`Word not found for update: ${standardizedWord}`);
        return null;
      }

      const updatedWord = result.records[0].get('w').properties;
      this.logger.debug(`Updated word: ${JSON.stringify(updatedWord)}`);
      return updatedWord;
    } catch (error) {
      this.logger.error(`Error updating word: ${error.message}`, error.stack);
      throw new Error(`Failed to update word: ${error.message}`);
    }
  }

  async updateWordWithDiscussionId(wordId: string, discussionId: string) {
    this.logger.debug(
      `Updating word ${wordId} with discussion ID ${discussionId}`,
    );

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {id: $wordId})
        SET w.discussionId = $discussionId, w.updatedAt = datetime()
        RETURN w
        `,
        { wordId, discussionId },
      );

      const updatedWord = result.records[0].get('w').properties;
      this.logger.debug(
        `Updated word with discussion ID: ${JSON.stringify(updatedWord)}`,
      );
      return updatedWord;
    } catch (error) {
      this.logger.error(
        `Error updating word with discussion ID: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to update word with discussion ID: ${error.message}`,
      );
    }
  }

  async deleteWord(word: string) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.debug(`Deleting word: ${standardizedWord}`);

    try {
      await this.neo4jService.write(
        `
        MATCH (w:WordNode {word: $word})
        DETACH DELETE w
        `,
        { word: standardizedWord },
      );

      this.logger.debug(`Deleted word: ${standardizedWord}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting word: ${error.message}`, error.stack);
      throw new Error(`Failed to delete word: ${error.message}`);
    }
  }

  // Updated voting methods - INCLUSION ONLY for Words

  async getWordVoteStatus(
    word: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    const standardizedWord = this.standardizeWord(word);
    return this.voteSchema.getVoteStatus(
      'WordNode',
      { word: standardizedWord },
      sub,
    );
  }

  async voteWordInclusion(
    word: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(
      `Processing inclusion vote on word ${standardizedWord} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
    );
    return this.voteSchema.vote(
      'WordNode',
      { word: standardizedWord },
      sub,
      isPositive,
      'INCLUSION',
    );
  }

  async removeWordVote(word: string, sub: string): Promise<VoteResult> {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(
      `Removing inclusion vote from word ${standardizedWord} by user ${sub}`,
    );
    return this.voteSchema.removeVote(
      'WordNode',
      { word: standardizedWord },
      sub,
      'INCLUSION',
    );
  }

  async getWordVotes(word: string): Promise<VoteResult | null> {
    const standardizedWord = this.standardizeWord(word);

    try {
      const voteStatus = await this.voteSchema.getVoteStatus(
        'WordNode',
        { word: standardizedWord },
        '', // Empty string as we don't need user-specific status
      );

      if (!voteStatus) {
        this.logger.debug(`No votes found for word: ${standardizedWord}`);
        return null;
      }

      const votes = {
        inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
        inclusionNetVotes: voteStatus.inclusionNetVotes,
        // Words don't have content voting
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
      };

      this.logger.debug(
        `Votes for word ${standardizedWord}: ${JSON.stringify(votes)}`,
      );
      return votes;
    } catch (error) {
      this.logger.error(
        `Error getting word votes: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get word votes: ${error.message}`);
    }
  }

  // Visibility methods (preserved from original)

  async setVisibilityStatus(wordId: string, isVisible: boolean) {
    this.logger.debug(
      `Setting visibility status for word ${wordId}: ${isVisible}`,
    );

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {id: $wordId})
        SET w.visibilityStatus = $isVisible, w.updatedAt = datetime()
        RETURN w
        `,
        { wordId, isVisible },
      );

      const updatedWord = result.records[0].get('w').properties;
      this.logger.debug(
        `Updated word visibility status: ${JSON.stringify(updatedWord)}`,
      );
      return updatedWord;
    } catch (error) {
      this.logger.error(
        `Error setting word visibility status: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to set word visibility status: ${error.message}`);
    }
  }

  async getVisibilityStatus(wordId: string): Promise<boolean> {
    this.logger.debug(`Getting visibility status for word ${wordId}`);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {id: $wordId})
        RETURN w.visibilityStatus
        `,
        { wordId },
      );

      const visibilityStatus =
        result.records[0]?.get('w.visibilityStatus') ?? true;
      this.logger.debug(
        `Visibility status for word ${wordId}: ${visibilityStatus}`,
      );
      return visibilityStatus;
    } catch (error) {
      this.logger.error(
        `Error getting word visibility status: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get word visibility status: ${error.message}`);
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
  ): Promise<any[]> {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'alphabetical',
        sortDirection = 'asc',
      } = options;

      let query = `
        MATCH (w:WordNode)
        WHERE w.inclusionNetVotes > 0 
        AND (w.visibilityStatus <> false OR w.visibilityStatus IS NULL)
      `;

      // Add sorting
      if (sortBy === 'alphabetical') {
        query += ` ORDER BY w.word ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'votes') {
        query += ` ORDER BY w.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'created') {
        query += ` ORDER BY w.createdAt ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      if (limit !== null) {
        query += ` SKIP $offset LIMIT $limit`;
      }

      query += `
        RETURN {
          id: w.id,
          word: w.word,
          inclusionPositiveVotes: w.inclusionPositiveVotes,
          inclusionNegativeVotes: w.inclusionNegativeVotes,
          inclusionNetVotes: w.inclusionNetVotes,
          createdBy: w.createdBy,
          publicCredit: w.publicCredit,
          createdAt: w.createdAt
        } as word
      `;

      const result = await this.neo4jService.read(query, { offset, limit });
      const words = result.records.map((record) => {
        const word = record.get('word');
        // Convert Neo4j integers
        [
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
        ].forEach((prop) => {
          if (word[prop] !== undefined) {
            word[prop] = this.toNumber(word[prop]);
          }
        });
        return word;
      });

      this.logger.debug(`Retrieved ${words.length} approved words`);
      return words;
    } catch (error) {
      this.logger.error(
        `Error getting approved words: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get approved words: ${error.message}`);
    }
  }

  /**
   * Check total word count for admin/stats purposes
   */
  async checkWords(): Promise<{ count: number }> {
    try {
      this.logger.debug('Getting total word count');

      const result = await this.neo4jService.read(
        'MATCH (w:WordNode) RETURN count(w) as count',
      );

      const count = this.toNumber(result.records[0].get('count'));
      this.logger.debug(`Total words found: ${count}`);

      return { count };
    } catch (error) {
      this.logger.error(`Error checking words: ${error.message}`, error.stack);
      throw new Error(`Failed to check words: ${error.message}`);
    }
  }

  /**
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle Neo4j integer objects
    if (typeof value === 'object' && value !== null) {
      if ('low' in value) {
        return Number(value.low);
      } else if ('valueOf' in value) {
        return Number(value.valueOf());
      }
    }

    return Number(value);
  }
}
