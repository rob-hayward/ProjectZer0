// src/neo4j/schemas/answer.schema.ts - REFACTORED

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import {
  CategorizedNodeSchema,
  CategorizedNodeData,
} from './base/categorized.schema';
import { DiscussionSchema } from './discussion.schema';
import { UserSchema } from './user.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { VotingUtils } from '../../config/voting.config';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * AnswerNode data interface
 * Answers to open questions in the system
 */
export interface AnswerData extends CategorizedNodeData {
  answerText: string;
  parentQuestionId?: string;
  parentQuestionText?: string; // For display purposes
  relatedAnswers?: any[]; // Answers with shared tags
  // Inherited from CategorizedNodeData:
  // - categories (up to 3)
  // Inherited from TaggedNodeData through CategorizedNodeData:
  // - keywords (tagged with relevant words)
  // Inherited from BaseNodeData:
  // - All voting fields (both inclusion and content)
  // - discussionId, createdBy, publicCredit, etc.
}

/**
 * Schema for AnswerNode - answers to open questions.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> CategorizedNodeSchema -> AnswerSchema
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Both inclusion and content voting (dual voting)
 * - Has discussions (via injected DiscussionSchema)
 * - IS taggable (multiple keywords from the answer)
 * - IS categorizable (up to 3 categories)
 * - Parent question must pass inclusion threshold first
 * - Content voting only after inclusion threshold passed
 */
