// src/neo4j/schemas/statement.schema.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { VoteSchema, VoteResult } from './vote.schema';
import { BaseNodeSchema, BaseNodeData } from './base/base-node.schema';
import { VotingUtils } from '../../config/voting.config';
import { KeywordWithFrequency } from '../../services/keyword-extraction/keyword-extraction.interface';
import { Record } from 'neo4j-driver';

export interface StatementData extends BaseNodeData {
  statement: string;
  keywords?: KeywordWithFrequency[];
  categories?: any[];
  relatedStatements?: any[];
}

@Injectable()
export class StatementSchema extends BaseNodeSchema<StatementData> {
  protected readonly nodeLabel = 'StatementNode';
  protected readonly idField = 'id';

  constructor(neo4jService: Neo4jService, voteSchema: VoteSchema) {
    super(neo4jService, voteSchema, StatementSchema.name);
  }

  protected supportsContentVoting(): boolean {
    return true;
  }

  protected mapNodeFromRecord(record: Record): StatementData {
    const props = record.get('n').properties;
    return {
      id: props.id,
      createdBy: props.createdBy,
      publicCredit: props.publicCredit,
      statement: props.statement,
      discussionId: props.discussionId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      inclusionPositiveVotes: this.toNumber(props.inclusionPositiveVotes),
      inclusionNegativeVotes: this.toNumber(props.inclusionNegativeVotes),
      inclusionNetVotes: this.toNumber(props.inclusionNetVotes),
      contentPositiveVotes: this.toNumber(props.contentPositiveVotes),
      contentNegativeVotes: this.toNumber(props.contentNegativeVotes),
      contentNetVotes: this.toNumber(props.contentNetVotes),
    };
  }

  protected buildUpdateQuery(id: string, data: Partial<StatementData>) {
    const setClause = Object.keys(data)
      .filter(
        (key) => key !== 'id' && key !== 'keywords' && key !== 'categoryIds',
      )
      .map((key) => `n.${key} = $updateData.${key}`)
      .join(', ');

    return {
      cypher: `
        MATCH (n:StatementNode {id: $id})
        SET ${setClause}, n.updatedAt = datetime()
        RETURN n
      `,
      params: { id, updateData: data },
    };
  }

  async voteContent(
    id: string,
    userId: string,
    isPositive: boolean,
  ): Promise<VoteResult> {
    this.validateId(id);
    this.validateUserId(userId);

    const statement = await this.findById(id);
    if (
      !statement ||
      !VotingUtils.hasPassedInclusion(statement.inclusionNetVotes)
    ) {
      throw new BadRequestException(
        'Statement must pass inclusion threshold before content voting is allowed',
      );
    }

    return super.voteContent(id, userId, isPositive);
  }

