// src/neo4j/schemas/word.schema.ts
import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';

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

        // Create Word Node
        CREATE (w:WordNode {
            id: apoc.create.uuid(),
            word: $word,
            createdBy: $createdBy,
            publicCredit: $publicCredit,
            createdAt: datetime(),
            updatedAt: datetime(),
            positiveVotes: 0,
            negativeVotes: 0,
            netVotes: 0
        })

        // Create Definition Node
        CREATE (d:DefinitionNode {
            id: apoc.create.uuid(),
            definitionText: $initialDefinition,
            createdBy: $createdBy,
            createdAt: datetime(),
            positiveVotes: 0,
            negativeVotes: 0,
            netVotes: 0
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
            positiveVotes: 0,
            negativeVotes: 0,
            netVotes: 0
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
      // Use a simple and direct query
      const result = await this.neo4jService.read(
        `
        MATCH (n:WordNode) 
        RETURN n.id AS id, n.word AS word 
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
        SET w += $updateData
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
        SET w.discussionId = $discussionId
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

  async getWordVoteStatus(word: string, sub: string) {
    const standardizedWord = this.standardizeWord(word);
    return this.voteSchema.getVoteStatus(
      'WordNode',
      { word: standardizedWord },
      sub,
    );
  }

  async voteWord(word: string, sub: string, isPositive: boolean) {
    const standardizedWord = this.standardizeWord(word);
    return this.voteSchema.vote(
      'WordNode',
      { word: standardizedWord },
      sub,
      isPositive,
    );
  }

  async removeWordVote(word: string, sub: string) {
    const standardizedWord = this.standardizeWord(word);
    return this.voteSchema.removeVote(
      'WordNode',
      { word: standardizedWord },
      sub,
    );
  }

  async getWordVotes(word: string) {
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
        positiveVotes: voteStatus.positiveVotes,
        negativeVotes: voteStatus.negativeVotes,
        netVotes: voteStatus.netVotes,
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

  async setVisibilityStatus(wordId: string, isVisible: boolean) {
    this.logger.debug(
      `Setting visibility status for word ${wordId}: ${isVisible}`,
    );

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {id: $wordId})
        SET w.visibilityStatus = $isVisible
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

  async getVisibilityStatus(wordId: string) {
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
}
