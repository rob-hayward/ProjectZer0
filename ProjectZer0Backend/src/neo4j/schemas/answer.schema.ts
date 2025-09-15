// src/neo4j/schemas/answer.schema.ts - CONVERTED TO BaseNodeSchema

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

// Answer-specific data interface extending BaseNodeData
export interface AnswerData extends BaseNodeData {
  answerText: string;
  createdBy: string;
  publicCredit: boolean;
  parentQuestionId?: string;
  keywords?: KeywordWithFrequency[];
  categories?: any[];
  relatedAnswers?: any[];
  discussionId?: string;
  visibilityStatus?: boolean;
  // Both inclusion and content voting (like DefinitionSchema)
}

// Legacy interface for createAnswer method
export interface AnswerNodeData {
  id: string;
  answerText: string;
  createdBy: string;
  publicCredit: boolean;
  parentQuestionId: string;
  categoryIds?: string[]; // 0-3 categories
  keywords?: KeywordWithFrequency[];
  initialComment?: string;
}

@Injectable()
export class AnswerSchema extends BaseNodeSchema<AnswerData> {
  protected readonly nodeLabel = 'AnswerNode';
  protected readonly idField = 'id'; // Answers use standard 'id' field

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, AnswerSchema.name);
  }

  // IMPLEMENT: Abstract methods from BaseNodeSchema

  protected supportsContentVoting(): boolean {
    return true; // Answers support both inclusion and content voting (like DefinitionSchema)
  }

  protected mapNodeFromRecord(record: Record): AnswerData {
    // Handle case where enhanced methods use different field names
    let actualRecord = record;

    // Field adapter for getAnswer compatibility
    if (!record.get('n')) {
      const tempRecord = {
        get: (key: string) => {
          if (key === 'n') {
            return record.get('a'); // Map 'n' to 'a' for getAnswer compatibility
          }
          return record.get(key);
        },
      } as unknown as Record;
      actualRecord = tempRecord;
    }

    const props = actualRecord.get('n').properties;
    return {
      id: props.id,
      answerText: props.answerText,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      parentQuestionId: props.parentQuestionId,
      visibilityStatus: props.visibilityStatus,
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

  protected buildUpdateQuery(id: string, data: Partial<AnswerData>) {
    const setClause = Object.keys(data)
      .filter(
        (key) => key !== 'id' && key !== 'keywords' && key !== 'categoryIds',
      ) // Exclude complex fields
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:AnswerNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  // ANSWER-SPECIFIC METHODS - Keep all unique functionality

  async createAnswer(answerData: AnswerNodeData) {
    try {
      // Validate answer text
      if (!answerData.answerText || answerData.answerText.trim() === '') {
        throw new BadRequestException('Answer text cannot be empty');
      }

      // Validate category count (0-3)
      if (answerData.categoryIds && answerData.categoryIds.length > 3) {
        throw new BadRequestException('Answer can have maximum 3 categories');
      }

      this.logger.log(`Creating answer with ID: ${answerData.id}`);
      this.logger.debug(`Answer data: ${JSON.stringify(answerData)}`);

      // Build the query
      let query = `
        // Validate parent OpenQuestion exists and has passed inclusion threshold
        MATCH (oq:OpenQuestionNode {id: $parentQuestionId})
        WHERE oq.inclusionNetVotes > 0 // Must have passed inclusion
        
        // Create the answer node (inclusion + content voting)
        CREATE (a:AnswerNode {
          id: $id,
          answerText: $answerText,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
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
        
        // Create ANSWERS relationship to OpenQuestion
        CREATE (a)-[:ANSWERS]->(oq)
      `;

      // Add category validation and relationships if provided
      if (answerData.categoryIds && answerData.categoryIds.length > 0) {
        query += `
        // Validate categories exist and have passed inclusion threshold
        WITH a, oq, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0 // Must have passed inclusion
        
        // Create CATEGORIZED_AS relationships
        CREATE (a)-[:CATEGORIZED_AS]->(cat)
        
        WITH a, oq, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds)
        `;
      }

      // Add keyword processing if provided
      if (answerData.keywords && answerData.keywords.length > 0) {
        query += `
        // Process keywords
        WITH a, oq
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (should already exist)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create TAGGED relationship
        CREATE (a)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Connect to other answers that share this keyword
        WITH a, w, keyword
        OPTIONAL MATCH (other:AnswerNode)-[t:TAGGED]->(w)
        WHERE other.id <> a.id
        
        // Create SHARED_TAG relationships between answers
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (a)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        )
        `;
      }

      // Create discussion and initial comment
      query += `
        // Create CREATED relationship for user-created content
        WITH a, $createdBy as userId
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'answer'
        }]->(a)
        
        // Create discussion node automatically
        WITH DISTINCT a
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (a)-[:HAS_DISCUSSION]->(d)
        
        // Create initial comment if provided
        WITH a, d, $initialComment as initialComment
        WHERE initialComment IS NOT NULL AND size(initialComment) > 0
        CREATE (c:CommentNode {
          id: apoc.create.uuid(),
          createdBy: $createdBy,
          commentText: initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          visibilityStatus: true
        })
        CREATE (d)-[:HAS_COMMENT]->(c)
        
        RETURN a
      `;

      // Prepare parameters
      const params: any = {
        id: answerData.id,
        answerText: answerData.answerText,
        createdBy: answerData.createdBy,
        publicCredit: answerData.publicCredit,
        parentQuestionId: answerData.parentQuestionId,
        initialComment: answerData.initialComment || null,
      };

      if (answerData.categoryIds && answerData.categoryIds.length > 0) {
        params.categoryIds = answerData.categoryIds;
      }

      if (answerData.keywords && answerData.keywords.length > 0) {
        params.keywords = answerData.keywords;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create answer - parent question may not exist or have not passed inclusion threshold',
        );
      }

      const createdAnswer = result.records[0].get('a').properties;
      this.logger.log(
        `Successfully created answer with ID: ${createdAnswer.id}`,
      );
      this.logger.debug(`Created answer: ${JSON.stringify(createdAnswer)}`);

      return createdAnswer;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error creating answer: ${error.message}`, error.stack);

      if (error.message.includes('parent question may not exist')) {
        throw new BadRequestException(
          'Parent OpenQuestion must exist and have passed inclusion threshold before answers can be created',
        );
      }

      if (error.message.includes('not found')) {
        throw new BadRequestException(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      }

      throw new Error(`Failed to create answer: ${error.message}`);
    }
  }

  async getAnswer(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID cannot be empty');
      }

      this.logger.debug(`Retrieving answer with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
      MATCH (a:AnswerNode {id: $id})
      
      // Get parent OpenQuestion
      OPTIONAL MATCH (a)-[:ANSWERS]->(oq:OpenQuestionNode)
      
      // Get categories
      OPTIONAL MATCH (a)-[:CATEGORIZED_AS]->(cat:CategoryNode)
      
      // Get keywords
      OPTIONAL MATCH (a)-[t:TAGGED]->(w:WordNode)
      
      // Get related answers through shared keywords
      OPTIONAL MATCH (a)-[st:SHARED_TAG]->(related:AnswerNode)
      
      // Get discussion
      OPTIONAL MATCH (a)-[:HAS_DISCUSSION]->(d:DiscussionNode)
      
      RETURN a, 
             oq.id as parentQuestionId,
             oq.questionText as parentQuestionText,
             collect(DISTINCT {
               id: cat.id,
               name: cat.name,
               inclusionNetVotes: cat.inclusionNetVotes
             }) as categories,
             collect(DISTINCT {
               word: w.word,
               frequency: t.frequency,
               source: t.source
             }) as keywords,
             collect(DISTINCT {
               id: related.id,
               answerText: related.answerText,
               sharedWord: st.word,
               strength: st.strength
             }) as relatedAnswers,
             d.id as discussionId
      `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      const record = result.records[0];
      const answer = record.get('a').properties;

      // Add related data
      answer.parentQuestionId = record.get('parentQuestionId');
      answer.parentQuestionText = record.get('parentQuestionText');
      answer.categories = (record.get('categories') || []).filter(
        (cat) => cat.id,
      );
      answer.keywords = (record.get('keywords') || []).filter((kw) => kw.word);
      answer.relatedAnswers = (record.get('relatedAnswers') || []).filter(
        (related) => related.id,
      );
      answer.discussionId = record.get('discussionId');

      // Convert Neo4j integers to JavaScript numbers for consistency
      [
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
      ].forEach((prop) => {
        if (answer[prop] !== undefined) {
          answer[prop] = this.toNumber(answer[prop]);
        }
      });

      this.logger.debug(`Retrieved answer with ID: ${id}`);
      return answer;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error; // Re-throw validation errors as-is
      }

      this.logger.error(
        `Error retrieving answer ${id}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve answer', error);
    }
  }

  async updateAnswer(
    id: string,
    updateData: Partial<{
      answerText: string;
      publicCredit: boolean;
      categoryIds: string[];
      keywords: KeywordWithFrequency[];
    }>,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID cannot be empty');
      }

      // Validate category count if updating categories
      if (updateData.categoryIds && updateData.categoryIds.length > 3) {
        throw new BadRequestException('Answer can have maximum 3 categories');
      }

      this.logger.log(`Updating answer with ID: ${id}`);
      this.logger.debug(`Update data: ${JSON.stringify(updateData)}`);

      // Complex update with keywords and categories
      if (
        (updateData.keywords && updateData.keywords.length > 0) ||
        updateData.categoryIds !== undefined
      ) {
        let query = `
        // Match the answer to update
        MATCH (a:AnswerNode {id: $id})
        
        // Set updated properties
        SET a += $updateProperties,
            a.updatedAt = datetime()
      `;

        // Handle category updates
        if (updateData.categoryIds !== undefined) {
          query += `
        // Remove existing CATEGORIZED_AS relationships
        WITH a
        OPTIONAL MATCH (a)-[catRel:CATEGORIZED_AS]->()
        DELETE catRel
        
        // Create new category relationships if provided
        WITH a, $categoryIds as categoryIds
        WHERE size(categoryIds) > 0
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (a)-[:CATEGORIZED_AS]->(cat)
        
        WITH a, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0
        `;
        }

        // Handle keyword updates
        if (updateData.keywords && updateData.keywords.length > 0) {
          query += `
        // Remove existing TAGGED and SHARED_TAG relationships
        WITH a
        OPTIONAL MATCH (a)-[tagRel:TAGGED]->()
        DELETE tagRel
        OPTIONAL MATCH (a)-[sharedRel:SHARED_TAG]->()
        DELETE sharedRel
        
        // Create new keyword relationships
        WITH a, $keywords as keywords
        UNWIND keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        CREATE (a)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Recreate SHARED_TAG relationships
        WITH a, w, keyword
        OPTIONAL MATCH (other:AnswerNode)-[t:TAGGED]->(w)
        WHERE other.id <> a.id
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (a)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
        )
        `;
        }

        query += ` RETURN a`;

        const params: any = { id };

        // Filter out undefined values and complex fields from updateProperties
        const updateProperties = Object.fromEntries(
          Object.entries(updateData).filter(
            ([key, value]) =>
              value !== undefined &&
              key !== 'categoryIds' &&
              key !== 'keywords',
          ),
        );

        if (Object.keys(updateProperties).length > 0) {
          params.updateProperties = updateProperties;
        }

        if (updateData.categoryIds !== undefined) {
          params.categoryIds = updateData.categoryIds;
        }

        if (updateData.keywords && updateData.keywords.length > 0) {
          params.keywords = updateData.keywords;
        }

        const result = await this.neo4jService.write(query, params);

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Answer with ID ${id} not found`);
        }

        return result.records[0].get('a').properties;
      } else {
        // Simple update - use inherited method for basic field updates
        return await this.update(id, updateData);
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Transform specific error messages for business logic validation FIRST
      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      }

      // Check if error is already standardized to avoid double-wrapping
      if (error.message && error.message.startsWith('Failed to update')) {
        throw error; // Already standardized, don't wrap again
      }

      this.logger.error(
        `Error updating answer ${id}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update answer', error);
    }
  }

  async deleteAnswer(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Answer ID cannot be empty');
      }

      this.logger.log(`Deleting answer with ID: ${id}`);

      // Check if answer exists
      const checkResult = await this.neo4jService.read(
        `MATCH (a:AnswerNode {id: $id}) RETURN a`,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      // Delete answer and all related nodes (discussion, comments)
      await this.neo4jService.write(
        `
        MATCH (a:AnswerNode {id: $id})
        
        // Get associated discussion and comments to delete
        OPTIONAL MATCH (a)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        
        // Delete everything
        DETACH DELETE a, d, c
        `,
        { id },
      );

      this.logger.log(`Successfully deleted answer with ID: ${id}`);
      return {
        success: true,
        message: `Answer with ID ${id} successfully deleted`,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to delete answer: ${error.message}`);
    }
  }

  // ✅ REMOVED: Legacy voting methods - now inherited from BaseNodeSchema
  // - voteAnswerInclusion() → use inherited voteInclusion()
  // - voteAnswerContent() → use inherited voteContent()
  // - getAnswerVoteStatus() → use inherited getVoteStatus()
  // - removeAnswerVote() → use inherited removeVote()
  // - getAnswerVotes() → use inherited getVotes()

  // Visibility methods

  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      this.logger.log(`Setting visibility for answer ${id}: ${isVisible}`);

      const result = await this.neo4jService.write(
        `
        MATCH (a:AnswerNode {id: $id})
        SET a.visibilityStatus = $isVisible, a.updatedAt = datetime()
        RETURN a
        `,
        { id, isVisible },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      return result.records[0].get('a').properties;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error setting visibility for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to set visibility status: ${error.message}`);
    }
  }

  async getVisibilityStatus(id: string): Promise<boolean> {
    try {
      this.logger.debug(`Getting visibility status for answer ${id}`);

      const result = await this.neo4jService.read(
        `MATCH (a:AnswerNode {id: $id}) RETURN a.visibilityStatus`,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(`Answer with ID ${id} not found`);
      }

      return result.records[0]?.get('a.visibilityStatus') ?? true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting visibility status for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get visibility status: ${error.message}`);
    }
  }

  /**
   * Get all answers for a specific OpenQuestion
   */
  async getAnswersForQuestion(
    questionId: string,
    options: {
      sortBy?: 'newest' | 'oldest' | 'inclusion_votes' | 'content_votes';
      sortDirection?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      onlyApproved?: boolean;
    } = {},
  ) {
    try {
      const {
        sortBy = 'content_votes',
        sortDirection = 'desc',
        limit = null,
        offset = 0,
        onlyApproved = false,
      } = options;

      this.logger.debug(`Getting answers for question ${questionId}`);

      let query = `
        MATCH (oq:OpenQuestionNode {id: $questionId})
        MATCH (a:AnswerNode)-[:ANSWERS]->(oq)
        WHERE a.visibilityStatus <> false OR a.visibilityStatus IS NULL
      `;

      if (onlyApproved) {
        query += ` AND a.inclusionNetVotes > 0`;
      }

      // Add sorting
      if (sortBy === 'newest') {
        query += ` ORDER BY a.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'oldest') {
        query += ` ORDER BY a.createdAt ${
          sortDirection === 'desc' ? 'ASC' : 'DESC'
        }`;
      } else if (sortBy === 'inclusion_votes') {
        query += ` ORDER BY a.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'content_votes') {
        query += ` ORDER BY a.contentNetVotes ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      if (limit !== null) {
        query += ` SKIP $offset LIMIT $limit`;
      }

      query += ` RETURN a`;

      const params: any = { questionId, offset };
      if (limit !== null) {
        params.limit = limit;
      }

      const result = await this.neo4jService.read(query, params);

      const answers = result.records.map((record) => {
        const answer = record.get('a').properties;

        // Convert Neo4j integers
        [
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
          'contentPositiveVotes',
          'contentNegativeVotes',
          'contentNetVotes',
        ].forEach((prop) => {
          if (answer[prop] !== undefined) {
            answer[prop] = this.toNumber(answer[prop]);
          }
        });

        return answer;
      });

      this.logger.debug(
        `Retrieved ${answers.length} answers for question ${questionId}`,
      );
      return answers;
    } catch (error) {
      this.logger.error(
        `Error getting answers for question: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get answers for question: ${error.message}`);
    }
  }

  /**
   * Get categories associated with an answer
   */
  async getAnswerCategories(answerId: string) {
    try {
      this.logger.debug(`Getting categories for answer ${answerId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (a:AnswerNode {id: $answerId})
        
        // Get all categories this answer is categorized as
        OPTIONAL MATCH (a)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
        // For hierarchical categories, get the path to root
        OPTIONAL MATCH path = (c)-[:IS_CHILD_OF*0..]->(root:CategoryNode)
        WHERE NOT (root)-[:IS_CHILD_OF]->()
        
        RETURN collect({
          id: c.id,
          name: c.name,
          description: c.description,
          inclusionNetVotes: c.inclusionNetVotes,
          path: CASE 
            WHEN path IS NOT NULL 
            THEN [node IN nodes(path) | {id: node.id, name: node.name}]
            ELSE [{id: c.id, name: c.name}]
          END
        }) as categories
        `,
        { answerId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const categories = result.records[0].get('categories');

      // Convert Neo4j integers
      categories.forEach((category) => {
        if (category.inclusionNetVotes !== undefined) {
          category.inclusionNetVotes = this.toNumber(
            category.inclusionNetVotes,
          );
        }
      });

      this.logger.debug(
        `Retrieved ${categories.length} categories for answer ${answerId}`,
      );
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting answer categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get answer categories: ${error.message}`);
    }
  }
}
