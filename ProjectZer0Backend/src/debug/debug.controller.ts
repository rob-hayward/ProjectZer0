// src/debug/debug.controller.ts

import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Neo4jService } from '../neo4j/neo4j.service';

@Controller('debug')
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  @Get()
  getDebugInfo() {
    return { message: 'Debug endpoint active' };
  }

  @Get('neo4j-test')
  async testNeo4jConnection() {
    try {
      const result = await this.neo4jService.read('RETURN 1 as test');
      return {
        status: 'success',
        message: 'Neo4j connection successful',
        result: result.records[0].get('test'),
      };
    } catch (error) {
      this.logger.error(
        `Neo4j connection test failed: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        message: `Neo4j connection failed: ${error.message}`,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-test')
  async testUserNodes() {
    try {
      // List all User nodes
      const result = await this.neo4jService.read(`
        MATCH (u:User)
        RETURN u.sub as userId
        LIMIT 10
      `);

      return {
        status: 'success',
        userCount: result.records.length,
        users: result.records.map((record) => record.get('userId')),
      };
    } catch (error) {
      this.logger.error(`User test failed: ${error.message}`, error.stack);
      return {
        status: 'error',
        message: `User test failed: ${error.message}`,
      };
    }
  }
}
