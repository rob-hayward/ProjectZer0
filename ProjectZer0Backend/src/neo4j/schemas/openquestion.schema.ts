// src/neo4j/schemas/openquestion.schema.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';

@Injectable()
export class OpenQuestionSchema {
  private readonly logger = new Logger(OpenQuestionSchema.name);

  constructor(
    private readonly neo4jService: Neo4jService,
    private readonly voteSchema: VoteSchema,
  ) {}

  async getOpenQuestionNetwork(options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: string;
    keywords?: string[];
    userId?: string;
  }): Promise<any[]> {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'netPositive',
        sortDirection = 'desc',
        keywords,
        userId,
      } = options;

      this.logger.debug(
        `Getting open question network with params: ${JSON.stringify({
          limit,
          offset,
          sortBy,
          sortDirection,
          keywords,
          userId,
        })}`,
      );

      // First, check if we have any open questions in the database
      try {
        const countResult = await this.neo4jService.read(
          `MATCH (oq:OpenQuestionNode) RETURN count(oq) as count`,
        );
        const questionCount = countResult.records[0].get('count').toNumber();

        if (questionCount === 0) {
          this.logger.debug('No open questions found in database');
          return [];
        }
      } catch (error) {
        this.logger.error(
          `Error counting open questions: ${error.message}`,
          error.stack,
        );
      }

      // Build the query for fetching open question network
      let query = `
        MATCH (oq:OpenQuestionNode)
        WHERE oq.visibilityStatus <> false OR oq.visibilityStatus IS NULL
      `;

      // Add keyword filter if specified
      if (keywords && keywords.length > 0) {
        query += `
          AND EXISTS {
            MATCH (oq)-[:TAGGED]->(w:WordNode)
            WHERE w.word IN $keywords
          }
        `;
      }

      // Add user filter if specified
      if (userId) {
        query += `
          AND oq.createdBy = $userId
        `;
      }

      // Get all related questions and their connections
      query += `
        // Get keywords
        OPTIONAL MATCH (oq)-[t:TAGGED]->(w:WordNode)
        
        // Get questions with shared keywords
        OPTIONAL MATCH (oq)-[st:SHARED_TAG]->(o:OpenQuestionNode)
        WHERE o.visibilityStatus <> false OR o.visibilityStatus IS NULL
        
        // Get directly related questions
        OPTIONAL MATCH (oq)-[:RELATED_TO]-(r:OpenQuestionNode)
        WHERE r.visibilityStatus <> false OR r.visibilityStatus IS NULL
        
        // Get answer statements
        OPTIONAL MATCH (oq)<-[:ANSWERS]-(ans:StatementNode)
        WHERE ans.visibilityStatus <> false OR ans.visibilityStatus IS NULL
        
        // Get vote counts
        OPTIONAL MATCH (oq)<-[pv:VOTED_ON {status: 'agree'}]-()
        OPTIONAL MATCH (oq)<-[nv:VOTED_ON {status: 'disagree'}]-()
        
        WITH oq,
             COUNT(DISTINCT pv) as positiveVotes,
             COUNT(DISTINCT nv) as negativeVotes,
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords,
             collect(DISTINCT {
               nodeId: o.id,
               questionText: o.questionText,
               sharedWord: st.word,
               strength: st.strength
             }) as relatedQuestions,
             collect(DISTINCT {
               nodeId: r.id,
               questionText: r.questionText,
               relationshipType: 'direct'
             }) as directlyRelatedQuestions,
             collect(DISTINCT {
               id: ans.id,
               statement: ans.statement,
               createdBy: ans.createdBy,
               createdAt: ans.createdAt,
               netVotes: ans.netVotes
             }) as answers
      `;

      // Add sorting based on parameter, but keep all vote data in scope
      if (sortBy === 'netPositive') {
        query += `
          WITH oq, keywords, relatedQuestions, directlyRelatedQuestions, answers,
               positiveVotes, negativeVotes,
               (positiveVotes - negativeVotes) as netVotes
          ORDER BY netVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'totalVotes') {
        query += `
          WITH oq, keywords, relatedQuestions, directlyRelatedQuestions, answers,
               positiveVotes, negativeVotes,
               (positiveVotes + negativeVotes) as totalVotes
          ORDER BY totalVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'chronological') {
        query += `
          WITH oq, keywords, relatedQuestions, directlyRelatedQuestions, answers,
               positiveVotes, negativeVotes
          ORDER BY oq.createdAt ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      }

      // Add pagination if specified
      if (limit !== null) {
        query += `
          SKIP $offset
          LIMIT $limit
        `;
      }

      // Return question with all its data
      query += `
        RETURN {
          id: oq.id,
          questionText: oq.questionText,
          createdBy: oq.createdBy,
          publicCredit: oq.publicCredit,
          initialComment: oq.initialComment,
          createdAt: oq.createdAt,
          updatedAt: oq.updatedAt,
          positiveVotes: positiveVotes,
          negativeVotes: negativeVotes,
          netVotes: positiveVotes - negativeVotes,
          keywords: keywords,
          relatedQuestions: CASE 
            WHEN size(relatedQuestions) > 0 THEN relatedQuestions
            ELSE []
          END,
          directlyRelatedQuestions: CASE
            WHEN size(directlyRelatedQuestions) > 0 THEN directlyRelatedQuestions
            ELSE []
          END,
          answers: CASE
            WHEN size(answers) > 0 THEN answers
            ELSE []
          END
        } as openQuestion
      `;

      // Execute the query
      const result = await this.neo4jService.read(query, {
        limit,
        offset,
        keywords,
        userId,
      });

      this.logger.debug(`Retrieved ${result.records.length} open questions`);

      // Process the results to include both relationship types
      const openQuestions = result.records.map((record) => {
        const openQuestion = record.get('openQuestion');

        // Merge the two relationship types for frontend convenience
        if (
          openQuestion.directlyRelatedQuestions &&
          openQuestion.directlyRelatedQuestions.length > 0
        ) {
          if (!openQuestion.relatedQuestions)
            openQuestion.relatedQuestions = [];

          // Add any direct relationships not already in relatedQuestions
          openQuestion.directlyRelatedQuestions.forEach((direct) => {
            const exists = openQuestion.relatedQuestions.some(
              (rel) => rel.nodeId === direct.nodeId,
            );
            if (!exists) {
              openQuestion.relatedQuestions.push({
                ...direct,
                sharedWord: 'direct',
                strength: 1.0, // Direct relationships have maximum strength
              });
            }
          });
        }

        // Remove the redundant property to clean up the response
        delete openQuestion.directlyRelatedQuestions;

        return openQuestion;
      });

      // Convert Neo4j integers to JavaScript numbers for consistency
      openQuestions.forEach((openQuestion) => {
        // Ensure numeric conversions for vote properties
        ['positiveVotes', 'negativeVotes', 'netVotes'].forEach((prop) => {
          if (openQuestion[prop] !== undefined) {
            openQuestion[prop] = this.toNumber(openQuestion[prop]);
          }
        });

        // Convert vote counts in answers as well
        if (openQuestion.answers && openQuestion.answers.length > 0) {
          openQuestion.answers.forEach((answer) => {
            if (answer.netVotes !== undefined) {
              answer.netVotes = this.toNumber(answer.netVotes);
            }
          });
        }
      });

      return openQuestions;
    } catch (error) {
      this.logger.error(
        `Error getting open question network: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to retrieve open question network: ${error.message}`,
      );
    }
  }

  async createOpenQuestion(questionData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    questionText: string;
    keywords: KeywordWithFrequency[];
    initialComment: string;
  }) {
    try {
      if (
        !questionData.questionText ||
        questionData.questionText.trim() === ''
      ) {
        throw new BadRequestException('Question text cannot be empty');
      }

      // Ensure question ends with '?' or add it automatically
      let normalizedQuestionText = questionData.questionText.trim();
      if (!normalizedQuestionText.endsWith('?')) {
        normalizedQuestionText += '?';
      }

      this.logger.log(`Creating open question with ID: ${questionData.id}`);
      this.logger.debug(`Question data: ${JSON.stringify(questionData)}`);

      const result = await this.neo4jService.write(
        `
        // Create the open question node
        CREATE (oq:OpenQuestionNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          questionText: $questionText,
          initialComment: $initialComment,
          createdAt: datetime(),
          updatedAt: datetime(),
          positiveVotes: 0,
          negativeVotes: 0,
          netVotes: 0
        })
        
        // Process each keyword
        WITH oq
        UNWIND $keywords as keyword
        
        // Find word node for each keyword (don't create - already done by WordService)
        MATCH (w:WordNode {word: keyword.word})
        
        // Create TAGGED relationship with frequency and source
        CREATE (oq)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Connect to other open questions that share this keyword
        WITH oq, w, keyword
        MATCH (o:OpenQuestionNode)-[t:TAGGED]->(w)
        WHERE o.id <> oq.id
        
        // Create SHARED_TAG relationships between questions
        MERGE (oq)-[st:SHARED_TAG {word: w.word}]->(o)
        ON CREATE SET st.strength = keyword.frequency * t.frequency
        ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        
        // Create discussion node automatically
        WITH DISTINCT oq
        CREATE (d:DiscussionNode {
          id: apoc.create.uuid(),
          createdAt: datetime(),
          createdBy: $createdBy,
          visibilityStatus: true
        })
        CREATE (oq)-[:HAS_DISCUSSION]->(d)
        
        // Create initial comment only if provided
        WITH oq, d, $initialComment as initialComment
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
        
        RETURN oq
        `,
        {
          ...questionData,
          questionText: normalizedQuestionText,
        },
      );

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
          `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before creating the question.`,
        );
      }

      throw new Error(`Failed to create open question: ${error.message}`);
    }
  }

  async getOpenQuestion(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      this.logger.debug(`Retrieving open question with ID: ${id}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        
        // Get keywords
        OPTIONAL MATCH (oq)-[t:TAGGED]->(w:WordNode)
        
        // Get questions with shared keywords
        OPTIONAL MATCH (oq)-[st:SHARED_TAG]->(o:OpenQuestionNode)
        
        // Get directly related questions
        OPTIONAL MATCH (oq)-[:RELATED_TO]-(r:OpenQuestionNode)
        
        // Get answer statements
        OPTIONAL MATCH (oq)<-[:ANSWERS]-(ans:StatementNode)
        WHERE ans.visibilityStatus <> false OR ans.visibilityStatus IS NULL
        
        // Get discussion
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        RETURN oq,
               collect(DISTINCT {
                 word: w.word, 
                 frequency: t.frequency,
                 source: t.source
               }) as keywords,
               collect(DISTINCT {
                 nodeId: o.id,
                 questionText: o.questionText,
                 sharedWord: st.word,
                 strength: st.strength
               }) as relatedQuestions,
               collect(DISTINCT {
                 nodeId: r.id,
                 questionText: r.questionText,
                 relationshipType: 'direct'
               }) as directlyRelatedQuestions,
               collect(DISTINCT {
                 id: ans.id,
                 statement: ans.statement,
                 createdBy: ans.createdBy,
                 createdAt: ans.createdAt,
                 netVotes: ans.netVotes
               }) as answers,
               d.id as discussionId
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Open question not found with ID: ${id}`);
        return null;
      }

      const openQuestion = result.records[0].get('oq').properties;
      openQuestion.keywords = result.records[0].get('keywords');
      openQuestion.relatedQuestions = result.records[0].get('relatedQuestions');
      openQuestion.directlyRelatedQuestions = result.records[0].get(
        'directlyRelatedQuestions',
      );
      openQuestion.answers = result.records[0].get('answers');
      openQuestion.discussionId = result.records[0].get('discussionId');

      // Convert Neo4j integers to JavaScript numbers
      if (openQuestion.positiveVotes !== undefined) {
        openQuestion.positiveVotes = this.toNumber(openQuestion.positiveVotes);
      }
      if (openQuestion.negativeVotes !== undefined) {
        openQuestion.negativeVotes = this.toNumber(openQuestion.negativeVotes);
      }
      if (openQuestion.netVotes !== undefined) {
        openQuestion.netVotes = this.toNumber(openQuestion.netVotes);
      }

      // Convert vote counts in answers as well
      if (openQuestion.answers && openQuestion.answers.length > 0) {
        openQuestion.answers.forEach((answer) => {
          if (answer.netVotes !== undefined) {
            answer.netVotes = this.toNumber(answer.netVotes);
          }
        });
      }

      this.logger.debug(`Retrieved open question with ID: ${id}`);
      return openQuestion;
    } catch (error) {
      this.logger.error(
        `Error retrieving open question ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to retrieve open question: ${error.message}`);
    }
  }

  async updateOpenQuestion(
    id: string,
    updateData: Partial<{
      questionText: string;
      publicCredit: boolean;
      keywords: KeywordWithFrequency[];
      discussionId: string;
    }>,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
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

      // If keywords are provided, update the relationships
      if (updateData.keywords && updateData.keywords.length > 0) {
        const result = await this.neo4jService.write(
          `
          // Match the question to update
          MATCH (oq:OpenQuestionNode {id: $id})
          
          // Set updated properties
          SET oq += $updateProperties,
              oq.updatedAt = datetime()
          
          // Remove existing TAGGED relationships
          WITH oq
          OPTIONAL MATCH (oq)-[r:TAGGED]->()
          DELETE r
          
          // Remove existing SHARED_TAG relationships
          WITH oq
          OPTIONAL MATCH (oq)-[st:SHARED_TAG]->()
          DELETE st
          
          // Process updated keywords
          WITH oq
          UNWIND $keywords as keyword
          
          // Find word node for each keyword (don't create - already done by WordService)
          MATCH (w:WordNode {word: keyword.word})
          
          // Create new TAGGED relationship
          CREATE (oq)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          
          // Reconnect to other questions that share this keyword
          WITH oq, w, keyword
          MATCH (o:OpenQuestionNode)-[t:TAGGED]->(w)
          WHERE o.id <> oq.id
          
          // Create new SHARED_TAG relationships
          MERGE (oq)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          
          RETURN oq
          `,
          {
            id,
            updateProperties: {
              questionText: updateData.questionText,
              publicCredit: updateData.publicCredit,
              discussionId: updateData.discussionId,
            },
            keywords: updateData.keywords,
          },
        );

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Open question with ID ${id} not found`);
        }

        const updatedQuestion = result.records[0].get('oq').properties;
        this.logger.log(`Successfully updated open question with ID: ${id}`);
        this.logger.debug(
          `Updated question: ${JSON.stringify(updatedQuestion)}`,
        );

        return updatedQuestion;
      } else {
        // Simple update without changing relationships
        const result = await this.neo4jService.write(
          `
          MATCH (oq:OpenQuestionNode {id: $id})
          SET oq += $updateProperties, oq.updatedAt = datetime()
          RETURN oq
          `,
          {
            id,
            updateProperties: {
              questionText: updateData.questionText,
              publicCredit: updateData.publicCredit,
              discussionId: updateData.discussionId,
            },
          },
        );

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Open question with ID ${id} not found`);
        }

        const updatedQuestion = result.records[0].get('oq').properties;
        this.logger.log(`Successfully updated open question with ID: ${id}`);
        this.logger.debug(
          `Updated question: ${JSON.stringify(updatedQuestion)}`,
        );

        return updatedQuestion;
      }
    } catch (error) {
      this.logger.error(
        `Error updating open question ${id}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle the specific case of missing word nodes
      if (error.message && error.message.includes('not found')) {
        throw new BadRequestException(
          `Some keywords don't have corresponding word nodes. Ensure all keywords exist as words before updating the question.`,
        );
      }

      throw new Error(`Failed to update open question: ${error.message}`);
    }
  }

  async deleteOpenQuestion(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      this.logger.log(`Deleting open question with ID: ${id}`);

      // First check if the question exists
      const checkResult = await this.neo4jService.read(
        `MATCH (oq:OpenQuestionNode {id: $id}) RETURN oq`,
        { id },
      );

      if (!checkResult.records || checkResult.records.length === 0) {
        throw new NotFoundException(`Open question with ID ${id} not found`);
      }

      // Delete question and all related nodes (discussion, comments)
      // Note: We keep answer statements as they may be valuable independently
      await this.neo4jService.write(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        // Get associated discussion and comments to delete as well
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        // Remove ANSWERS relationships but keep the statement nodes
        OPTIONAL MATCH (oq)<-[ans:ANSWERS]-(s:StatementNode)
        DELETE ans
        // Delete question, discussion, and comments
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

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to delete open question: ${error.message}`);
    }
  }

  async setVisibilityStatus(id: string, isVisible: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

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

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to set visibility status: ${error.message}`);
    }
  }

  async getVisibilityStatus(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

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

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to get visibility status: ${error.message}`);
    }
  }

  // Standardized vote methods that match the pattern used in StatementSchema
  async voteOpenQuestion(id: string, sub: string, isPositive: boolean) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(
        `Processing vote on open question ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      return await this.voteSchema.vote(
        'OpenQuestionNode',
        { id },
        sub,
        isPositive,
      );
    } catch (error) {
      this.logger.error(
        `Error voting on open question ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to vote on open question: ${error.message}`);
    }
  }

  async getOpenQuestionVoteStatus(id: string, sub: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.debug(
        `Getting vote status for open question ${id} by user ${sub}`,
      );

      return await this.voteSchema.getVoteStatus(
        'OpenQuestionNode',
        { id },
        sub,
      );
    } catch (error) {
      this.logger.error(
        `Error getting vote status for open question ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(
        `Failed to get open question vote status: ${error.message}`,
      );
    }
  }

  async removeOpenQuestionVote(id: string, sub: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(`Removing vote from open question ${id} by user ${sub}`);

      return await this.voteSchema.removeVote('OpenQuestionNode', { id }, sub);
    } catch (error) {
      this.logger.error(
        `Error removing vote from open question ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to remove open question vote: ${error.message}`);
    }
  }

  async getOpenQuestionVotes(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      this.logger.debug(`Getting votes for open question ${id}`);

      const voteStatus = await this.voteSchema.getVoteStatus(
        'OpenQuestionNode',
        { id },
        '', // Empty string as we don't need user-specific status
      );

      if (!voteStatus) {
        this.logger.debug(`No votes found for open question: ${id}`);
        return null;
      }

      const votes = {
        positiveVotes: voteStatus.positiveVotes,
        negativeVotes: voteStatus.negativeVotes,
        netVotes: voteStatus.netVotes,
      };

      this.logger.debug(
        `Votes for open question ${id}: ${JSON.stringify(votes)}`,
      );
      return votes;
    } catch (error) {
      this.logger.error(
        `Error getting votes for open question ${id}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to get open question votes: ${error.message}`);
    }
  }

  /**
   * Creates a direct, undirected relationship between two open questions
   */
  async createDirectRelationship(
    questionId1: string,
    questionId2: string,
  ): Promise<{ success: boolean }> {
    if (questionId1 === questionId2) {
      throw new Error(
        'Cannot create a relationship between a question and itself',
      );
    }

    try {
      await this.neo4jService.write(
        `
        MATCH (oq1:OpenQuestionNode {id: $questionId1})
        MATCH (oq2:OpenQuestionNode {id: $questionId2})
        
        // Create relationship in one direction
        MERGE (oq1)-[r:RELATED_TO]->(oq2)
        
        // Set properties if needed (could add created date, strength, etc.)
        ON CREATE SET r.createdAt = datetime()
        `,
        { questionId1, questionId2 },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error creating direct relationship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Removes a direct relationship between two open questions
   */
  async removeDirectRelationship(
    questionId1: string,
    questionId2: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.neo4jService.write(
        `
        MATCH (oq1:OpenQuestionNode {id: $questionId1})-[r:RELATED_TO]-(oq2:OpenQuestionNode {id: $questionId2})
        DELETE r
        `,
        { questionId1, questionId2 },
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error removing direct relationship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets all open questions directly related to the given question
   */
  async getDirectlyRelatedQuestions(questionId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      this.logger.debug(`Getting questions directly related to ${questionId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $questionId})-[:RELATED_TO]-(r:OpenQuestionNode)
        RETURN collect({
          id: r.id,
          questionText: r.questionText,
          createdBy: r.createdBy,
          createdAt: r.createdAt,
          publicCredit: r.publicCredit
        }) as relatedQuestions
        `,
        { questionId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const relatedQuestions = result.records[0].get('relatedQuestions');
      this.logger.debug(
        `Found ${relatedQuestions.length} directly related questions`,
      );

      return relatedQuestions;
    } catch (error) {
      this.logger.error(
        `Error getting directly related questions: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(
        `Failed to get directly related questions: ${error.message}`,
      );
    }
  }

  /**
   * Creates an ANSWERS relationship between a statement and this open question
   */
  async linkAnswerToQuestion(questionId: string, statementId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!statementId || statementId.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(
        `Linking statement ${statementId} as answer to question ${questionId}`,
      );

      const result = await this.neo4jService.write(
        `
        MATCH (oq:OpenQuestionNode {id: $questionId})
        MATCH (s:StatementNode {id: $statementId})
        
        // Create ANSWERS relationship
        MERGE (s)-[r:ANSWERS]->(oq)
        ON CREATE SET r.createdAt = datetime()
        
        RETURN oq, s
        `,
        { questionId, statementId },
      );

      if (!result.records || result.records.length === 0) {
        throw new NotFoundException(
          `Open question or statement not found: ${questionId}, ${statementId}`,
        );
      }

      this.logger.debug(
        `Successfully linked statement ${statementId} to question ${questionId}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error linking answer to question: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(`Failed to link answer to question: ${error.message}`);
    }
  }

  /**
   * Removes an ANSWERS relationship between a statement and this open question
   */
  async unlinkAnswerFromQuestion(questionId: string, statementId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!statementId || statementId.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      this.logger.log(
        `Unlinking statement ${statementId} from question ${questionId}`,
      );

      await this.neo4jService.write(
        `
        MATCH (s:StatementNode {id: $statementId})-[r:ANSWERS]->(oq:OpenQuestionNode {id: $questionId})
        DELETE r
        `,
        { questionId, statementId },
      );

      this.logger.debug(
        `Successfully unlinked statement ${statementId} from question ${questionId}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error unlinking answer from question: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(
        `Failed to unlink answer from question: ${error.message}`,
      );
    }
  }

  /**
   * Gets all statements that answer this open question
   */
  async getQuestionAnswers(questionId: string) {
    try {
      if (!questionId || questionId.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      this.logger.debug(`Getting answers for question ${questionId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $questionId})<-[:ANSWERS]-(s:StatementNode)
        WHERE s.visibilityStatus <> false OR s.visibilityStatus IS NULL
        
        // Get vote counts for each answer
        OPTIONAL MATCH (s)<-[pv:VOTED_ON {status: 'agree'}]-()
        OPTIONAL MATCH (s)<-[nv:VOTED_ON {status: 'disagree'}]-()
        
        WITH s, COUNT(DISTINCT pv) as positiveVotes, COUNT(DISTINCT nv) as negativeVotes
        
        RETURN collect({
          id: s.id,
          statement: s.statement,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          publicCredit: s.publicCredit,
          positiveVotes: positiveVotes,
          negativeVotes: negativeVotes,
          netVotes: positiveVotes - negativeVotes
        }) as answers
        ORDER BY positiveVotes - negativeVotes DESC
        `,
        { questionId },
      );

      if (!result.records || result.records.length === 0) {
        return [];
      }

      const answers = result.records[0].get('answers');

      // Convert Neo4j integers to JavaScript numbers
      answers.forEach((answer) => {
        ['positiveVotes', 'negativeVotes', 'netVotes'].forEach((prop) => {
          if (answer[prop] !== undefined) {
            answer[prop] = this.toNumber(answer[prop]);
          }
        });
      });

      this.logger.debug(
        `Found ${answers.length} answers for question ${questionId}`,
      );
      return answers;
    } catch (error) {
      this.logger.error(
        `Error getting question answers: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(`Failed to get question answers: ${error.message}`);
    }
  }

  async checkOpenQuestions(): Promise<{ count: number }> {
    try {
      this.logger.debug('Checking open question count');

      const result = await this.neo4jService.read(
        `MATCH (oq:OpenQuestionNode) RETURN count(oq) as count`,
      );

      const count = this.toNumber(result.records[0].get('count'));
      this.logger.debug(`Found ${count} open questions in database`);

      return { count };
    } catch (error) {
      this.logger.error(
        `Error checking open questions: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to check open questions: ${error.message}`);
    }
  }

  /**
   * Helper method to convert Neo4j integer values to JavaScript numbers
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    // Handle Neo4j integer objects
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
