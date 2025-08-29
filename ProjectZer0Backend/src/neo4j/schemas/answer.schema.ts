// src/neo4j/schemas/answer.schema.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';

import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from './vote.schema';

export interface AnswerNodeData {
  id: string;
  answerText: string; // Primary content (not "statement")
  createdBy: string;
  publicCredit: boolean;
  parentQuestionId: string; // The OpenQuestion this answers
  categoryIds?: string[]; // 0-3 categories
  keywords?: KeywordWithFrequency[];
  initialComment?: string;
}

@Injectable()
export class AnswerSchema {
  private readonly logger = new Logger(AnswerSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
  ) {}

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
        
        // Get related answers via shared keywords
        OPTIONAL MATCH (a)-[st:SHARED_TAG]->(other:AnswerNode)
        
        // Get directly related answers (if any future direct relationships)
        OPTIONAL MATCH (a)-[:RELATED_TO]-(rel:AnswerNode)
        
        // Get discussion
        OPTIONAL MATCH (a)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        RETURN a,
               {
                 id: oq.id,
                 questionText: oq.questionText,
                 inclusionNetVotes: oq.inclusionNetVotes
               } as parentQuestion,
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
                 id: other.id,
                 answerText: other.answerText,
                 sharedWord: st.word,
                 strength: st.strength
               }) as relatedAnswers,
               collect(DISTINCT {
                 id: rel.id,
                 answerText: rel.answerText,
                 relationshipType: 'direct'
               }) as directlyRelatedAnswers,
               d.id as discussionId
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Answer not found with ID: ${id}`);
        return null;
      }

      const answer = result.records[0].get('a').properties;
      answer.parentQuestion = result.records[0].get('parentQuestion');
      answer.categories = result.records[0].get('categories');
      answer.keywords = result.records[0].get('keywords');
      answer.relatedAnswers = result.records[0].get('relatedAnswers');
      answer.directlyRelatedAnswers = result.records[0].get(
        'directlyRelatedAnswers',
      );
      answer.discussionId = result.records[0].get('discussionId');

      // Convert Neo4j integers to JavaScript numbers
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
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error retrieving answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to retrieve answer: ${error.message}`);
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
          OPTIONAL MATCH (a)-[sharedRel:SHARED_TAG]->()
          DELETE tagRel, sharedRel
          
          // Process updated keywords
          WITH a
          UNWIND $keywords as keyword
          
          // Find word node for each keyword
          MATCH (w:WordNode {word: keyword.word})
          
          // Create new TAGGED relationship
          CREATE (a)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          
          // Reconnect to other answers that share this keyword
          WITH a, w, keyword
          OPTIONAL MATCH (other:AnswerNode)-[t:TAGGED]->(w)
          WHERE other.id <> a.id
          
          // Create new SHARED_TAG relationships
          FOREACH (dummy IN CASE WHEN other IS NOT NULL THEN [1] ELSE [] END |
            MERGE (a)-[st:SHARED_TAG {word: w.word}]->(other)
            ON CREATE SET st.strength = keyword.frequency * t.frequency
            ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          )
          `;
        }

        query += ` RETURN a`;

        const result = await this.neo4jService.write(query, {
          id,
          updateProperties: {
            answerText: updateData.answerText,
            publicCredit: updateData.publicCredit,
          },
          categoryIds: updateData.categoryIds || [],
          keywords: updateData.keywords || [],
        });

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(
            `Answer with ID ${id} not found or invalid categories`,
          );
        }

        return result.records[0].get('a').properties;
      } else {
        // Simple update without changing relationships
        const result = await this.neo4jService.write(
          `
          MATCH (a:AnswerNode {id: $id})
          SET a += $updateProperties, a.updatedAt = datetime()
          RETURN a
          `,
          {
            id,
            updateProperties: {
              answerText: updateData.answerText,
              publicCredit: updateData.publicCredit,
            },
          },
        );

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Answer with ID ${id} not found`);
        }

        return result.records[0].get('a').properties;
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to update answer: ${error.message}`);
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

  // Voting methods (both inclusion and content)

  async voteAnswerInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.logger.log(
        `Processing inclusion vote on answer ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );
      return await this.voteSchema.vote(
        'AnswerNode',
        { id },
        sub,
        isPositive,
        'INCLUSION',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on answer: ${error.message}`);
    }
  }

  async voteAnswerContent(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      this.logger.log(
        `Processing content vote on answer ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );
      return await this.voteSchema.vote(
        'AnswerNode',
        { id },
        sub,
        isPositive,
        'CONTENT',
      );
    } catch (error) {
      this.logger.error(
        `Error voting on answer content ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to vote on answer content: ${error.message}`);
    }
  }

  async getAnswerVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
    try {
      this.logger.debug(`Getting vote status for answer ${id} by user ${sub}`);
      return await this.voteSchema.getVoteStatus('AnswerNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error getting vote status for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get answer vote status: ${error.message}`);
    }
  }

  async removeAnswerVote(
    id: string,
    sub: string,
    kind: 'INCLUSION' | 'CONTENT',
  ): Promise<VoteResult> {
    try {
      this.logger.log(`Removing ${kind} vote from answer ${id} by user ${sub}`);
      return await this.voteSchema.removeVote('AnswerNode', { id }, sub, kind);
    } catch (error) {
      this.logger.error(
        `Error removing vote from answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to remove answer vote: ${error.message}`);
    }
  }

  async getAnswerVotes(id: string): Promise<VoteResult | null> {
    try {
      this.logger.debug(`Getting votes for answer ${id}`);

      const voteStatus = await this.voteSchema.getVoteStatus(
        'AnswerNode',
        { id },
        '',
      );
      if (!voteStatus) {
        return null;
      }

      return {
        inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
        inclusionNetVotes: voteStatus.inclusionNetVotes,
        contentPositiveVotes: voteStatus.contentPositiveVotes,
        contentNegativeVotes: voteStatus.contentNegativeVotes,
        contentNetVotes: voteStatus.contentNetVotes,
      };
    } catch (error) {
      this.logger.error(
        `Error getting votes for answer ${id}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get answer votes: ${error.message}`);
    }
  }

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
        query += ` ORDER BY a.createdAt ${sortDirection === 'desc' ? 'ASC' : 'DESC'}`;
      } else if (sortBy === 'inclusion_votes') {
        query += ` ORDER BY a.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'content_votes') {
        query += ` ORDER BY a.contentNetVotes ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      if (limit !== null) {
        query += ` SKIP $offset LIMIT $limit`;
      }

      query += `
        RETURN {
          id: a.id,
          answerText: a.answerText,
          createdBy: a.createdBy,
          publicCredit: a.publicCredit,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          inclusionPositiveVotes: a.inclusionPositiveVotes,
          inclusionNegativeVotes: a.inclusionNegativeVotes,
          inclusionNetVotes: a.inclusionNetVotes,
          contentPositiveVotes: a.contentPositiveVotes,
          contentNegativeVotes: a.contentNegativeVotes,
          contentNetVotes: a.contentNetVotes
        } as answer
      `;

      const result = await this.neo4jService.read(query, {
        questionId,
        offset,
        limit,
      });

      const answers = result.records.map((record) => {
        const answer = record.get('answer');
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
      throw new Error(`Failed to get answers: ${error.message}`);
    }
  }

  // DISCOVERY METHODS - New functionality for finding related content

  /**
   * Get content that shares categories with the given answer
   */
  async getRelatedContentBySharedCategories(
    answerId: string,
    options: {
      nodeTypes?: ('statement' | 'answer' | 'openquestion' | 'quantity')[];
      limit?: number;
      offset?: number;
      sortBy?:
        | 'category_overlap'
        | 'created'
        | 'inclusion_votes'
        | 'content_votes';
      sortDirection?: 'asc' | 'desc';
      excludeSelf?: boolean;
      minCategoryOverlap?: number;
    } = {},
  ): Promise<any[]> {
    try {
      const {
        nodeTypes,
        limit = 10,
        offset = 0,
        sortBy = 'category_overlap',
        sortDirection = 'desc',
        excludeSelf = true,
        minCategoryOverlap = 1,
      } = options;

      this.logger.debug(
        `Getting related content by shared categories for answer ${answerId}`,
      );

      let query = `
        MATCH (current:AnswerNode {id: $answerId})
        MATCH (current)-[:CATEGORIZED_AS]->(sharedCat:CategoryNode)
        MATCH (related)-[:CATEGORIZED_AS]->(sharedCat)
        WHERE (related.visibilityStatus <> false OR related.visibilityStatus IS NULL)
      `;

      // Exclude self if requested
      if (excludeSelf) {
        query += ` AND related.id <> $answerId`;
      }

      // Add node type filter if specified
      if (nodeTypes && nodeTypes.length > 0) {
        const nodeLabels = nodeTypes
          .map((type) => {
            switch (type) {
              case 'statement':
                return 'StatementNode';
              case 'answer':
                return 'AnswerNode';
              case 'openquestion':
                return 'OpenQuestionNode';
              case 'quantity':
                return 'QuantityNode';
              default:
                return null;
            }
          })
          .filter(Boolean);

        if (nodeLabels.length > 0) {
          query += ` AND (${nodeLabels.map((label) => `related:${label}`).join(' OR ')})`;
        }
      } else {
        query += ` AND (related:StatementNode OR related:AnswerNode OR related:OpenQuestionNode OR related:QuantityNode)`;
      }

      // Group by related node and count category overlaps
      query += `
        WITH related,
             count(DISTINCT sharedCat) as categoryOverlap,
             collect(DISTINCT {
               id: sharedCat.id, 
               name: sharedCat.name
             }) as sharedCategories
        WHERE categoryOverlap >= $minCategoryOverlap
      `;

      // Add sorting
      if (sortBy === 'category_overlap') {
        query += ` ORDER BY categoryOverlap ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'created') {
        query += ` ORDER BY related.createdAt ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'inclusion_votes') {
        query += ` ORDER BY related.inclusionNetVotes ${sortDirection.toUpperCase()}`;
      } else if (sortBy === 'content_votes') {
        query += ` ORDER BY COALESCE(related.contentNetVotes, 0) ${sortDirection.toUpperCase()}`;
      }

      // Add pagination
      query += ` SKIP $offset LIMIT $limit`;

      // Return formatted results
      query += `
        RETURN {
          id: related.id,
          type: CASE 
            WHEN related:StatementNode THEN 'statement'
            WHEN related:AnswerNode THEN 'answer' 
            WHEN related:OpenQuestionNode THEN 'openquestion'
            WHEN related:QuantityNode THEN 'quantity'
            ELSE 'unknown'
          END,
          content: CASE
            WHEN related:StatementNode THEN related.statement
            WHEN related:AnswerNode THEN related.answerText
            WHEN related:OpenQuestionNode THEN related.questionText  
            WHEN related:QuantityNode THEN related.question
            ELSE null
          END,
          createdBy: related.createdBy,
          createdAt: related.createdAt,
          inclusionNetVotes: related.inclusionNetVotes,
          contentNetVotes: COALESCE(related.contentNetVotes, 0),
          categoryOverlap: categoryOverlap,
          sharedCategories: sharedCategories
        } as relatedNode
      `;

      const result = await this.neo4jService.read(query, {
        answerId,
        offset,
        limit,
        minCategoryOverlap,
      });

      const relatedNodes = result.records.map((record) => {
        const node = record.get('relatedNode');
        // Convert Neo4j integers
        ['inclusionNetVotes', 'contentNetVotes', 'categoryOverlap'].forEach(
          (prop) => {
            if (node[prop] !== undefined) {
              node[prop] = this.toNumber(node[prop]);
            }
          },
        );
        return node;
      });

      this.logger.debug(
        `Found ${relatedNodes.length} related nodes by shared categories`,
      );
      return relatedNodes;
    } catch (error) {
      this.logger.error(
        `Error getting related content by shared categories: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get related content: ${error.message}`);
    }
  }

  /**
   * Get all categories associated with this answer
   */
  async getNodeCategories(answerId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting categories for answer ${answerId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (a:AnswerNode {id: $answerId})
        MATCH (a)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
        // Get parent hierarchy for each category
        OPTIONAL MATCH path = (root:CategoryNode)-[:PARENT_OF*]->(c)
        WHERE NOT EXISTS((other:CategoryNode)-[:PARENT_OF]->(root))
        
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

  /**
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

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
