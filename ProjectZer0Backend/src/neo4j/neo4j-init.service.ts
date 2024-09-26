import { Injectable, OnModuleInit } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';

@Injectable()
export class Neo4jInitService implements OnModuleInit {
  constructor(private readonly neo4jService: Neo4jService) {}

  async onModuleInit() {
    try {
      await this.initializeDatabase();
    } catch (error) {
      console.error('Failed to initialize Neo4j database:', error);
      throw error;
    }
  }

  private async initializeDatabase() {
    // Check connection
    const result = await this.neo4jService.read('RETURN 1 as test');
    console.log(
      'Neo4j database connection successful:',
      result.records[0].get('test'),
    );

    // You can add other initialization logic here if needed

    console.log('Neo4j database initialized successfully');
  }
}
