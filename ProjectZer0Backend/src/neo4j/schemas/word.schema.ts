// src/neo4j/schemas/word.schema.ts
import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserSchema } from './user.schema';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';

export interface WordNode extends BaseNodeData {
  word: string;
  definitions?: any[];
}

@Injectable()
export class WordSchema extends BaseNodeSchema<WordNode> {
  protected readonly nodeLabel = 'WordNode';
  protected readonly idField = 'word';

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, WordSchema.name);
  }

  protected supportsContentVoting(): boolean {
    return false;
  }

  protected mapNodeFromRecord(record: Record): WordNode {
    const props = record.get('n').properties;
    return {
      id: props.word,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      word: props.word,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(word: string, data: Partial<WordNode>) {
    const setClause = Object.keys(data)
      .filter((key) => key !== 'id')
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

  async voteInclusion(word: string, userId: string, isPositive: boolean) {
    const standardizedWord = this.standardizeWord(word);
    return super.voteInclusion(standardizedWord, userId, isPositive);
  }

  async getVoteStatus(word: string, userId: string) {
    const standardizedWord = this.standardizeWord(word);
    return super.getVoteStatus(standardizedWord, userId);
  }

  async removeVote(word: string, userId: string, kind: any) {
    const standardizedWord = this.standardizeWord(word);
    return super.removeVote(standardizedWord, userId, kind);
  }

  async getVotes(word: string) {
    const standardizedWord = this.standardizeWord(word);
    return super.getVotes(standardizedWord);
  }

  async findById(word: string) {
    const standardizedWord = this.standardizeWord(word);
    return super.findById(standardizedWord);
  }

  async update(word: string, updateData: Partial<WordNode>) {
    const standardizedWord = this.standardizeWord(word);
    return super.update(standardizedWord, updateData);
  }

  async delete(word: string) {
    const standardizedWord = this.standardizeWord(word);
    return super.delete(standardizedWord);
  }

  private standardizeWord(word: string): string {
    return word.trim().toLowerCase();
  }

  async checkWordExistence(word: string): Promise<boolean> {
    const standardizedWord = this.standardizeWord(word);
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode {word: $word})
        RETURN COUNT(w) > 0 as exists
        `,
        { word: standardizedWord },
      );
      return result.records[0].get('exists');
    } catch (error) {
      throw this.standardError('check if word exists', error);
    }
  }

  async createWord(wordData: {
    word: string;
    createdBy: string;
    publicCredit: boolean;
    initialDefinition: string;
    initialComment?: string;
  }) {
    const standardizedWord = this.standardizeWord(wordData.word);
    const isApiDefinition = wordData.createdBy === 'FreeDictionaryAPI';
    const isAICreated = wordData.createdBy === 'ProjectZeroAI';

    try {
      const result = await this.neo4jService.write(
        `
        CALL {
          WITH $createdBy as userId
          WITH userId
          WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'
          MERGE (u:User {sub: userId})
          RETURN u
        }

        CREATE (w:WordNode {
            id: apoc.create.uuid(),
            word: $word,
            createdBy: $createdBy,
            publicCredit: $publicCredit,
            createdAt: datetime(),
            updatedAt: datetime(),
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0
        })

        CREATE (d:DefinitionNode {
            id: apoc.create.uuid(),
            definitionText: $initialDefinition,
            createdBy: $createdBy,
            createdAt: datetime(),
            inclusionPositiveVotes: 0,
            inclusionNegativeVotes: 0,
            inclusionNetVotes: 0,
            contentPositiveVotes: 0,
            contentNegativeVotes: 0,
            contentNetVotes: 0
        })

        CREATE (w)-[:HAS_DEFINITION]->(d)

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
        throw new Error('Failed to create word');
      }

      const createdWord = result.records[0].get('w').properties;
      const createdDefinition = result.records[0].get('d').properties;

      const discussionId = await this.createDiscussion({
        nodeId: standardizedWord,
        nodeType: this.nodeLabel,
        createdBy: wordData.createdBy,
        initialComment: wordData.initialComment,
      });

      createdWord.discussionId = discussionId;

      if (!isApiDefinition && !isAICreated) {
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

      return {
        word: createdWord,
        definition: createdDefinition,
      };
    } catch (error) {
      throw this.standardError('create word', error);
    }
  }

  async addDefinition(wordData: {
    word: string;
    createdBy: string;
    definitionText: string;
    publicCredit: boolean;
  }) {
    const standardizedWord = this.standardizeWord(wordData.word);

    try {
      const result = await this.neo4jService.write(
        `
        MATCH (w:WordNode {word: $word})
        CREATE (d:DefinitionNode {
          id: apoc.create.uuid(),
          definitionText: $definitionText,
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
          definitionText: wordData.definitionText,
          createdBy: wordData.createdBy,
          publicCredit: wordData.publicCredit,
        },
      );

      const createdDefinition = result.records[0].get('d').properties;

      if (
        wordData.createdBy !== 'FreeDictionaryAPI' &&
        wordData.createdBy !== 'ProjectZeroAI'
      ) {
        await this.userSchema.addCreatedNode(
          wordData.createdBy,
          createdDefinition.id,
          'definition',
        );
      }

      return createdDefinition;
    } catch (error) {
      throw this.standardError('add definition to word', error);
    }
  }

  async getWord(word: string) {
    const standardizedWord = this.standardizeWord(word);
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        WHERE toLower(w.word) = toLower($word)
        OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        OPTIONAL MATCH (w)-[:HAS_DEFINITION]->(d:DefinitionNode)
        RETURN w, collect(d) as definitions, disc.id as discussionId
        `,
        { word: standardizedWord },
      );

      if (result.records.length === 0) {
        return null;
      }

      const wordNode = result.records[0].get('w').properties;
      const definitions = result.records[0].get('definitions');
      const discussionId = result.records[0].get('discussionId');

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
        discussionId: discussionId,
      };

      return wordData;
    } catch (error) {
      throw this.standardError('fetch word', error);
    }
  }

  async getAllWords() {
    try {
      const result = await this.neo4jService.read(
        `
        MATCH (w:WordNode)
        OPTIONAL MATCH (w)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        OPTIONAL MATCH (w)-[:HAS_DEFINITION]->(d:DefinitionNode)
        RETURN w, collect(d) as definitions, disc.id as discussionId
        ORDER BY w.createdAt DESC
        `,
        {},
      );

      const words = result.records.map((record) => {
        const wordNode = record.get('w').properties;
        const definitions = record.get('definitions');
        const discussionId = record.get('discussionId');

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
          discussionId: discussionId,
        };
      });

      return words;
    } catch (error) {
      throw this.standardError('get all words', error);
    }
  }

  async checkWords() {
    try {
      const result = await this.neo4jService.read(
        'MATCH (w:WordNode) RETURN count(w) as count',
      );
      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      throw this.standardError('check words', error);
    }
  }

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
    } catch {
      return false;
    }
  }

  async isWordAvailableForDefinitionCreation(word: string): Promise<boolean> {
    try {
      const wordData = await this.getWord(word);
      if (!wordData) return false;

      return VotingUtils.isDefinitionCreationAllowed(
        wordData.inclusionNetVotes,
      );
    } catch {
      return false;
    }
  }

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
      throw this.standardError('get approved words', error);
    }
  }
}
