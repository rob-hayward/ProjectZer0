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
    const isAICreated = wordData.createdBy === 'perplexity-ai';

    try {
      const result = await this.neo4jService.write(
        `
        MERGE (w:WordNode {word: $word})
        ON CREATE SET 
          w.id = randomUUID(),
          w.word = $word,
          w.createdBy = $createdBy,
          w.publicCredit = $publicCredit,
          w.createdAt = datetime(),
          w.updatedAt = datetime(),
          w.inclusionPositiveVotes = 0,
          w.inclusionNegativeVotes = 0,
          w.inclusionNetVotes = 0
        ON MATCH SET 
          w.updatedAt = datetime()
        WITH w
        CREATE (d:DefinitionNode {
          id: randomUUID(),
          definition: $initialDefinition,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes = CASE WHEN $isApiDefinition THEN ${VotingUtils.DEFAULT_API_INCLUSION_VOTES} ELSE 0 END,
          inclusionNegativeVotes = 0,
          inclusionNetVotes = CASE WHEN $isApiDefinition THEN ${VotingUtils.DEFAULT_API_INCLUSION_VOTES} ELSE 0 END,
          contentPositiveVotes = CASE WHEN $isApiDefinition THEN ${VotingUtils.DEFAULT_API_CONTENT_VOTES} ELSE 0 END,
          contentNegativeVotes = 0,
          contentNetVotes = CASE WHEN $isApiDefinition THEN ${VotingUtils.DEFAULT_API_CONTENT_VOTES} ELSE 0 END,
          wordAssociationScore = 1.0,
          isApi = $isApiDefinition,
          isAI = $isAICreated
        })
        CREATE (w)-[:HAS_DEFINITION]->(d)
        WITH w, d
        ${isApiDefinition ? '' : 'CALL ' + VotingUtils.USER_CREATION_VOTE_QUERY}
        RETURN w, d
        `,
        {
          word: standardizedWord,
          createdBy: wordData.createdBy,
          initialDefinition: wordData.initialDefinition,
          publicCredit: wordData.publicCredit,
          isApiDefinition,
          isAICreated,
          ...(isApiDefinition ? {} : { createdBy: wordData.createdBy }),
        },
      );

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
      throw new Error(`Failed to create word: ${error.message}`);
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
      throw new Error(`Failed to fetch word: ${error.message}`);
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
          word: wordNode.word,
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
      this.logger.error(
        `Error getting all words: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get all words: ${error.message}`);
    }
  }

  async deleteWord(word: string): Promise<{ success: boolean }> {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(`Deleting word: ${standardizedWord}`);

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

  // ❌ REMOVED: setVisibilityStatus() method - now handled by VisibilityService
  // ❌ REMOVED: getVisibilityStatus() method - now handled by VisibilityService

  // All other existing methods preserved exactly as-is...

  async addDefinition(wordData: {
    word: string;
    definition: string;
    createdBy: string;
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
        WITH w, d
        ${VotingUtils.USER_CREATION_VOTE_QUERY}
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
      throw new Error(`Failed to add definition to word: ${error.message}`);
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
        SET w.updatedAt = datetime()
        RETURN w
        `,
        { wordId, discussionId },
      );

      if (result.records.length === 0) {
        throw new Error('Word or discussion not found');
      }

      const updatedWord = result.records[0].get('w').properties;
      this.logger.log(
        `Successfully linked word to discussion: ${discussionId}`,
      );

      return {
        ...updatedWord,
        inclusionPositiveVotes: this.toNumber(
          updatedWord.inclusionPositiveVotes,
        ),
        inclusionNegativeVotes: this.toNumber(
          updatedWord.inclusionNegativeVotes,
        ),
        inclusionNetVotes: this.toNumber(updatedWord.inclusionNetVotes),
        discussionId: discussionId,
      };
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

  async isWordAvailableForCategoryComposition(
    wordId: string,
  ): Promise<boolean> {
    this.logger.debug(
      `Checking if word ${wordId} is available for category composition`,
    );

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {id: $wordId})
        WHERE w.inclusionNetVotes >= ${VotingUtils.CATEGORY_COMPOSITION_THRESHOLD}
        RETURN COUNT(w) > 0 as available
        `,
        { wordId },
      );

      const available = result.records[0].get('available');
      this.logger.debug(
        `Word ${wordId} available for category composition: ${available}`,
      );
      return available;
    } catch (error) {
      this.logger.error(
        `Error checking word availability for category composition: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to check word availability for category composition: ${error.message}`,
      );
    }
  }

  async isWordAvailableForDefinitionCreation(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);
    this.logger.debug(
      `Checking if word ${standardizedWord} is available for definition creation`,
    );

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {word: $word})
        WHERE w.inclusionNetVotes >= ${VotingUtils.DEFINITION_CREATION_THRESHOLD}
        RETURN COUNT(w) > 0 as available
        `,
        { word: standardizedWord },
      );

      const available = result.records[0].get('available');
      this.logger.debug(
        `Word ${standardizedWord} available for definition creation: ${available}`,
      );
      return available;
    } catch (error) {
      this.logger.error(
        `Error checking word availability for definition creation: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to check word availability for definition creation: ${error.message}`,
      );
    }
  }

  async checkWords(): Promise<{ count: number }> {
    this.logger.debug('Checking total word count');
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        RETURN COUNT(w) as count
        `,
        {},
      );

      const count = this.toNumber(result.records[0].get('count'));
      this.logger.debug(`Total word count: ${count}`);
      return { count };
    } catch (error) {
      this.logger.error(`Error checking words: ${error.message}`, error.stack);
      throw new Error(`Failed to check words: ${error.message}`);
    }
  }

  // UTILITY METHODS

  private toNumber(value: any): number {
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
}
