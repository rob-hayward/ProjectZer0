// src/neo4j/schemas/openquestion.schema.ts - REFACTORED

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
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { Record } from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

/**
 * OpenQuestionNode data interface
 * Open questions that the community wants answered
 */
export interface OpenQuestionData extends CategorizedNodeData {
  questionText: string;
  answers?: any[]; // Associated answers
  // Inherited from CategorizedNodeData:
  // - categories (up to 3)
  // Inherited from TaggedNodeData through CategorizedNodeData:
  // - keywords (tagged with relevant words)
  // - relatedNodes (questions with similar tags/categories)
  // Inherited from BaseNodeData:
  // - All voting fields (inclusion only for questions)
  // - discussionId, createdBy, publicCredit, etc.
}

/**
 * Schema for OpenQuestionNode - questions the community wants answered.
 *
 * Inheritance hierarchy:
 * BaseNodeSchema -> TaggedNodeSchema -> CategorizedNodeSchema -> OpenQuestionSchema
 *
 * Key characteristics:
 * - Uses standard 'id' field
 * - Inclusion voting only (no content voting)
 * - Has discussions (via injected DiscussionSchema)
 * - IS taggable (multiple keywords from the question)
 * - IS categorizable (up to 3 categories)
 * - Automatically normalizes questions (adds '?' if missing)
 * - Answers can only be added after inclusion threshold passed
 */
@Injectable()
export class OpenQuestionSchema extends CategorizedNodeSchema<OpenQuestionData> {
  protected readonly nodeLabel = 'OpenQuestionNode';
  protected readonly idField = 'id'; // Standard ID field
  protected readonly maxCategories = 3; // OpenQuestions can have up to 3 categories

  constructor(
    neo4jService: Neo4jService,
    voteSchema: VoteSchema,
    private readonly discussionSchema: DiscussionSchema,
  ) {
    super(neo4jService, voteSchema, OpenQuestionSchema.name);
  }

  // ============================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ============================================

