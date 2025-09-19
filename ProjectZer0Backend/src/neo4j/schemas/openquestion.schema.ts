// src/neo4j/schemas/openquestion.schema.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base-node.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { Record } from 'neo4j-driver';

export interface OpenQuestionData extends BaseNodeData {
  questionText: string;
  keywords?: KeywordWithFrequency[];
  categories?: any[];
  relatedQuestions?: any[];
  directlyRelatedQuestions?: any[];
  answers?: any[];
}

@Injectable()
export class OpenQuestionSchema extends BaseNodeSchema<OpenQuestionData> {
  protected readonly nodeLabel = 'OpenQuestionNode';
  protected readonly idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, OpenQuestionSchema.name);
  }

  protected supportsContentVoting(): boolean {
    return false;
  }

  protected mapNodeFromRecord(record: Record): OpenQuestionData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      questionText: props.questionText,
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

  protected buildUpdateQuery(id: string, data: Partial<OpenQuestionData>) {
    const setClause = Object.keys(data)
      .filter(
        (key) => key !== 'id' && key !== 'keywords' && key !== 'categoryIds',
      )
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:OpenQuestionNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  async createOpenQuestion(questionData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    questionText: string;
    keywords?: KeywordWithFrequency[];
    categoryIds?: string[];
    initialComment?: string;
  }) {
    try {
      if (
        !questionData.questionText ||
        questionData.questionText.trim() === ''
      ) {
        throw new BadRequestException('Question text cannot be empty');
      }

      if (questionData.categoryIds && questionData.categoryIds.length > 3) {
        throw new BadRequestException(
          'OpenQuestion can have maximum 3 categories',
        );
      }

      let normalizedQuestionText = questionData.questionText.trim();
      if (!normalizedQuestionText.endsWith('?')) {
        normalizedQuestionText += '?';
      }

      let query = `
        CREATE (oq:OpenQuestionNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          questionText: $questionText,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0
        })
      `;

      if (questionData.categoryIds && questionData.categoryIds.length > 0) {
        query += `
        WITH oq, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (oq)-[:CATEGORIZED_AS]->(cat)
        WITH oq, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds)
        `;
      }

      if (questionData.keywords && questionData.keywords.length > 0) {
        query += `
        WITH oq
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        CREATE (oq)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        CREATE (oq)-[:SHARED_TAG {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        WITH oq
        `;
      }

      query += ` RETURN oq`;

      const params: any = {
        id: questionData.id,
        createdBy: questionData.createdBy,
        publicCredit: questionData.publicCredit,
        questionText: normalizedQuestionText,
      };

      if (questionData.categoryIds && questionData.categoryIds.length > 0) {
        params.categoryIds = questionData.categoryIds;
      }

      if (questionData.keywords && questionData.keywords.length > 0) {
        params.keywords = questionData.keywords;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create open question');
      }

      const createdQuestion = result.records[0].get('oq').properties;

      const discussionId = await this.createDiscussion({
        nodeId: questionData.id,
        nodeType: this.nodeLabel,
        createdBy: questionData.createdBy,
        initialComment: questionData.initialComment,
      });

      createdQuestion.discussionId = discussionId;

      return createdQuestion;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          `Some keywords or categories don't have corresponding nodes. Please ensure all words exist before creating questions.`,
        );
      }

      throw new Error(`Failed to create open question: ${error.message}`);
    }
  }

  async updateOpenQuestion(
    id: string,
    updateData: {
      questionText?: string;
      publicCredit?: boolean;
      keywords?: KeywordWithFrequency[];
      categoryIds?: string[];
    },
  ) {
    try {
      this.validateId(id);

      if (updateData.categoryIds && updateData.categoryIds.length > 3) {
        throw new BadRequestException(
          'OpenQuestion can have maximum 3 categories',
        );
      }

      if (updateData.questionText) {
        let normalizedQuestionText = updateData.questionText.trim();
        if (!normalizedQuestionText.endsWith('?')) {
          normalizedQuestionText += '?';
        }
        updateData.questionText = normalizedQuestionText;
      }

      if (!updateData.keywords && updateData.categoryIds === undefined) {
        return await this.update(id, updateData);
      }

      let query = `
        MATCH (oq:OpenQuestionNode {id: $id})
        SET oq += $updateProperties, oq.updatedAt = datetime()
      `;

      if (updateData.categoryIds !== undefined) {
        query += `
        WITH oq
        OPTIONAL MATCH (oq)-[catRel:CATEGORIZED_AS]->()
        DELETE catRel
        WITH oq, $categoryIds as categoryIds
        WHERE size(categoryIds) > 0
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (oq)-[:CATEGORIZED_AS]->(cat)
        WITH oq, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0
        `;
      }

      if (updateData.keywords && updateData.keywords.length > 0) {
        query += `
        WITH oq
        OPTIONAL MATCH (oq)-[tagRel:TAGGED]->()
        OPTIONAL MATCH (oq)-[sharedRel:SHARED_TAG]->()
        DELETE tagRel, sharedRel
        WITH oq
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        CREATE (oq)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        CREATE (oq)-[:SHARED_TAG {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        WITH oq
        `;
      }

      query += ` RETURN oq`;

      const updateProperties = { ...updateData };
      delete updateProperties.keywords;
      delete updateProperties.categoryIds;

      const params: any = {
        id,
        updateProperties,
      };

      if (updateData.categoryIds !== undefined) {
        params.categoryIds = updateData.categoryIds;
      }

      if (updateData.keywords && updateData.keywords.length > 0) {
        params.keywords = updateData.keywords;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      const updatedQuestion = this.mapNodeFromRecord(result.records[0]);
      return updatedQuestion;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (error.message && error.message.startsWith('Failed to update')) {
        throw error;
      }

      throw this.standardError('update OpenQuestion', error);
    }
  }

  async getOpenQuestion(id: string): Promise<OpenQuestionData> {
    try {
      this.validateId(id);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        OPTIONAL MATCH (oq)<-[ipv:VOTED_ON {kind: 'INCLUSION', status: 'agree'}]-()
        OPTIONAL MATCH (oq)<-[inv:VOTED_ON {kind: 'INCLUSION', status: 'disagree'}]-()
        OPTIONAL MATCH (oq)-[tagged:TAGGED]->(w:WordNode)
        OPTIONAL MATCH (oq)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        WITH oq,
             COUNT(DISTINCT ipv) as inclusionPositiveVotes,
             COUNT(DISTINCT inv) as inclusionNegativeVotes,
             collect(DISTINCT {word: w.word, frequency: tagged.frequency, source: tagged.source}) as keywords,
             collect(DISTINCT {id: cat.id, name: cat.name}) as categories,
             d.id as discussionId
        
        RETURN oq,
               inclusionPositiveVotes,
               inclusionNegativeVotes,
               keywords,
               categories,
               discussionId
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      const record = result.records[0];

      const tempRecord = {
        get: (key: string) => {
          if (key === 'n') {
            return record.get('oq');
          }
          return record.get(key);
        },
      } as unknown as Record;

      const questionData = this.mapNodeFromRecord(tempRecord);

      questionData.keywords = record.get('keywords').filter((k: any) => k.word);
      questionData.categories = record
        .get('categories')
        .filter((c: any) => c.id);
      questionData.discussionId = record.get('discussionId');

      return questionData;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('retrieve OpenQuestion', error);
    }
  }

  async deleteOpenQuestion(id: string) {
    try {
      this.validateId(id);

      const checkResult = await this.neo4jService.read(
        `MATCH (oq:OpenQuestionNode {id: $id}) RETURN oq`,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      await this.neo4jService.write(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        DETACH DELETE oq, d, c
        `,
        { id },
      );

      return {
        success: true,
        message: `Open question with ID ${id} successfully deleted`,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('delete OpenQuestion', error);
    }
  }

  async getOpenQuestionsByUser(userId: string, limit = 10, offset = 0) {
    try {
      if (!userId || userId.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {createdBy: $userId})
        RETURN oq as n
        ORDER BY oq.inclusionNetVotes DESC, oq.createdAt DESC
        SKIP $offset LIMIT $limit
        `,
        { userId, limit, offset },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw this.standardError('get open questions by user', error);
    }
  }

  async getTopOpenQuestions(
    limit = 10,
    sortBy: 'netPositive' | 'totalVotes' | 'chronological' = 'netPositive',
    sortDirection: 'asc' | 'desc' = 'desc',
  ) {
    try {
      let orderByClause = '';
      if (sortBy === 'netPositive') {
        orderByClause = `ORDER BY oq.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'totalVotes') {
        orderByClause = `ORDER BY (oq.inclusionPositiveVotes + oq.inclusionNegativeVotes) ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'chronological') {
        orderByClause = `ORDER BY oq.createdAt ${sortDirection.toUpperCase()}`;
      }

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode)
        RETURN oq as n
        ${orderByClause}
        LIMIT $limit
        `,
        { limit },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      throw this.standardError('get top open questions', error);
    }
  }
}