@Injectable()
export class AnswerSchema extends CategorizedNodeSchema<AnswerData> {
  protected readonly nodeLabel = 'AnswerNode';
  protected readonly idField = 'id'; // Standard ID field
  protected readonly maxCategories = 3; // Answers can have up to 3 categories

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly discussionSchema: DiscussionSchema,
    private readonly userSchema: UserSchema,
  ) {
    super(neo4jService, voteSchema, AnswerSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return true; // Answers support both inclusion and content voting
  }

  protected mapNodeFromRecord(record: Record): AnswerData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      answerText: props.answerText,
      parentQuestionId: props.parentQuestionId,
      discussionId: props.discussionId,
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
    // Filter out complex fields that need special handling
    const setClause = Object.keys(data)
      .filter(
        (key) =>
          key !== 'id' &&
          key !== 'keywords' &&
          key !== 'categories' &&
          key !== 'categoryIds' &&
          key !== 'relatedAnswers' &&
          key !== 'parentQuestionId', // Don't allow changing parent
      )
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

  // ============================================
  // OVERRIDE VOTING METHODS WITH BUSINESS LOGIC
  // ============================================

  /**
   * Content voting with business logic validation.
   * Answers must pass inclusion threshold before content voting is allowed.
   */
  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<any> {
    this.validateId(id);
    this.validateUserId(userId);

    // Check if answer has passed inclusion threshold
    const answer = await this.findById(id);
    if (
      !answer ||
      !VotingUtils.hasPassedInclusion(answer.inclusionNetVotes || 0)
    ) {
      throw new BadRequestException(
        'Answer must pass inclusion threshold before content voting is allowed',
      );
    }

    // Call parent implementation
    return super.voteContent(id, userId, isPositive);
  }

  // ============================================
  // ANSWER-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new answer with keywords and categories
   */
  async createAnswer(answerData: {
    id?: string;
    answerText: string;
    createdBy: string;
    publicCredit: boolean;
    parentQuestionId: string;
    categoryIds?: string[];
    keywords?: KeywordWithFrequency[];
    initialComment?: string;
  }): Promise<AnswerData> {
    // Validate inputs
    if (!answerData.answerText || answerData.answerText.trim() === '') {
      throw new BadRequestException('Answer text cannot be empty');
    }

    if (!answerData.parentQuestionId) {
      throw new BadRequestException('Parent question ID is required');
    }

    if (
      answerData.categoryIds &&
      answerData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Answer can have maximum ${this.maxCategories} categories`,
      );
    }

    const answerId = answerData.id || uuidv4();

    this.logger.log(`Creating answer with ID: ${answerId}`);

    try {
      let query = `
        // Validate parent OpenQuestion exists and has passed inclusion threshold
        MATCH (oq:OpenQuestionNode {id: $parentQuestionId})
        WHERE oq.inclusionNetVotes > 0
        
        // Create the answer node with dual voting fields
        CREATE (a:AnswerNode {
          id: $id,
          answerText: $answerText,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          parentQuestionId: $parentQuestionId,
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

      const params: any = {
        id: answerId,
        answerText: answerData.answerText.trim(),
        createdBy: answerData.createdBy,
        publicCredit: answerData.publicCredit,
        parentQuestionId: answerData.parentQuestionId,
      };

      // Add categories if provided
      if (answerData.categoryIds && answerData.categoryIds.length > 0) {
        query += `
        // Validate categories exist and have passed inclusion threshold
        WITH a, oq
        UNWIND $categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        
        // Create CATEGORIZED_AS relationships
        CREATE (a)-[:CATEGORIZED_AS {
          createdAt: datetime()
        }]->(cat)
        
        // Create SHARED_CATEGORY relationships for discovery
        WITH a, oq, cat
        OPTIONAL MATCH (other:AnswerNode)-[:CATEGORIZED_AS]->(cat)
        WHERE other.id <> a.id AND other.inclusionNetVotes > 0
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (a)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)
          ON CREATE SET sc.strength = 1,
                        sc.categoryName = cat.name,
                        sc.createdAt = datetime()
          ON MATCH SET sc.strength = sc.strength + 1,
                       sc.updatedAt = datetime()
        )
        `;
        params.categoryIds = answerData.categoryIds;
      }

      // Add keywords if provided
      if (answerData.keywords && answerData.keywords.length > 0) {
        query += `
        // Process keywords
        WITH a, oq
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (should already exist)
        MATCH (w:WordNode {word: keyword.word})
        WHERE w.inclusionNetVotes > 0
        
        // Create TAGGED relationship
        CREATE (a)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        
        // Create SHARED_TAG relationships for discovery between answers
        WITH a, w, keyword, oq
        OPTIONAL MATCH (other:AnswerNode)-[t:TAGGED]->(w)
        WHERE other.id <> a.id
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (a)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency,
                        st.createdAt = datetime()
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency),
                       st.updatedAt = datetime()
        )
        `;
        params.keywords = answerData.keywords;
      }

      // Create user relationship
      query += `
        // Create CREATED relationship for user-created content
        WITH a, oq
        MATCH (u:User {sub: $createdBy})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            nodeType: 'answer'
        }]->(a)
        
        RETURN a as n
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create answer - parent question may not exist or have not passed inclusion threshold',
        );
      }

      const createdAnswer = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: answerId,
          nodeType: this.nodeLabel,
          nodeIdField: 'id',
          createdBy: answerData.createdBy,
          initialComment: answerData.initialComment,
        });

      createdAnswer.discussionId = discussionResult.discussionId;

      // Track user participation
      try {
        await this.userSchema.addCreatedNode(
          answerData.createdBy,
          answerId,
          'answer',
        );
      } catch (error) {
        this.logger.warn(
          `Could not track user creation for answer ${answerId}: ${error.message}`,
        );
      }

      this.logger.log(
        `Successfully created answer with ID: ${createdAnswer.id}`,
      );
      return createdAnswer;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('parent question may not exist')) {
        throw new BadRequestException(
          'Parent OpenQuestion must exist and have passed inclusion threshold before answers can be created',
        );
      }

      if (error.message?.includes('not found')) {
        throw new BadRequestException(
          "Some categories or keywords don't exist or haven't passed inclusion threshold",
        );
      }

      this.logger.error(`Error creating answer: ${error.message}`, error.stack);
      throw this.standardError('create answer', error);
    }
  }

  /**
   * Gets an answer with all its relationships
   */
  async getAnswer(id: string): Promise<AnswerData | null> {
    this.validateId(id);

    this.logger.debug(`Retrieving answer with ID: ${id}`);

    try {
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
        WHERE related.inclusionNetVotes > 0
        
        // Get discussion
        OPTIONAL MATCH (a)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        RETURN a as n, 
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
        return null;
      }

      const record = result.records[0];
      const answer = this.mapNodeFromRecord(record);

      // Add related data
      answer.parentQuestionId = record.get('parentQuestionId');
      answer.parentQuestionText = record.get('parentQuestionText');

      const categories = record
        .get('categories')
        .filter((c: any) => c.id !== null);
      const keywords = record
        .get('keywords')
        .filter((k: any) => k.word !== null);
      const relatedAnswers = record
        .get('relatedAnswers')
        .filter((r: any) => r.id !== null);

      if (categories.length > 0) answer.categories = categories;
      if (keywords.length > 0) answer.keywords = keywords;
      if (relatedAnswers.length > 0) answer.relatedAnswers = relatedAnswers;

      answer.discussionId = record.get('discussionId');

      this.logger.debug(`Retrieved answer with ID: ${id}`);
      return answer;
    } catch (error) {
      this.logger.error(
        `Error retrieving answer ${id}: ${error.message}`,
        error.stack,
      );
      throw this.standardError('retrieve answer', error);
    }
  }

  /**
   * Updates an answer including its keywords and categories
   */
  async updateAnswer(
    id: string,
    updateData: {
      answerText?: string;
      publicCredit?: boolean;
      categoryIds?: string[];
      keywords?: KeywordWithFrequency[];
    },
  ): Promise<AnswerData | null> {
    this.validateId(id);

    if (
      updateData.categoryIds &&
      updateData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `Answer can have maximum ${this.maxCategories} categories`,
      );
    }

    // If no keywords or categories to update, use base update
    if (!updateData.keywords && updateData.categoryIds === undefined) {
      return await this.update(id, updateData);
    }

    // Complex update with keywords/categories
    try {
      // Update categories if provided
      if (updateData.categoryIds !== undefined) {
        await this.updateCategories(id, updateData.categoryIds);
      }

      // Update keywords if provided
      if (updateData.keywords) {
        await this.updateKeywords(id, updateData.keywords);
      }

      // Update basic properties
      const basicUpdate = { ...updateData };
      delete basicUpdate.keywords;
      delete basicUpdate.categoryIds;

      if (Object.keys(basicUpdate).length > 0) {
        await this.update(id, basicUpdate);
      }

      // Return updated answer
      return await this.getAnswer(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`Error updating answer: ${error.message}`, error.stack);
      throw this.standardError('update answer', error);
    }
  }

  /**
   * Gets all answers for a specific question
   */
  async getAnswersByQuestion(
    questionId: string,
    includeUnapproved: boolean = false,
  ): Promise<AnswerData[]> {
    this.validateId(questionId, 'Question ID');

    try {
      const whereClause = includeUnapproved
        ? ''
        : 'AND a.inclusionNetVotes > 0';

      const result = await this.neo4jService.read(
        `
        MATCH (a:AnswerNode {parentQuestionId: $questionId})
        ${whereClause}
        RETURN a as n
        ORDER BY a.contentNetVotes DESC, a.inclusionNetVotes DESC
        `,
        { questionId },
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting answers for question: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get answers by question', error);
    }
  }

  /**
   * Gets the top answer for a question (highest quality score)
   */
  async getTopAnswerForQuestion(
    questionId: string,
  ): Promise<AnswerData | null> {
    const answers = await this.getAnswersByQuestion(questionId, false);

    if (answers.length === 0) {
      return null;
    }

    // Already sorted by content votes in getAnswersByQuestion
    return answers[0];
  }

  /**
   * Gets answers related by tags or categories
   */
  async getRelatedAnswers(
    answerId: string,
    limit: number = 10,
  ): Promise<AnswerData[]> {
    // Use inherited method from CategorizedNodeSchema
    const related = await this.findRelatedByCombined(answerId, limit);

    // Load full answer data for each related ID
    const answers = await Promise.all(
      related.map((r) => this.getAnswer(r.nodeId)),
    );

    return answers.filter((a) => a !== null) as AnswerData[];
  }
}
