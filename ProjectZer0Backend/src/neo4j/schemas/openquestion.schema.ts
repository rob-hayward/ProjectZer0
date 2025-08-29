// src/neo4j/schemas/openquestion.schema.ts

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema } from './vote.schema';
import { VotingUtils } from '../../config/voting.config';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import type { VoteStatus, VoteResult } from './vote.schema';

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
    categories?: string[];
  }): Promise<any[]> {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'netPositive',
        sortDirection = 'desc',
        keywords,
        userId,
        categories,
      } = options;

      this.logger.debug(
        `Getting open question network with params: ${JSON.stringify({
          limit,
          offset,
          sortBy,
          sortDirection,
          keywords,
          userId,
          categories,
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

      // Add category filter if specified
      if (categories && categories.length > 0) {
        query += `
          AND EXISTS {
            MATCH (oq)-[:CATEGORIZED_AS]->(cat:CategoryNode)
            WHERE cat.id IN $categories
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
        
        // Get categories
        OPTIONAL MATCH (oq)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get questions with shared keywords
        OPTIONAL MATCH (oq)-[st:SHARED_TAG]->(o:OpenQuestionNode)
        WHERE o.visibilityStatus <> false OR o.visibilityStatus IS NULL
        
        // Get directly related questions
        OPTIONAL MATCH (oq)-[:RELATED_TO]-(r:OpenQuestionNode)
        WHERE r.visibilityStatus <> false OR r.visibilityStatus IS NULL
        
        // Get inclusion vote counts for the question itself (no content voting)
        OPTIONAL MATCH (oq)<-[pv:VOTED_ON {kind: 'INCLUSION', status: 'agree'}]-()
        OPTIONAL MATCH (oq)<-[nv:VOTED_ON {kind: 'INCLUSION', status: 'disagree'}]-()
        
        WITH oq,
             COUNT(DISTINCT pv) as inclusionPositiveVotes,
             COUNT(DISTINCT nv) as inclusionNegativeVotes,
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords,
             collect(DISTINCT {
               id: cat.id,
               name: cat.name,
               inclusionNetVotes: cat.inclusionNetVotes
             }) as categories,
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
             }) as directlyRelatedQuestions
        
        // Get answer nodes separately (new Answer nodes, not Statement nodes)
        OPTIONAL MATCH (ans:AnswerNode)-[:ANSWERS]->(oq)
        WHERE ans.visibilityStatus <> false OR ans.visibilityStatus IS NULL
        OPTIONAL MATCH (ans)<-[apv:VOTED_ON {kind: 'CONTENT', status: 'agree'}]-()
        OPTIONAL MATCH (ans)<-[anv:VOTED_ON {kind: 'CONTENT', status: 'disagree'}]-()
        
        WITH oq, inclusionPositiveVotes, inclusionNegativeVotes, keywords, categories, 
             relatedQuestions, directlyRelatedQuestions,
             ans,
             COUNT(DISTINCT apv) as answerContentPositiveVotes,
             COUNT(DISTINCT anv) as answerContentNegativeVotes
        
        WITH oq, inclusionPositiveVotes, inclusionNegativeVotes, keywords, categories,
             relatedQuestions, directlyRelatedQuestions,
             collect(CASE WHEN ans IS NOT NULL THEN {
               id: ans.id,
               answerText: ans.answerText,
               createdBy: ans.createdBy,
               createdAt: ans.createdAt,
               publicCredit: ans.publicCredit,
               inclusionPositiveVotes: ans.inclusionPositiveVotes,
               inclusionNegativeVotes: ans.inclusionNegativeVotes,
               inclusionNetVotes: ans.inclusionNetVotes,
               contentPositiveVotes: answerContentPositiveVotes,
               contentNegativeVotes: answerContentNegativeVotes,
               contentNetVotes: answerContentPositiveVotes - answerContentNegativeVotes
             } ELSE NULL END) as answersWithNulls
        
        WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions,
             inclusionPositiveVotes, inclusionNegativeVotes,
             [answer IN answersWithNulls WHERE answer IS NOT NULL] as answers
      `;

      // Add sorting based on parameter (inclusion votes only)
      if (sortBy === 'netPositive') {
        query += `
          WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, answers,
               inclusionPositiveVotes, inclusionNegativeVotes,
               (inclusionPositiveVotes - inclusionNegativeVotes) as inclusionNetVotes
          ORDER BY inclusionNetVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'totalVotes') {
        query += `
          WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, answers,
               inclusionPositiveVotes, inclusionNegativeVotes,
               (inclusionPositiveVotes + inclusionNegativeVotes) as totalVotes
          ORDER BY totalVotes ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
        `;
      } else if (sortBy === 'chronological') {
        query += `
          WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, answers,
               inclusionPositiveVotes, inclusionNegativeVotes
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

      // Return question with all its data (inclusion voting only)
      query += `
        RETURN {
          id: oq.id,
          questionText: oq.questionText,
          createdBy: oq.createdBy,
          publicCredit: oq.publicCredit,
          initialComment: oq.initialComment,
          createdAt: oq.createdAt,
          updatedAt: oq.updatedAt,
          // Inclusion voting only (no content voting)
          inclusionPositiveVotes: inclusionPositiveVotes,
          inclusionNegativeVotes: inclusionNegativeVotes,
          inclusionNetVotes: inclusionPositiveVotes - inclusionNegativeVotes,
          keywords: keywords,
          categories: categories,
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
        categories,
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
        // Ensure numeric conversions for inclusion vote properties only
        [
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
        ].forEach((prop) => {
          if (openQuestion[prop] !== undefined) {
            openQuestion[prop] = this.toNumber(openQuestion[prop]);
          }
        });

        // Convert vote counts in answers as well
        if (openQuestion.answers && openQuestion.answers.length > 0) {
          openQuestion.answers.forEach((answer) => {
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
          inclusionNetVotes: 0
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
        
        // Create TAGGED relationship with frequency and source
        CREATE (oq)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        
        // Connect to other open questions that share this keyword
        WITH oq, w, keyword
        OPTIONAL MATCH (o:OpenQuestionNode)-[t:TAGGED]->(w)
        WHERE o.id <> oq.id
        
        // Create SHARED_TAG relationships between questions
        FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
          MERGE (oq)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        )
        `;
      }

      // Create discussion and initial comment
      query += `
        // Create CREATED relationship for user-created content
        WITH oq, $createdBy as userId
        MATCH (u:User {sub: userId})
        CREATE (u)-[:CREATED {
            createdAt: datetime(),
            type: 'openquestion'
        }]->(oq)
        
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
          `Some keywords or categories don't have corresponding nodes. Ensure all keywords exist as words and categories have passed inclusion threshold.`,
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
        
        // Get categories
        OPTIONAL MATCH (oq)-[:CATEGORIZED_AS]->(cat:CategoryNode)
        
        // Get questions with shared keywords
        OPTIONAL MATCH (oq)-[st:SHARED_TAG]->(o:OpenQuestionNode)
        WHERE o.visibilityStatus <> false OR o.visibilityStatus IS NULL
        
        // Get directly related questions
        OPTIONAL MATCH (oq)-[:RELATED_TO]-(r:OpenQuestionNode)
        WHERE r.visibilityStatus <> false OR r.visibilityStatus IS NULL
        
        // Get discussion
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        
        WITH oq,
             collect(DISTINCT {
               word: w.word, 
               frequency: t.frequency,
               source: t.source
             }) as keywords,
             collect(DISTINCT {
               id: cat.id,
               name: cat.name,
               inclusionNetVotes: cat.inclusionNetVotes
             }) as categories,
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
             d.id as discussionId
        
        // Get answer nodes separately (new Answer nodes, not Statement nodes)
        OPTIONAL MATCH (ans:AnswerNode)-[:ANSWERS]->(oq)
        WHERE ans.visibilityStatus <> false OR ans.visibilityStatus IS NULL
        
        // Get vote counts for each answer individually
        OPTIONAL MATCH (ans)<-[pv:VOTED_ON {kind: 'CONTENT', status: 'agree'}]-()
        OPTIONAL MATCH (ans)<-[nv:VOTED_ON {kind: 'CONTENT', status: 'disagree'}]-()
        
        WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, discussionId,
             ans,
             COUNT(DISTINCT pv) as answerContentPositiveVotes,
             COUNT(DISTINCT nv) as answerContentNegativeVotes
        
        WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, discussionId,
             collect(CASE WHEN ans IS NOT NULL THEN {
               id: ans.id,
               answerText: ans.answerText,
               createdBy: ans.createdBy,
               createdAt: ans.createdAt,
               publicCredit: ans.publicCredit,
               inclusionPositiveVotes: ans.inclusionPositiveVotes,
               inclusionNegativeVotes: ans.inclusionNegativeVotes,
               inclusionNetVotes: ans.inclusionNetVotes,
               contentPositiveVotes: answerContentPositiveVotes,
               contentNegativeVotes: answerContentNegativeVotes,
               contentNetVotes: answerContentPositiveVotes - answerContentNegativeVotes
             } ELSE NULL END) as answersWithNulls
        
        WITH oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, discussionId,
             [answer IN answersWithNulls WHERE answer IS NOT NULL] as answers
        
        RETURN oq, keywords, categories, relatedQuestions, directlyRelatedQuestions, answers, discussionId
        `,
        { id },
      );

      if (result.records.length === 0) {
        this.logger.warn(`Open question not found with ID: ${id}`);
        return null;
      }

      const openQuestion = result.records[0].get('oq').properties;
      openQuestion.keywords = result.records[0].get('keywords');
      openQuestion.categories = result.records[0].get('categories');
      openQuestion.relatedQuestions = result.records[0].get('relatedQuestions');
      openQuestion.directlyRelatedQuestions = result.records[0].get(
        'directlyRelatedQuestions',
      );
      openQuestion.answers = result.records[0].get('answers');
      openQuestion.discussionId = result.records[0].get('discussionId');

      // Convert Neo4j integers to JavaScript numbers (inclusion votes only)
      if (openQuestion.inclusionPositiveVotes !== undefined) {
        openQuestion.inclusionPositiveVotes = this.toNumber(
          openQuestion.inclusionPositiveVotes,
        );
      }
      if (openQuestion.inclusionNegativeVotes !== undefined) {
        openQuestion.inclusionNegativeVotes = this.toNumber(
          openQuestion.inclusionNegativeVotes,
        );
      }
      if (openQuestion.inclusionNetVotes !== undefined) {
        openQuestion.inclusionNetVotes = this.toNumber(
          openQuestion.inclusionNetVotes,
        );
      }

      // Convert vote counts in answers as well
      if (openQuestion.answers && openQuestion.answers.length > 0) {
        openQuestion.answers.forEach((answer) => {
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
        });

        // Sort answers by contentNetVotes descending
        openQuestion.answers.sort(
          (a, b) => (b.contentNetVotes || 0) - (a.contentNetVotes || 0),
        );
      }

      this.logger.debug(
        `Retrieved open question with ID: ${id}, found ${openQuestion.answers?.length || 0} answers`,
      );
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
      categoryIds: string[];
      discussionId: string;
    }>,
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      // Validate category count if updating categories
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

      // Complex update with keywords and/or categories
      if (
        (updateData.keywords && updateData.keywords.length > 0) ||
        updateData.categoryIds !== undefined
      ) {
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
          
          // Process updated keywords
          WITH oq
          UNWIND $keywords as keyword
          
          // Find word node for each keyword
          MATCH (w:WordNode {word: keyword.word})
          
          // Create new TAGGED relationship
          CREATE (oq)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          
          // Reconnect to other questions that share this keyword
          WITH oq, w, keyword
          OPTIONAL MATCH (o:OpenQuestionNode)-[t:TAGGED]->(w)
          WHERE o.id <> oq.id
          
          // Create new SHARED_TAG relationships
          FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
            MERGE (oq)-[st:SHARED_TAG {word: w.word}]->(o)
            ON CREATE SET st.strength = keyword.frequency * t.frequency
            ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          )
          `;
        }

        query += ` RETURN oq`;

        const result = await this.neo4jService.write(query, {
          id,
          updateProperties: {
            questionText: updateData.questionText,
            publicCredit: updateData.publicCredit,
            discussionId: updateData.discussionId,
          },
          categoryIds: updateData.categoryIds || [],
          keywords: updateData.keywords || [],
        });

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
          `Some keywords or categories don't exist or haven't passed inclusion threshold.`,
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
      // Note: We keep answer nodes as they may be valuable independently
      await this.neo4jService.write(
        `
        MATCH (oq:OpenQuestionNode {id: $id})
        // Get associated discussion and comments to delete as well
        OPTIONAL MATCH (oq)-[:HAS_DISCUSSION]->(d:DiscussionNode)
        OPTIONAL MATCH (d)-[:HAS_COMMENT]->(c:CommentNode)
        // Remove ANSWERS relationships but keep the answer nodes
        OPTIONAL MATCH (ans:AnswerNode)-[answersRel:ANSWERS]->(oq)
        DELETE answersRel
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
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `Error deleting open question ${id}: ${error.message}`,
        error.stack,
      );
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

  // Voting methods - INCLUSION ONLY for OpenQuestions

  async voteOpenQuestionInclusion(
    id: string,
    sub: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(
        `Processing inclusion vote on open question ${id} by user ${sub}: ${isPositive ? 'positive' : 'negative'}`,
      );

      const result = await this.voteSchema.vote(
        'OpenQuestionNode',
        { id },
        sub,
        isPositive,
        'INCLUSION',
      );

      return result;
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

  async getOpenQuestionVoteStatus(
    id: string,
    sub: string,
  ): Promise<VoteStatus | null> {
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

  async removeOpenQuestionVote(id: string, sub: string): Promise<VoteResult> {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Open question ID cannot be empty');
      }

      if (!sub || sub.trim() === '') {
        throw new BadRequestException('User ID cannot be empty');
      }

      this.logger.log(
        `Removing inclusion vote from open question ${id} by user ${sub}`,
      );

      const result = await this.voteSchema.removeVote(
        'OpenQuestionNode',
        { id },
        sub,
        'INCLUSION',
      );

      return result;
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

  async getOpenQuestionVotes(id: string): Promise<VoteResult | null> {
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
        inclusionPositiveVotes: voteStatus.inclusionPositiveVotes,
        inclusionNegativeVotes: voteStatus.inclusionNegativeVotes,
        inclusionNetVotes: voteStatus.inclusionNetVotes,
        // OpenQuestions don't have content voting
        contentPositiveVotes: 0,
        contentNegativeVotes: 0,
        contentNetVotes: 0,
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
   * Check if an OpenQuestion can accept answers (has passed inclusion threshold)
   */
  async isOpenQuestionAvailableForAnswers(
    questionId: string,
  ): Promise<boolean> {
    try {
      const question = await this.getOpenQuestion(questionId);
      if (!question) return false;

      return VotingUtils.isAnswerCreationAllowed(question.inclusionNetVotes);
    } catch (error) {
      this.logger.error(
        `Error checking question availability for answers: ${error.message}`,
      );
      return false;
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

  // DISCOVERY METHODS - New functionality for finding related content

  /**
   * Get content nodes that share categories with the given open question
   */
  async getRelatedContentBySharedCategories(
    nodeId: string,
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
        `Getting related content by shared categories for open question node ${nodeId}`,
      );

      let query = `
        MATCH (current:OpenQuestionNode {id: $nodeId})
        MATCH (current)-[:CATEGORIZED_AS]->(sharedCat:CategoryNode)
        MATCH (related)-[:CATEGORIZED_AS]->(sharedCat)
        WHERE (related.visibilityStatus <> false OR related.visibilityStatus IS NULL)
      `;

      // Exclude self if requested
      if (excludeSelf) {
        query += ` AND related.id <> $nodeId`;
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
        nodeId,
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
        `Found ${relatedNodes.length} related nodes by shared categories for open question node ${nodeId}`,
      );
      return relatedNodes;
    } catch (error) {
      this.logger.error(
        `Error getting related content by shared categories for open question node ${nodeId}: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get related content: ${error.message}`);
    }
  }

  /**
   * Get all categories associated with this open question
   */
  async getNodeCategories(nodeId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting categories for open question node ${nodeId}`);

      const result = await this.neo4jService.read(
        `
        MATCH (oq:OpenQuestionNode {id: $nodeId})
        MATCH (oq)-[:CATEGORIZED_AS]->(c:CategoryNode)
        
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
        { nodeId },
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
        `Retrieved ${categories.length} categories for open question node ${nodeId}`,
      );
      return categories;
    } catch (error) {
      this.logger.error(
        `Error getting categories for open question node ${nodeId}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to get open question categories: ${error.message}`,
      );
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
