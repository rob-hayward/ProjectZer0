// src/neo4j/schemas/openquestion.schema.ts - CONVERTED TO BaseNodeSchema

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

// OpenQuestion-specific data interface extending BaseNodeData
export interface OpenQuestionData extends BaseNodeData {
  questionText: string;
  createdBy: string;
  publicCredit: boolean;
  keywords?: KeywordWithFrequency[];
  categories?: any[];
  relatedQuestions?: any[];
  directlyRelatedQuestions?: any[];
  answers?: any[];
  discussionId?: string;
  visibilityStatus?: boolean;
  // Only inclusion voting (no content voting for open questions)
}

@Injectable()
export class OpenQuestionSchema extends BaseNodeSchema<OpenQuestionData> {
  protected readonly nodeLabel = 'OpenQuestionNode';
  protected readonly idField = 'id'; // OpenQuestions use standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, OpenQuestionSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return false; // OpenQuestions only support inclusion voting (like WordSchema)
  }

  protected mapNodeFromRecord(record: Record): OpenQuestionData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      questionText: props.questionText,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      visibilityStatus: props.visibilityStatus,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      // Only inclusion voting (no content voting)
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // Content voting disabled for open questions
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<OpenQuestionData>) {
    const setClause = Object.keys(data)
      .filter(
        (key) => key !== 'id' && key !== 'keywords' && key !== 'categoryIds',
      ) // Exclude complex fields
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

  // OPENQUESTION-SPECIFIC METHODS - Keep all unique functionality

  async createOpenQuestion(questionData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    questionText: string;
    keywords?: KeywordWithFrequency[];
    categoryIds?: string[];
    initialComment: string;
  }) {
    try {
      if (
        !questionData.questionText ||
        questionData.questionText.trim() === ''
      ) {
        throw new BadRequestException('Question text cannot be empty');
      }

      // Validate category count (0-3)
      if (questionData.categoryIds && questionData.categoryIds.length > 3) {
        throw new BadRequestException(
          'OpenQuestion can have maximum 3 categories',
        );
      }

      // Ensure question ends with '?' or add it automatically
      let normalizedQuestionText = questionData.questionText.trim();
      if (!normalizedQuestionText.endsWith('?')) {
        normalizedQuestionText += '?';
      }

      this.logger.log(`Creating open question with ID: ${questionData.id}`);
      this.logger.debug(`Question data: ${JSON.stringify(questionData)}`);

      let query = `
        // Create the open question node (inclusion voting only)
        CREATE (oq:OpenQuestionNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          questionText: $questionText,
          initialComment: $initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          // Inclusion voting only (no content voting)
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          visibilityStatus: true
        })
      `;

      // Add category validation and relationships if provided
      if (questionData.categoryIds && questionData.categoryIds.length > 0) {
        query += `
        // Validate categories exist and have passed inclusion threshold
        WITH oq, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0 // Must have passed inclusion
        
        // Create CATEGORIZED_AS relationships
        CREATE (oq)-[:CATEGORIZED_AS]->(cat)
        
        WITH oq, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds)
        `;
      }

      // Process keywords if provided
      if (questionData.keywords && questionData.keywords.length > 0) {
        query += `
        // Process each keyword
        WITH oq
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (should already exist)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create relationships with frequency-based weighting
        CREATE (oq)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        
        // Create SHARED_TAG relationships between open question and words
        CREATE (oq)-[:SHARED_TAG {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        WITH oq
        `;
      }

      // Create discussion for the question
      query += `
        // Create discussion node for this question
        WITH oq
        CREATE (d:DiscussionNode {
          id: randomUUID(),
          associatedNodeId: oq.id,
          associatedNodeType: 'OpenQuestionNode',
          createdBy: $createdBy,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        CREATE (oq)-[:HAS_DISCUSSION]->(d)
        
        // Create initial comment if provided
        WITH oq, d
        WHERE $initialComment <> ''
        CREATE (c:CommentNode {
          id: randomUUID(),
          text: $initialComment,
          createdBy: $createdBy,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          visibilityStatus: true
        })
        CREATE (d)-[:HAS_COMMENT]->(c)
        
        RETURN oq
      `;

      // Prepare parameters
      const params: any = {
        id: questionData.id,
        createdBy: questionData.createdBy,
        publicCredit: questionData.publicCredit,
        questionText: normalizedQuestionText,
        initialComment: questionData.initialComment || '',
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
      this.logger.log(
        `Successfully created open question with ID: ${createdQuestion.id}`,
      );
      this.logger.debug(`Created question: ${JSON.stringify(createdQuestion)}`);

      return createdQuestion;
    } catch (error) {
      this.logger.error(
        `Error creating open question: ${error.message}`,
        error.stack,
      );

      // Handle specific error cases
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle the specific case of missing word nodes
      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          `Some keywords or categories don't have corresponding nodes. Please ensure all words exist before creating questions.`,
        );
      }

      throw new Error(`Failed to create open question: ${error.message}`);
    }
  }

  // Enhanced update method for complex updates with categories/keywords
  // Enhanced update method for complex updates with categories/keywords
  async updateOpenQuestion(
    id: string,
    updateData: {
      questionText?: string;
      publicCredit?: boolean;
      keywords?: KeywordWithFrequency[];
      categoryIds?: string[];
      visibilityStatus?: boolean;
    },
  ) {
    try {
      this.validateId(id);

      // Validate category count if provided
      if (updateData.categoryIds && updateData.categoryIds.length > 3) {
        throw new BadRequestException(
          'OpenQuestion can have maximum 3 categories',
        );
      }

      // Normalize question text if provided
      if (updateData.questionText) {
        let normalizedQuestionText = updateData.questionText.trim();
        if (!normalizedQuestionText.endsWith('?')) {
          normalizedQuestionText += '?';
        }
        updateData.questionText = normalizedQuestionText;
      }

      this.logger.log(`Updating open question with ID: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      // For simple updates without keywords/categories, use inherited method
      if (!updateData.keywords && updateData.categoryIds === undefined) {
        return await this.update(id, updateData);
      }

      // Complex update with keywords and/or categories
      let query = `
        // Match the question to update
        MATCH (oq:OpenQuestionNode {id: $id})
        
        // Set updated properties
        SET oq += $updateProperties,
            oq.updatedAt = datetime()
      `;

      // Handle category updates
      if (updateData.categoryIds !== undefined) {
        query += `
        // Remove existing CATEGORIZED_AS relationships
        WITH oq
        OPTIONAL MATCH (oq)-[catRel:CATEGORIZED_AS]->()
        DELETE catRel
        
        // Create new category relationships if provided
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

      // Handle keyword updates
      if (updateData.keywords && updateData.keywords.length > 0) {
        query += `
        // Remove existing TAGGED and SHARED_TAG relationships
        WITH oq
        OPTIONAL MATCH (oq)-[tagRel:TAGGED]->()
        OPTIONAL MATCH (oq)-[sharedRel:SHARED_TAG]->()
        DELETE tagRel, sharedRel
        
        // Create new keyword relationships
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

      // Prepare parameters
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
      this.logger.log(`Successfully updated open question with ID: ${id}`);

      return updatedQuestion;
    } catch (error) {
      this.logger.error(
        `Error updating open question ${id}: ${error.message}`,
        error.stack,
      );

      // Re-throw BadRequestException and NotFoundException as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // For other errors, check if they're already standardized to avoid double-wrapping
      if (error.message && error.message.startsWith('Failed to update')) {
        throw error; // Already standardized, don't wrap again
      }

      throw this.standardError('update OpenQuestion', error);
    }
  }

  // Enhanced get method that includes related data
  // Enhanced get method that includes related data
  async getOpenQuestion(id: string): Promise<OpenQuestionData> {
    try {
      this.validateId(id);

      this.logger.debug(`Getting open question with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        
        // Get inclusion vote counts
        OPTIONAL MATCH (oq)<-[ipv:VOTED_ON {kind: 'INCLUSION', status: 'agree'}]-()
        OPTIONAL MATCH (oq)<-[inv:VOTED_ON {kind: 'INCLUSION', status: 'disagree'}]-()
        
        // Get keywords
        OPTIONAL MATCH (oq)-[tagged:TAGGED]->(w:WordNode)
        
        // Get categories
        OPTIONAL MATCH (oq)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get discussion ID
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

      // Create a temporary record structure that mapNodeFromRecord expects
      const tempRecord = {
        get: (key: string) => {
          if (key === 'n') {
            return record.get('oq'); // Map 'n' to 'oq' for compatibility with mapNodeFromRecord
          }
          return record.get(key);
        },
      } as unknown as Record;

      const questionData = this.mapNodeFromRecord(tempRecord);

      // Add additional data
      questionData.keywords = record.get('keywords').filter((k: any) => k.word);
      questionData.categories = record
        .get('categories')
        .filter((c: any) => c.id);
      questionData.discussionId = record.get('discussionId');

      this.logger.debug(
        `Retrieved open question: ${JSON.stringify(questionData)}`,
      );
      return questionData;
    } catch (error) {
      this.logger.error(
        `Error retrieving open question ${id}: ${error.message}`,
        error.stack,
      );

      // Re-throw BadRequestException and NotFoundException as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('retrieve OpenQuestion', error);
    }
  }

  // Enhanced delete method that handles related data cleanup
  async deleteOpenQuestion(id: string) {
    try {
      this.validateId(id);

      this.logger.log(`Deleting open question with ID: ${id}`);

      // Check if the question exists first
      const checkResult = await this.neo4jService.read(
        `MATCH (oq:OpenQuestionNode {id: $id}) RETURN oq`,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      // Delete the question and all related nodes/relationships
      await this.neo4jService.write(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        DETACH DELETE oq, d, c
        `,
        { id },
      );

      this.logger.log(`Successfully deleted open question with ID: ${id}`);
      return {
        success: true,
        message: `Open question with ID ${id} successfully deleted`,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting open question ${id}: ${error.message}`,
        error.stack,
      );

      // Re-throw BadRequestException and NotFoundException as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('delete OpenQuestion', error);
    }
  }

  // Visibility management methods
  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      this.validateId(id);

      this.logger.log(
        `Setting visibility for open question ${id}: ${isVisible}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        SET oq.visibilityStatus = $isVisible, oq.updatedAt = datetime()
        RETURN oq
        `,
        { id, isVisible },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      const updatedQuestion = result.records[0].get('oq').properties;
      this.logger.log(
        `Successfully updated visibility for open question ${id}`,
      );

      return updatedQuestion;
    } catch (error) {
      this.logger.error(
        `Error setting visibility for open question ${id}: ${error.message}`,
        error.stack,
      );

      // Re-throw BadRequestException and NotFoundException as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('set visibility status', error);
    }
  }

  async getVisibilityStatus(id: string) {
    try {
      this.validateId(id);

      this.logger.debug(`Getting visibility status for open question ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        RETURN oq.visibilityStatus
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      const visibilityStatus =
        result.records[0]?.get('oq.visibilityStatus') ?? true;
      this.logger.debug(
        `Visibility status for open question ${id}: ${visibilityStatus}`,
      );

      return visibilityStatus;
    } catch (error) {
      this.logger.error(
        `Error getting visibility status for open question ${id}: ${error.message}`,
        error.stack,
      );

      // Re-throw BadRequestException and NotFoundException as-is
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('get visibility status', error);
    }
  }

  // Discovery and search methods
  async getOpenQuestionsByUser(userId: string, limit = 10, offset = 0) {
    try {
      if (!userId || userId.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.debug(`Getting open questions for user: ${userId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {createdBy: $userId})
        WHERE oq.visibilityStatus = true
        RETURN oq as n
        ORDER BY oq.inclusionNetVotes DESC, oq.createdAt DESC
        SKIP $offset LIMIT $limit
        `,
        { userId, limit, offset },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting open questions for user ${userId}: ${error.message}`,
        error.stack,
      );

      // Re-throw BadRequestException as-is
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
      this.logger.debug(
        `Getting top open questions: ${sortBy} ${sortDirection}`,
      );

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
        WHERE oq.visibilityStatus = true
        RETURN oq as n
        ${orderByClause}
        LIMIT $limit
        `,
        { limit },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting top open questions: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get top open questions', error);
    }
  }
}