  protected supportsContentVoting(): boolean {
    return false; // OpenQuestions only have inclusion voting
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
      // Only inclusion voting for questions
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      // No content voting
      contentPositiveVotes: 0,
      contentNegativeVotes: 0,
      contentNetVotes: 0,
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<OpenQuestionData>) {
    // Filter out complex fields that need special handling
    const setClause = Object.keys(data)
      .filter(
        (key) =>
          key !== 'id' &&
          key !== 'keywords' &&
          key !== 'categories' &&
          key !== 'categoryIds' &&
          key !== 'answers',
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

  // ============================================
  // QUESTION NORMALIZATION
  // ============================================

  /**
   * Normalizes question text by ensuring it ends with '?'
   */
  private normalizeQuestionText(text: string): string {
    const trimmedText = text.trim();
    if (!trimmedText.endsWith('?')) {
      return trimmedText + '?';
    }
    return trimmedText;
  }

  // ============================================
  // OPENQUESTION-SPECIFIC METHODS
  // ============================================

  /**
   * Creates a new open question with keywords and categories
   */
  async createOpenQuestion(questionData: {
    id?: string;
    createdBy: string;
    publicCredit: boolean;
    questionText: string;
    keywords?: KeywordWithFrequency[];
    categoryIds?: string[];
    initialComment?: string;
  }): Promise<OpenQuestionData> {
    // Validate inputs
    if (!questionData.questionText || questionData.questionText.trim() === '') {
      throw new BadRequestException('Question text cannot be empty');
    }

    if (
      questionData.categoryIds &&
      questionData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `OpenQuestion can have maximum ${this.maxCategories} categories`,
      );
    }

    const questionId = questionData.id || uuidv4();
    const normalizedQuestionText = this.normalizeQuestionText(
      questionData.questionText,
    );

    try {
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

      const params: any = {
        id: questionId,
        createdBy: questionData.createdBy,
        publicCredit: questionData.publicCredit,
        questionText: normalizedQuestionText,
      };

      // Add categories if provided
      if (questionData.categoryIds && questionData.categoryIds.length > 0) {
        query += `
        WITH oq
        UNWIND $categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (oq)-[:CATEGORIZED_AS {
          createdAt: datetime()
        }]->(cat)
        
        // Create SHARED_CATEGORY relationships for discovery
        WITH oq, cat
        OPTIONAL MATCH (other:OpenQuestionNode)-[:CATEGORIZED_AS]->(cat)
        WHERE other.id <> oq.id AND other.inclusionNetVotes > 0
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (oq)-[sc:SHARED_CATEGORY {categoryId: cat.id}]->(other)
          ON CREATE SET sc.strength = 1,
                        sc.categoryName = cat.name,
                        sc.createdAt = datetime()
          ON MATCH SET sc.strength = sc.strength + 1,
                       sc.updatedAt = datetime()
        )
        `;
        params.categoryIds = questionData.categoryIds;
      }

      // Add keywords if provided
      if (questionData.keywords && questionData.keywords.length > 0) {
        query += `
        WITH oq
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        WHERE w.inclusionNetVotes > 0
        CREATE (oq)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source,
          createdAt: datetime()
        }]->(w)
        
        // Create SHARED_TAG relationships for discovery
        WITH oq, w, keyword
        OPTIONAL MATCH (other:OpenQuestionNode)-[t:TAGGED]->(w)
        WHERE other.id <> oq.id
        FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (oq)-[st:SHARED_TAG {word: w.word}]->(other)
          ON CREATE SET st.strength = keyword.frequency * t.frequency,
                        st.createdAt = datetime()
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency),
                       st.updatedAt = datetime()
        )
        `;
        params.keywords = questionData.keywords;
      }

      // Create user relationship
      query += `
        WITH oq
        MATCH (u:User {sub: $createdBy})
        CREATE (u)-[:CREATED {
          createdAt: datetime(),
          nodeType: 'openquestion'
        }]->(oq)
        
        RETURN oq as n
      `;

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error('Failed to create open question');
      }

      const createdQuestion = this.mapNodeFromRecord(result.records[0]);

      // Create discussion using the centralized DiscussionSchema
      const discussionResult =
        await this.discussionSchema.createDiscussionForNode({
          nodeId: questionId,
          nodeType: this.nodeLabel,
          nodeIdField: 'id',
          createdBy: questionData.createdBy,
          initialComment: questionData.initialComment,
        });

      createdQuestion.discussionId = discussionResult.discussionId;

      this.logger.log(`Successfully created open question: ${questionId}`);
      return createdQuestion;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('not found')) {
        throw new BadRequestException(
          `Some keywords or categories don't exist or haven't passed inclusion threshold. ` +
            'Please ensure all words and categories are approved before creating questions.',
        );
      }

      this.logger.error(
        `Error creating open question: ${error.message}`,
        error.stack,
      );
      throw this.standardError('create open question', error);
    }
  }

  /**
   * Updates an open question including its keywords and categories
   */
  async updateOpenQuestion(
    id: string,
    updateData: {
      questionText?: string;
      publicCredit?: boolean;
      keywords?: KeywordWithFrequency[];
      categoryIds?: string[];
    },
  ): Promise<OpenQuestionData | null> {
    this.validateId(id);

    if (
      updateData.categoryIds &&
      updateData.categoryIds.length > this.maxCategories
    ) {
      throw new BadRequestException(
        `OpenQuestion can have maximum ${this.maxCategories} categories`,
      );
    }

    // Normalize question text if provided
    if (updateData.questionText) {
      updateData.questionText = this.normalizeQuestionText(
        updateData.questionText,
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

      // Return updated question
      return await this.getOpenQuestion(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Error updating open question: ${error.message}`,
        error.stack,
      );
      throw this.standardError('update open question', error);
    }
  }

  /**
   * Gets an open question with all its relationships
   */
  async getOpenQuestion(id: string): Promise<OpenQuestionData | null> {
    this.validateId(id);

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        OPTIONAL MATCH (oq)-[t:TAGGED]->(w:WordNode)
        OPTIONAL MATCH (oq)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (oq)<-[:ANSWERS]-(a:AnswerNode)
        WHERE a.inclusionNetVotes > 0
        
        RETURN oq as n,
               collect(DISTINCT {
                 word: w.word,
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
               collect(DISTINCT {
                 id: cat.id,
                 name: cat.name,
                 description: cat.description,
                 inclusionNetVotes: cat.inclusionNetVotes
               }) as categories,
               d.id as discussionId,
               collect(DISTINCT {
                 id: a.id,
                 answerText: a.answerText,
                 createdBy: a.createdBy,
                 inclusionNetVotes: a.inclusionNetVotes,
                 contentNetVotes: a.contentNetVotes
               }) as answers
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const question = this.mapNodeFromRecord(record);

      // Add related data
      const keywords = record
        .get('keywords')
        .filter((k: any) => k.word !== null);
      const categories = record
        .get('categories')
        .filter((c: any) => c.id !== null);
      const answers = record.get('answers').filter((a: any) => a.id !== null);

      return {
        ...question,
        keywords: keywords.length > 0 ? keywords : undefined,
        categories: categories.length > 0 ? categories : undefined,
        answers: answers.length > 0 ? answers : undefined,
        discussionId: record.get('discussionId'),
      };
    } catch (error) {
      this.logger.error(
        `Error getting open question: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get open question', error);
    }
  }

  /**
   * Gets all open questions with optional filters
   */
  async getOpenQuestions(
    options: {
      includeUnapproved?: boolean;
      categoryId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<OpenQuestionData[]> {
    const {
      includeUnapproved = false,
      categoryId,
      limit = 50,
      offset = 0,
    } = options;

    try {
      const whereConditions = [];
      const params: any = { limit, offset };

      if (!includeUnapproved) {
        whereConditions.push('oq.inclusionNetVotes > 0');
      }

      if (categoryId) {
        whereConditions.push(
          'EXISTS((oq)-[:CATEGORIZED_AS]->(:CategoryNode {id: $categoryId}))',
        );
        params.categoryId = categoryId;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode)
        ${whereClause}
        RETURN oq as n
        ORDER BY oq.inclusionNetVotes DESC, oq.createdAt DESC
        SKIP $offset
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((record) => this.mapNodeFromRecord(record));
    } catch (error) {
      this.logger.error(
        `Error getting open questions: ${error.message}`,
        error.stack,
      );
      throw this.standardError('get open questions', error);
    }
  }

  /**
   * Checks if a question has passed inclusion threshold for answers
   */
  async canReceiveAnswers(questionId: string): Promise<boolean> {
    const question = await this.findById(questionId);
    if (!question) {
      return false;
    }
    return (question.inclusionNetVotes || 0) > 0;
  }

  /**
   * Gets questions related by tags or categories
   */
  async getRelatedQuestions(
    questionId: string,
    limit: number = 10,
  ): Promise<OpenQuestionData[]> {
    // Use inherited method from CategorizedNodeSchema
    const related = await this.findRelatedByCombined(questionId, limit);

    // Load full question data for each related ID
    const questions = await Promise.all(
      related.map((r) => this.getOpenQuestion(r.nodeId)),
    );

    return questions.filter((q) => q !== null) as OpenQuestionData[];
  }
}
