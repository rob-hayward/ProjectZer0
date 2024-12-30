import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';

@Injectable()
export class WordSchema {
  private readonly logger = new Logger(WordSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly userSchema: UserSchema,
  ) {}

  private standardizeWord(word: string): string {
    const standardized = word.trim().toLowerCase();
    this.logger.log(`Standardized word: '${word}' to '${standardized}'`);
    return standardized;
  }

  async initializeConstraints() {
    this.logger.log('Initializing word uniqueness constraint');
    await this.neo4jService.write(
      'CREATE CONSTRAINT word_unique IF NOT EXISTS FOR (w:WordNode) REQUIRE w.word IS UNIQUE',
    );
    this.logger.log('Word uniqueness constraint initialized');
  }

  async checkWordExistence(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(
      `Checking existence of standardized word: ${standardizedWord}`,
    );
    const result = await this.neo4jService.read(
      `
      MATCH (w:WordNode {word: $word})
      RETURN COUNT(w) > 0 as exists
      `,
      { word: standardizedWord },
    );
    const exists = result.records[0].get('exists');
    this.logger.log(`Word '${standardizedWord}' exists: ${exists}`);
    return exists;
  }

  async createWord(wordData: {
    word: string;
    createdBy: string;
    initialDefinition: string;
    publicCredit: boolean;
  }) {
    this.logger.log(`Creating word with data: ${JSON.stringify(wordData)}`);
    const standardizedWord = this.standardizeWord(wordData.word);
    this.logger.log(`Standardized word for creation: ${standardizedWord}`);
    const isApiDefinition = wordData.createdBy === 'FreeDictionaryAPI';
    const isAICreated = wordData.createdBy === 'ProjectZeroAI';

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
          updatedAt: datetime()
      })

      // Create Definition Node
      CREATE (d:DefinitionNode {
          id: apoc.create.uuid(),
          text: $initialDefinition,
          createdBy: $createdBy,
          createdAt: datetime(),
          votes: CASE WHEN $isApiDefinition OR $isAICreated THEN 0 ELSE 1 END
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

    const createdWord = result.records[0].get('w').properties;
    const initialDefinition = result.records[0].get('d').properties;

    // If this is a user-created definition, add the vote
    if (!isApiDefinition && !isAICreated) {
      await this.addDefinitionVote(initialDefinition.id, wordData.createdBy);
    }

    this.logger.log(`Created word node: ${JSON.stringify(createdWord)}`);
    return createdWord;
  }

  async addDefinitionVote(definitionId: string, userId: string) {
    return this.neo4jService.write(
      `
      MATCH (d:DefinitionNode {id: $definitionId})
      MERGE (u:User {sub: $userId})
      CREATE (u)-[:VOTED_ON {createdAt: datetime(), value: 1}]->(d)
      SET d.votes = 1
      RETURN d
      `,
      { definitionId, userId },
    );
  }

  async addDefinition(wordData: {
    word: string;
    createdBy: string;
    definitionText: string;
  }) {
    const standardizedWord = this.standardizeWord(wordData.word);
    this.logger.log(`Adding definition to word: ${standardizedWord}`);
    const isApiDefinition = wordData.createdBy === 'FreeDictionaryAPI';
    const isAICreated = wordData.createdBy === 'ProjectZeroAI';

    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      CREATE (d:DefinitionNode {
          id: apoc.create.uuid(),
          text: $definitionText,
          createdBy: $createdBy,
          createdAt: datetime(),
          votes: CASE WHEN $isApiDefinition OR $isAICreated THEN 0 ELSE 1 END
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
    const addedDefinition = result.records[0].get('d').properties;
    this.logger.log(`Added definition: ${JSON.stringify(addedDefinition)}`);
    return addedDefinition;
  }

  async getWord(word: string) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(`Fetching word: ${standardizedWord}`);
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
      this.logger.log(`Word not found: ${standardizedWord}`);
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
    this.logger.log(`Fetched word node: ${JSON.stringify(wordNode)}`);
    return wordNode;
  }

  async updateWord(
    word: string,
    updateData: {
      liveDefinition?: string;
    },
  ) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(
      `Updating word: ${standardizedWord} with data: ${JSON.stringify(updateData)}`,
    );
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      SET w += $updateData
      RETURN w
      `,
      { word: standardizedWord, updateData },
    );
    const updatedWord = result.records[0].get('w').properties;
    this.logger.log(`Updated word: ${JSON.stringify(updatedWord)}`);
    return updatedWord;
  }

  async updateWordWithDiscussionId(wordId: string, discussionId: string) {
    this.logger.log(
      `Updating word ${wordId} with discussion ID ${discussionId}`,
    );
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {id: $wordId})
      SET w.discussionId = $discussionId
      RETURN w
      `,
      { wordId, discussionId },
    );
    const updatedWord = result.records[0].get('w').properties;
    this.logger.log(
      `Updated word with discussion ID: ${JSON.stringify(updatedWord)}`,
    );
    return updatedWord;
  }

  async deleteWord(word: string) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(`Deleting word: ${standardizedWord}`);
    await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      DETACH DELETE w
      `,
      { word: standardizedWord },
    );
    this.logger.log(`Deleted word: ${standardizedWord}`);
  }

  async voteWord(word: string, userId: string, isPositive: boolean) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(
      `Voting on word: ${standardizedWord} by user: ${userId}, isPositive: ${isPositive}`,
    );
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {word: $word})
      MERGE (u:User {id: $userId})
      MERGE (u)-[v:VOTED_ON]->(w)
      ON CREATE SET v.vote = $isPositive
      ON MATCH SET v.vote = $isPositive
      WITH w, v
      SET w.positiveVotes = w.positiveVotes + CASE WHEN v.vote = true THEN 1 ELSE 0 END,
          w.negativeVotes = w.negativeVotes + CASE WHEN v.vote = false THEN 1 ELSE 0 END
      RETURN w
      `,
      { word: standardizedWord, userId, isPositive },
    );
    const votedWord = result.records[0].get('w').properties;
    this.logger.log(`Vote result: ${JSON.stringify(votedWord)}`);
    return votedWord;
  }

  async getWordVotes(word: string) {
    const standardizedWord = this.standardizeWord(word);
    this.logger.log(`Getting votes for word: ${standardizedWord}`);
    const result = await this.neo4jService.read(
      `
      MATCH (w:WordNode {word: $word})
      RETURN w.positiveVotes as positiveVotes, w.negativeVotes as negativeVotes
      `,
      { word: standardizedWord },
    );
    if (result.records.length === 0) {
      this.logger.log(`No votes found for word: ${standardizedWord}`);
      return null;
    }
    const votes = {
      positiveVotes: result.records[0].get('positiveVotes'),
      negativeVotes: result.records[0].get('negativeVotes'),
    };
    this.logger.log(
      `Votes for word ${standardizedWord}: ${JSON.stringify(votes)}`,
    );
    return votes;
  }

  async setVisibilityStatus(wordId: string, isVisible: boolean) {
    this.logger.log(
      `Setting visibility status for word ${wordId}: ${isVisible}`,
    );
    const result = await this.neo4jService.write(
      `
      MATCH (w:WordNode {id: $wordId})
      SET w.visibilityStatus = $isVisible
      RETURN w
      `,
      { wordId, isVisible },
    );
    const updatedWord = result.records[0].get('w').properties;
    this.logger.log(
      `Updated word visibility status: ${JSON.stringify(updatedWord)}`,
    );
    return updatedWord;
  }

  async getVisibilityStatus(wordId: string) {
    this.logger.log(`Getting visibility status for word ${wordId}`);
    const result = await this.neo4jService.read(
      `
      MATCH (w:WordNode {id: $wordId})
      RETURN w.visibilityStatus
      `,
      { wordId },
    );
    const visibilityStatus =
      result.records[0]?.get('w.visibilityStatus') ?? true;
    this.logger.log(
      `Visibility status for word ${wordId}: ${visibilityStatus}`,
    );
    return visibilityStatus;
  }
}
