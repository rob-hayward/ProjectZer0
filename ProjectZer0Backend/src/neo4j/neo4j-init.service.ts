import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';

@Injectable()
export class Neo4jInitService implements OnModuleInit {
  private readonly logger = new Logger(Neo4jInitService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async onModuleInit() {
    try {
      await this.initializeDatabase();
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

    this.logger.log('Neo4j database initialized successfully');
  }

  private async initializeConstraints() {
    this.logger.log('Initializing Neo4j constraints');

    try {
      // Word constraints
      await this.neo4jService.write(
        'CREATE CONSTRAINT word_unique IF NOT EXISTS FOR (w:WordNode) REQUIRE w.word IS UNIQUE',
      );

      // Statement constraints
      await this.neo4jService.write(
        'CREATE CONSTRAINT statement_id_unique IF NOT EXISTS FOR (s:StatementNode) REQUIRE s.id IS UNIQUE',
      );

      // Definition constraints
      await this.neo4jService.write(
        'CREATE CONSTRAINT definition_id_unique IF NOT EXISTS FOR (d:DefinitionNode) REQUIRE d.id IS UNIQUE',
      );

      // Discussion constraints
      await this.neo4jService.write(
        'CREATE CONSTRAINT discussion_id_unique IF NOT EXISTS FOR (d:DiscussionNode) REQUIRE d.id IS UNIQUE',
      );

      // Comment constraints
      await this.neo4jService.write(
        'CREATE CONSTRAINT comment_id_unique IF NOT EXISTS FOR (c:CommentNode) REQUIRE c.id IS UNIQUE',
      );

      // User constraints
      await this.neo4jService.write(
        'CREATE CONSTRAINT user_sub_unique IF NOT EXISTS FOR (u:User) REQUIRE u.sub IS UNIQUE',
      );

      this.logger.log('All database constraints initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize constraints: ${error.message}`);
      throw error;
    }
  }
}
