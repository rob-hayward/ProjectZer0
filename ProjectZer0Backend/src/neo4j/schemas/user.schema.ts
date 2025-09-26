// src/neo4j/schemas/user.schema.ts

import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../neo4j.service';
import { UserProfile } from '../../users/user.model';

/**
 * Valid node types that users can create
 */
export type UserCreatedNodeType =
  | 'word'
  | 'definition'
  | 'statement'
  | 'answer'
  | 'openquestion'
  | 'quantity'
  | 'category'
  | 'evidence'; // Added evidence support

/**
 * Schema for User nodes and their relationships to content
 */
@Injectable()
export class UserSchema {
  constructor(private readonly neo4jService: Neo4jService) {}

  /**
   * Find a user by their sub (Auth0 ID)
   */
  async findUser(sub: string): Promise<UserProfile | null> {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $sub})
      RETURN u
      `,
      { sub },
    );
    return result.records.length > 0
      ? (result.records[0].get('u').properties as UserProfile)
      : null;
  }

  /**
   * Create a new user
   */
  async createUser(userProperties: UserProfile): Promise<UserProfile> {
    const result = await this.neo4jService.write(
      `
      CREATE (u:User $userProperties)
      SET u.createdAt = datetime(),
          u.lastLogin = datetime()
      RETURN u
      `,
      { userProperties },
    );
    return result.records[0].get('u').properties as UserProfile;
  }

  /**
   * Update user properties
   */
  async updateUser(
    sub: string,
    updates: Partial<UserProfile>,
  ): Promise<UserProfile> {
    const result = await this.neo4jService.write(
      `
      MATCH (u:User {sub: $sub})
      SET u += $updates,
          u.updated_at = datetime()
      RETURN u
      `,
      { sub, updates },
    );
    return result.records[0].get('u').properties as UserProfile;
  }

  /**
   * Track that a user created a node
   * Updated to support all node types including evidence
   */
  async addCreatedNode(
    userId: string,
    nodeId: string,
    nodeType: UserCreatedNodeType,
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MATCH (n {id: $nodeId})
      WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode OR 
            n:AnswerNode OR n:OpenQuestionNode OR n:QuantityNode OR 
            n:CategoryNode OR n:EvidenceNode
      CREATE (u)-[r:CREATED {
        createdAt: datetime(),
        type: $nodeType
      }]->(n)
      `,
      { userId, nodeId, nodeType },
    );
  }

  /**
   * Get nodes created by a user
   * Updated to support evidence nodes
   */
  async getUserCreatedNodes(userId: string, nodeType?: UserCreatedNodeType) {
    const query = nodeType
      ? `
        MATCH (u:User {sub: $userId})-[r:CREATED {type: $nodeType}]->(n)
        RETURN n, r.type as nodeType
        ORDER BY r.createdAt DESC
        `
      : `
        MATCH (u:User {sub: $userId})-[r:CREATED]->(n)
        WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode OR 
              n:AnswerNode OR n:OpenQuestionNode OR n:QuantityNode OR 
              n:CategoryNode OR n:EvidenceNode
        RETURN n, r.type as nodeType
        ORDER BY r.createdAt DESC
        `;

    const result = await this.neo4jService.read(query, { userId, nodeType });
    return result.records.map((record) => ({
      node: record.get('n').properties,
      type: nodeType || record.get('nodeType'),
    }));
  }

  /**
   * Get user activity statistics
   * Updated to include evidence nodes
   */
  async getUserActivityStats(userId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $userId})
      
      // Count nodes by type - updated to include evidence
      OPTIONAL MATCH (u)-[r:CREATED]->(n)
      WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode OR 
            n:AnswerNode OR n:OpenQuestionNode OR n:QuantityNode OR 
            n:CategoryNode OR n:EvidenceNode
      WITH u, 
           toInteger(count(CASE WHEN r.type = 'word' THEN r END)) as wordCount,
           toInteger(count(CASE WHEN r.type = 'definition' THEN r END)) as definitionCount,
           toInteger(count(CASE WHEN r.type = 'statement' THEN r END)) as statementCount,
           toInteger(count(CASE WHEN r.type = 'answer' THEN r END)) as answerCount,
           toInteger(count(CASE WHEN r.type = 'openquestion' THEN r END)) as openquestionCount,
           toInteger(count(CASE WHEN r.type = 'quantity' THEN r END)) as quantityCount,
           toInteger(count(CASE WHEN r.type = 'category' THEN r END)) as categoryCount,
           toInteger(count(CASE WHEN r.type = 'evidence' THEN r END)) as evidenceCount
      
      // Count votes - updated to include both inclusion and content votes
      OPTIONAL MATCH (u)-[v:VOTED_ON]->(target)
      WITH u, wordCount, definitionCount, statementCount, answerCount, 
           openquestionCount, quantityCount, categoryCount, evidenceCount,
           toInteger(count(v)) as voteCount
      
      // Get created node IDs by type - updated for all node types including evidence
      OPTIONAL MATCH (u)-[cr:CREATED]->(createdNodes)
      WHERE createdNodes:WordNode OR createdNodes:DefinitionNode OR createdNodes:StatementNode OR 
            createdNodes:AnswerNode OR createdNodes:OpenQuestionNode OR createdNodes:QuantityNode OR 
            createdNodes:CategoryNode OR createdNodes:EvidenceNode
      WITH u, wordCount, definitionCount, statementCount, answerCount, 
           openquestionCount, quantityCount, categoryCount, evidenceCount, voteCount,
           collect({
             id: createdNodes.id,
             type: cr.type,
             createdAt: cr.createdAt
           }) as creations
      
      RETURN {
        nodesCreated: wordCount + definitionCount + statementCount + answerCount + 
                     openquestionCount + quantityCount + categoryCount + evidenceCount,
        creationsByType: {
          word: wordCount,
          definition: definitionCount,
          statement: statementCount,
          answer: answerCount,
          openquestion: openquestionCount,
          quantity: quantityCount,
          category: categoryCount,
          evidence: evidenceCount
        },
        votesCast: voteCount,
        createdNodes: creations
      } as stats
      `,
      { userId },
    );
    return result.records[0].get('stats');
  }

  /**
   * Track user participation (voting, commenting)
   */
  async addParticipation(
    userId: string,
    nodeId: string,
    participationType: 'voted' | 'commented',
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MATCH (n {id: $nodeId})
      WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode OR 
            n:AnswerNode OR n:OpenQuestionNode OR n:QuantityNode OR 
            n:CategoryNode OR n:EvidenceNode
      MERGE (u)-[r:PARTICIPATED_IN]->(n)
      ON CREATE SET r.createdAt = datetime(), r.type = $participationType
      ON MATCH SET r.lastInteraction = datetime(), r.type = 
        CASE WHEN r.type = $participationType THEN r.type 
        ELSE 'both' END
      `,
      { userId, nodeId, participationType },
    );
  }

  /**
   * Add or update a user preference
   */
  async addUserPreference(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $userId})
      MERGE (p:UserPreference {key: $key})
      MERGE (u)-[r:HAS_PREFERENCE]->(p)
      SET p.value = $value, p.updatedAt = datetime()
      `,
      { userId, key, value },
    );
  }

  /**
   * Update user's last login timestamp
   */
  async updateUserLogin(sub: string): Promise<void> {
    await this.neo4jService.write(
      `
      MATCH (u:User {sub: $sub})
      SET u.lastLogin = datetime()
      `,
      { sub },
    );
  }

  /**
   * Get user statistics
   * Updated to include evidence nodes
   */
  async getUserStats(userId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $userId})
      
      // Count nodes created by user - updated to include evidence
      OPTIONAL MATCH (u)-[:CREATED]->(n)
      WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode OR 
            n:AnswerNode OR n:OpenQuestionNode OR n:QuantityNode OR 
            n:CategoryNode OR n:EvidenceNode
      WITH u, COUNT(n) as nodesCreated
      
      // Count user participations (votes, comments, etc.)
      OPTIONAL MATCH (u)-[:PARTICIPATED_IN]->(p)
      WITH u, nodesCreated, COUNT(p) as participations
      
      // Get actual nodes and participation targets for detailed information
      OPTIONAL MATCH (u)-[:CREATED]->(actualNode)
      WHERE actualNode:WordNode OR actualNode:DefinitionNode OR actualNode:StatementNode OR 
            actualNode:AnswerNode OR actualNode:OpenQuestionNode OR actualNode:QuantityNode OR 
            actualNode:CategoryNode OR actualNode:EvidenceNode
      WITH u, nodesCreated, participations, COLLECT(actualNode) as actualNodesCreated
      
      OPTIONAL MATCH (u)-[:PARTICIPATED_IN]->(actualParticipation)
      WITH u, nodesCreated, participations, actualNodesCreated, COLLECT(actualParticipation) as actualParticipations
      
      RETURN {
        nodesCreated: nodesCreated,
        participations: participations,
        actualNodesCreated: SIZE(actualNodesCreated),  
        actualParticipations: SIZE(actualParticipations)
      } as stats
      `,
      { userId },
    );

    return result.records[0].toObject().stats;
  }

  /**
   * Get comprehensive user creation breakdown
   * Updated to include evidence nodes
   */
  async getUserCreationBreakdown(userId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $userId})
      
      // Get detailed breakdown of all created node types including evidence
      OPTIONAL MATCH (u)-[r:CREATED]->(n)
      WHERE n:WordNode OR n:DefinitionNode OR n:StatementNode OR 
            n:AnswerNode OR n:OpenQuestionNode OR n:QuantityNode OR 
            n:CategoryNode OR n:EvidenceNode
      
      WITH u,
           collect(CASE WHEN r.type = 'word' THEN {
             id: n.id, 
             word: n.word, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes
           } END) as words,
           collect(CASE WHEN r.type = 'definition' THEN {
             id: n.id, 
             definitionText: n.definitionText, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes,
             contentNetVotes: n.contentNetVotes
           } END) as definitions,
           collect(CASE WHEN r.type = 'statement' THEN {
             id: n.id, 
             statement: n.statement, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes,
             contentNetVotes: n.contentNetVotes
           } END) as statements,
           collect(CASE WHEN r.type = 'answer' THEN {
             id: n.id, 
             answerText: n.answerText, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes,
             contentNetVotes: n.contentNetVotes
           } END) as answers,
           collect(CASE WHEN r.type = 'openquestion' THEN {
             id: n.id, 
             questionText: n.questionText, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes
           } END) as openquestions,
           collect(CASE WHEN r.type = 'quantity' THEN {
             id: n.id, 
             question: n.question, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes,
             responseCount: n.responseCount
           } END) as quantities,
           collect(CASE WHEN r.type = 'category' THEN {
             id: n.id, 
             name: n.name, 
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes
           } END) as categories,
           collect(CASE WHEN r.type = 'evidence' THEN {
             id: n.id, 
             title: n.title,
             url: n.url,
             evidenceType: n.evidenceType,
             createdAt: r.createdAt,
             inclusionNetVotes: n.inclusionNetVotes,
             overallScore: n.overallScore,
             reviewCount: n.reviewCount
           } END) as evidence
      
      RETURN {
        words: [item IN words WHERE item IS NOT NULL],
        definitions: [item IN definitions WHERE item IS NOT NULL],
        statements: [item IN statements WHERE item IS NOT NULL],
        answers: [item IN answers WHERE item IS NOT NULL],
        openquestions: [item IN openquestions WHERE item IS NOT NULL],
        quantities: [item IN quantities WHERE item IS NOT NULL],
        categories: [item IN categories WHERE item IS NOT NULL],
        evidence: [item IN evidence WHERE item IS NOT NULL]
      } as breakdown
      `,
      { userId },
    );

    return result.records[0].get('breakdown');
  }

  /**
   * Get user's peer reviews for evidence
   */
  async getUserPeerReviews(userId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (pr:PeerReviewNode {userId: $userId})
      MATCH (pr)-[:PEER_REVIEWED]->(e:EvidenceNode)
      RETURN {
        reviewId: pr.id,
        evidenceId: e.id,
        evidenceTitle: e.title,
        qualityScore: pr.qualityScore,
        independenceScore: pr.independenceScore,
        relevanceScore: pr.relevanceScore,
        comments: pr.comments,
        createdAt: pr.createdAt
      } as review
      ORDER BY pr.createdAt DESC
      `,
      { userId },
    );

    return result.records.map((record) => record.get('review'));
  }

  /**
   * Get user's quantity responses
   */
  async getUserQuantityResponses(userId: string) {
    const result = await this.neo4jService.read(
      `
      MATCH (u:User {sub: $userId})-[r:RESPONSE_TO]->(q:QuantityNode)
      RETURN {
        responseId: r.id,
        quantityId: q.id,
        question: q.question,
        value: r.value,
        unitId: r.unitId,
        normalizedValue: r.normalizedValue,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      } as response
      ORDER BY r.createdAt DESC
      `,
      { userId },
    );

    return result.records.map((record) => record.get('response'));
  }

  /**
   * Get user's voting history
   */
  async getUserVotingHistory(
    userId: string,
    options?: {
      nodeType?: string;
      voteKind?: 'INCLUSION' | 'CONTENT';
      limit?: number;
      offset?: number;
    },
  ) {
    const { nodeType, voteKind, limit = 50, offset = 0 } = options || {};

    let query = `
      MATCH (u:User {sub: $userId})-[v:VOTED_ON]->(n)
    `;

    const whereConditions = [];
    if (nodeType) {
      whereConditions.push(`labels(n) CONTAINS $nodeType`);
    }
    if (voteKind) {
      whereConditions.push(`v.kind = $voteKind`);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += `
      RETURN {
        nodeId: n.id,
        nodeType: labels(n)[0],
        voteKind: v.kind,
        voteStatus: v.status,
        votedAt: v.createdAt
      } as vote
      ORDER BY v.createdAt DESC
      SKIP $offset
      LIMIT $limit
    `;

    const result = await this.neo4jService.read(query, {
      userId,
      nodeType,
      voteKind,
      offset,
      limit,
    });

    return result.records.map((record) => record.get('vote'));
  }

  /**
   * Check if user has already created a specific type of content for a parent
   * Useful for preventing duplicate definitions, answers, evidence, etc.
   */
  async hasUserCreatedForParent(
    userId: string,
    parentId: string,
    nodeType: UserCreatedNodeType,
  ): Promise<boolean> {
    let query = '';

    switch (nodeType) {
      case 'definition':
        query = `
          MATCH (u:User {sub: $userId})-[:CREATED]->(d:DefinitionNode)
          MATCH (d)-[:DEFINES]->(w:WordNode {word: $parentId})
          RETURN COUNT(d) > 0 as exists
        `;
        break;
      case 'answer':
        query = `
          MATCH (u:User {sub: $userId})-[:CREATED]->(a:AnswerNode)
          MATCH (a)-[:ANSWERS]->(q:OpenQuestionNode {id: $parentId})
          RETURN COUNT(a) > 0 as exists
        `;
        break;
      case 'evidence':
        query = `
          MATCH (u:User {sub: $userId})-[:CREATED]->(e:EvidenceNode {parentNodeId: $parentId})
          RETURN COUNT(e) > 0 as exists
        `;
        break;
      default:
        return false;
    }

    const result = await this.neo4jService.read(query, { userId, parentId });
    return result.records[0]?.get('exists') || false;
  }
}
