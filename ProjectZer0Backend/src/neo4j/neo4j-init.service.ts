import { Injectable, OnModuleInit } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';

@Injectable()
export class Neo4jInitService implements OnModuleInit {
  constructor(private readonly neo4jService: Neo4jService) {}

  async onModuleInit() {
    await this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // Create index on User(sub)
      await this.neo4jService.run('CREATE INDEX ON :User(sub) IF NOT EXISTS');

      // Add any other initialization queries here

      console.log('Neo4j database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Neo4j database:', error);
      // Depending on your error handling strategy, you might want to throw the error
      // throw error;
    }
  }
}
