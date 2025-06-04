// src/neo4j/neo4j-init.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';

@Injectable()
export class Neo4jInitService implements OnModuleInit {
  private readonly logger = new Logger(Neo4jInitService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing Neo4j database...');
      await this.initializeDatabase();
      this.logger.log('Neo4j database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Neo4j database:', error);
      throw error;
    }
  }

  private async initializeDatabase() {
    // Check connection
    const result = await this.neo4jService.read('RETURN 1 as test');
    this.logger.log(
      'Neo4j database connection successful:',
      result.records[0].get('test'),
    );

    // Initialize database constraints
    await this.initializeConstraints();
  }

  private async initializeConstraints() {
    this.logger.log('Initializing Neo4j constraints');

    try {
      const constraints = [
        // Word constraints
        'CREATE CONSTRAINT word_unique IF NOT EXISTS FOR (w:WordNode) REQUIRE w.word IS UNIQUE',

        // Statement constraints
        'CREATE CONSTRAINT statement_id_unique IF NOT EXISTS FOR (s:StatementNode) REQUIRE s.id IS UNIQUE',

        // OpenQuestion constraints
        'CREATE CONSTRAINT openquestion_id_unique IF NOT EXISTS FOR (oq:OpenQuestionNode) REQUIRE oq.id IS UNIQUE',

        // Definition constraints
        'CREATE CONSTRAINT definition_id_unique IF NOT EXISTS FOR (d:DefinitionNode) REQUIRE d.id IS UNIQUE',

        // Discussion constraints
        'CREATE CONSTRAINT discussion_id_unique IF NOT EXISTS FOR (d:DiscussionNode) REQUIRE d.id IS UNIQUE',

        // Comment constraints
        'CREATE CONSTRAINT comment_id_unique IF NOT EXISTS FOR (c:CommentNode) REQUIRE c.id IS UNIQUE',

        // User constraints
        'CREATE CONSTRAINT user_sub_unique IF NOT EXISTS FOR (u:User) REQUIRE u.sub IS UNIQUE',

        // Quantity node constraints
        'CREATE CONSTRAINT quantity_node_id_unique IF NOT EXISTS FOR (q:QuantityNode) REQUIRE q.id IS UNIQUE',

        // Quantity response node constraints
        'CREATE CONSTRAINT quantity_response_id_unique IF NOT EXISTS FOR (r:QuantityResponseNode) REQUIRE r.id IS UNIQUE',
      ];

      for (const constraint of constraints) {
        await this.neo4jService.write(constraint);
        this.logger.debug(`Created constraint: ${constraint}`);
      }

      this.logger.log('All database constraints initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize constraints: ${error.message}`);
      throw error;
    }
  }
}