  async createStatement(statementData: {
    id: string;
    createdBy: string;
    publicCredit: boolean;
    statement: string;
    keywords: KeywordWithFrequency[];
    categoryIds?: string[];
    initialComment?: string;
    parentStatementId?: string;
  }) {
    try {
      if (!statementData.statement || statementData.statement.trim() === '') {
        throw new BadRequestException('Statement text cannot be empty');
      }

      if (statementData.categoryIds && statementData.categoryIds.length > 3) {
        throw new BadRequestException(
          'Statement can have maximum 3 categories',
        );
      }

      let query = `
        CREATE (s:StatementNode {
          id: $id,
          createdBy: $createdBy,
          publicCredit: $publicCredit,
          statement: $statement,
          createdAt: datetime(),
          updatedAt: datetime(),
          inclusionPositiveVotes: 0,
          inclusionNegativeVotes: 0,
          inclusionNetVotes: 0,
          contentPositiveVotes: 0,
          contentNegativeVotes: 0,
          contentNetVotes: 0
        })
      `;

      if (statementData.parentStatementId) {
        query += `
        WITH s
        MATCH (parent:StatementNode {id: $parentStatementId})
        CREATE (s)-[:RELATED_TO]->(parent)
        `;
      }

      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        query += `
        WITH s, $categoryIds as categoryIds
        UNWIND categoryIds as categoryId
        MATCH (cat:CategoryNode {id: categoryId})
        WHERE cat.inclusionNetVotes > 0
        CREATE (s)-[:CATEGORIZED_AS]->(cat)
        WITH s, collect(cat) as validCategories, categoryIds
        WHERE size(validCategories) = size(categoryIds)
        `;
      }

      if (statementData.keywords && statementData.keywords.length > 0) {
        query += `
        WITH s
        UNWIND $keywords as keyword
        MATCH (w:WordNode {word: keyword.word})
        WHERE w.inclusionNetVotes > 0
        CREATE (s)-[:TAGGED {
          frequency: keyword.frequency,
          source: keyword.source
        }]->(w)
        WITH s, w, keyword
        OPTIONAL MATCH (o:StatementNode)-[t:TAGGED]->(w)
        WHERE o.id <> s.id
        FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
          MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
          ON CREATE SET st.strength = keyword.frequency * t.frequency
          ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
        )
        `;
      }

      query += ` RETURN s`;

      const params: any = {
        id: statementData.id,
        createdBy: statementData.createdBy,
        publicCredit: statementData.publicCredit,
        statement: statementData.statement,
      };

      if (statementData.parentStatementId) {
        params.parentStatementId = statementData.parentStatementId;
      }
      if (statementData.categoryIds && statementData.categoryIds.length > 0) {
        params.categoryIds = statementData.categoryIds;
      }
      if (statementData.keywords && statementData.keywords.length > 0) {
        params.keywords = statementData.keywords;
      }

      const result = await this.neo4jService.write(query, params);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          'Failed to create statement - some dependencies may not exist or have not passed inclusion threshold',
        );
      }

      const createdStatement = result.records[0].get('s').properties;

      const discussionId = await this.createDiscussion({
        nodeId: statementData.id,
        nodeType: this.nodeLabel,
        createdBy: statementData.createdBy,
        initialComment: statementData.initialComment,
      });

      createdStatement.discussionId = discussionId;

      return createdStatement;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error.message &&
        error.message.includes('some dependencies may not exist')
      ) {
        throw new BadRequestException(
          `Some categories, keywords, or parent statement don't exist or haven't passed inclusion threshold.`,
        );
      }

      throw this.standardError('create statement', error);
    }
  }

  async getStatement(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $id})
        OPTIONAL MATCH (s)-[:HAS_DISCUSSION]->(disc:DiscussionNode)
        OPTIONAL MATCH (s)-[tagged:TAGGED]->(keyword:WordNode)
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(category:CategoryNode)
        WHERE category.inclusionNetVotes > 0
        OPTIONAL MATCH (s)-[shared:SHARED_TAG]->(related:StatementNode)
        WHERE related.inclusionNetVotes >= 0
        OPTIONAL MATCH (s)-[:RELATED_TO]-(direct:StatementNode)
        WHERE direct.inclusionNetVotes >= 0
        
        RETURN s,
        disc.id as discussionId,
        collect(DISTINCT {
          word: keyword.word,
          frequency: tagged.frequency,
          source: tagged.source
        }) as keywords,
        collect(DISTINCT {
          id: category.id,
          name: category.name,
          description: category.description
        }) as categories,
        collect(DISTINCT {
          nodeId: related.id,
          statement: related.statement,
          sharedWord: shared.word,
          strength: shared.strength,
          inclusionNetVotes: related.inclusionNetVotes,
          contentNetVotes: related.contentNetVotes
        }) as relatedStatements,
        collect(DISTINCT {
          nodeId: direct.id,
          statement: direct.statement,
          inclusionNetVotes: direct.inclusionNetVotes,
          contentNetVotes: direct.contentNetVotes
        }) as directlyRelatedStatements
        `,
        { id },
      );

      if (!result.records || result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const statement = record.get('s').properties;

      [
        'inclusionPositiveVotes',
        'inclusionNegativeVotes',
        'inclusionNetVotes',
        'contentPositiveVotes',
        'contentNegativeVotes',
        'contentNetVotes',
      ].forEach((prop) => {
        if (statement[prop] !== undefined) {
          statement[prop] = this.toNumber(statement[prop]);
        }
      });

      statement.discussionId = record.get('discussionId');
      statement.keywords = (record.get('keywords') || []).filter(
        (kw) => kw && kw.word,
      );
      statement.categories = (record.get('categories') || []).filter(
        (cat) => cat && cat.id,
      );
      statement.relatedStatements = record.get('relatedStatements') || [];
      statement.directlyRelatedStatements =
        record.get('directlyRelatedStatements') || [];

      return statement;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('retrieve statement', error);
    }
  }

  async updateStatement(
    id: string,
    updateData: {
      statement?: string;
      publicCredit?: boolean;
      discussionId?: string;
      keywords?: KeywordWithFrequency[];
      categoryIds?: string[];
    },
  ) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      if (
        (updateData.keywords && updateData.keywords.length > 0) ||
        (updateData.categoryIds && updateData.categoryIds.length > 0)
      ) {
        let query = `
        MATCH (s:StatementNode {id: $id})
        SET s += $updateProperties, s.updatedAt = datetime()
        `;

        if (updateData.categoryIds && updateData.categoryIds.length > 0) {
          if (updateData.categoryIds.length > 3) {
            throw new BadRequestException(
              'Statement can have maximum 3 categories',
            );
          }

          query += `
          WITH s
          OPTIONAL MATCH (s)-[catRel:CATEGORIZED_AS]->()
          DELETE catRel
          WITH s, $categoryIds as categoryIds
          UNWIND categoryIds as categoryId
          MATCH (cat:CategoryNode {id: categoryId})
          WHERE cat.inclusionNetVotes > 0
          CREATE (s)-[:CATEGORIZED_AS]->(cat)
          WITH s, collect(cat) as validCategories, categoryIds
          WHERE size(validCategories) = size(categoryIds) OR size(categoryIds) = 0
          `;
        }

        if (updateData.keywords && updateData.keywords.length > 0) {
          query += `
          WITH s
          OPTIONAL MATCH (s)-[tagRel:TAGGED]->()
          OPTIONAL MATCH (s)-[sharedRel:SHARED_TAG]->()
          DELETE tagRel, sharedRel
          WITH s
          UNWIND $keywords as keyword
          MATCH (w:WordNode {word: keyword.word})
          CREATE (s)-[:TAGGED {
            frequency: keyword.frequency,
            source: keyword.source
          }]->(w)
          WITH s, w, keyword
          OPTIONAL MATCH (o:StatementNode)-[t:TAGGED]->(w)
          WHERE o.id <> s.id
          FOREACH (dummy IN CASE WHEN o IS NOT NULL THEN [1] ELSE [] END |
            MERGE (s)-[st:SHARED_TAG {word: w.word}]->(o)
            ON CREATE SET st.strength = keyword.frequency * t.frequency
            ON MATCH SET st.strength = st.strength + (keyword.frequency * t.frequency)
          )
          `;
        }

        query += ` RETURN s`;

        const result = await this.neo4jService.write(query, {
          id,
          updateProperties: {
            statement: updateData.statement,
            publicCredit: updateData.publicCredit,
            discussionId: updateData.discussionId,
          },
          categoryIds: updateData.categoryIds || [],
          keywords: updateData.keywords || [],
        });

        if (!result.records || result.records.length === 0) {
          throw new NotFoundException(`Statement with ID ${id} not found`);
        }

        return result.records[0].get('s').properties;
      } else {
        const result = await this.update(id, updateData);
        if (!result) {
          throw new NotFoundException(`Statement with ID ${id} not found`);
        }
        return result;
      }
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

      throw this.standardError('update statement', error);
    }
  }

  async deleteStatement(id: string) {
    try {
      if (!id || id.trim() === '') {
        throw new BadRequestException('Statement ID cannot be empty');
      }

      const statement = await this.findById(id);
      if (!statement) {
        throw new NotFoundException(`Statement with ID ${id} not found`);
      }

      return await this.delete(id);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw this.standardError('delete statement', error);
    }
  }

  async createDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<{ success: boolean }> {
    if (statementId1 === statementId2) {
      throw new Error(
        'Cannot create a relationship between a statement and itself',
      );
    }

    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $statementId1})
        MATCH (s2:StatementNode {id: $statementId2})
        MERGE (s1)-[r:RELATED_TO]->(s2)
        ON CREATE SET r.createdAt = datetime()
        `,
        { statementId1, statementId2 },
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  async removeDirectRelationship(
    statementId1: string,
    statementId2: string,
  ): Promise<{ success: boolean }> {
    try {
      await this.neo4jService.write(
        `
        MATCH (s1:StatementNode {id: $statementId1})-[r:RELATED_TO]-(s2:StatementNode {id: $statementId2})
        DELETE r
        `,
        { statementId1, statementId2 },
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  async getDirectlyRelatedStatements(statementId: string) {
    if (!statementId || statementId.trim() === '') {
      throw new BadRequestException('Statement ID cannot be empty');
    }

    try {
      const result = await this.neo4jService.read(
        `
        MATCH (s:StatementNode {id: $statementId})-[:RELATED_TO]-(related:StatementNode)
        RETURN related
        ORDER BY related.inclusionNetVotes DESC, related.contentNetVotes DESC
        `,
        { statementId },
      );

      return result.records.map((record) => record.get('related').properties);
    } catch (error) {
      throw this.standardError('get directly related statements', error);
    }
  }

  async getStatementNetwork(
    limit: number = 20,
    offset: number = 0,
    keywords?: string[],
    categories?: string[],
    userId?: string,
  ) {
    try {
      let whereClause = 'WHERE s.inclusionNetVotes >= -5';
      const params: any = { limit, offset };

      if (keywords && keywords.length > 0) {
        whereClause += ` AND EXISTS {
          MATCH (s)-[:TAGGED]->(w:WordNode)
          WHERE w.word IN $keywords
        }`;
        params.keywords = keywords;
      }

      if (categories && categories.length > 0) {
        whereClause += ` AND EXISTS {
          MATCH (s)-[:CATEGORIZED_AS]->(c:CategoryNode)
          WHERE c.id IN $categories
        }`;
        params.categories = categories;
      }

      if (userId) {
        whereClause += ` AND s.createdBy = $userId`;
        params.userId = userId;
      }

      const query = `
        MATCH (s:StatementNode)
        ${whereClause}
        
        OPTIONAL MATCH (s)-[shared:SHARED_TAG]->(related:StatementNode)
        WHERE related.inclusionNetVotes >= -5
        OPTIONAL MATCH (s)-[:RELATED_TO]-(direct:StatementNode)
        WHERE direct.inclusionNetVotes >= -5
        OPTIONAL MATCH (s)-[tagged:TAGGED]->(keyword:WordNode)
        OPTIONAL MATCH (s)-[:CATEGORIZED_AS]->(category:CategoryNode)
        
        RETURN s {
          .*,
          keywords: collect(DISTINCT {
            word: keyword.word,
            frequency: tagged.frequency,
            source: tagged.source
          }),
          categories: collect(DISTINCT {
            id: category.id,
            name: category.name
          }),
          relatedStatements: collect(DISTINCT {
            nodeId: related.id,
            statement: related.statement,
            sharedWord: shared.word,
            strength: shared.strength
          }),
          directlyRelatedStatements: CASE 
            WHEN direct IS NOT NULL THEN 
              collect(DISTINCT {
                nodeId: direct.id,
                statement: direct.statement
              })
            ELSE []
          END
        } as statement
        
        ORDER BY s.inclusionNetVotes DESC, s.contentNetVotes DESC, s.createdAt DESC
        SKIP $offset
        LIMIT $limit
      `;

      const result = await this.neo4jService.read(query, params);

      const statements = result.records.map((record) => {
        const statement = record.get('statement');

        if (
          statement.directlyRelatedStatements &&
          statement.directlyRelatedStatements.length > 0
        ) {
          if (!statement.relatedStatements) statement.relatedStatements = [];

          statement.directlyRelatedStatements.forEach((direct) => {
            const exists = statement.relatedStatements.some(
              (rel) => rel.nodeId === direct.nodeId,
            );
            if (!exists) {
              statement.relatedStatements.push({
                ...direct,
                sharedWord: 'direct',
                strength: 1.0,
              });
            }
          });
        }

        delete statement.directlyRelatedStatements;
        return statement;
      });

      statements.forEach((statement) => {
        [
          'inclusionPositiveVotes',
          'inclusionNegativeVotes',
          'inclusionNetVotes',
          'contentPositiveVotes',
          'contentNegativeVotes',
          'contentNetVotes',
        ].forEach((prop) => {
          if (statement[prop] !== undefined) {
            statement[prop] = this.toNumber(statement[prop]);
          }
        });
      });

      return statements;
    } catch (error) {
      throw this.standardError('retrieve statement network', error);
    }
  }

  async checkStatements(): Promise<{ count: number }> {
    try {
      const result = await this.neo4jService.read(
        'MATCH (s:StatementNode) RETURN count(s) as count',
        {},
      );

      const count = this.toNumber(result.records[0].get('count'));
      return { count };
    } catch (error) {
      throw this.standardError('check statements', error);
    }
  }
}
