// src/debug/debug.controller.ts

import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
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
        stack: error.stack,
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
        stack: error.stack,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('visibility-test')
  async testVisibilityPreference(
    @Body() data: { userId: string; nodeId: string; isVisible: boolean },
  ) {
    try {
      this.logger.log(`Testing visibility preference: ${JSON.stringify(data)}`);

      // Test 1: Ensure user exists
      const userResult = await this.neo4jService.write(
        `
          MERGE (u:User {sub: $userId})
          RETURN u
        `,
        { userId: data.userId },
      );

      // Test 2: Try to directly create the VisibilityPreferencesNode
      const safeNodeId = data.nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
      const prefJson = JSON.stringify({
        isVisible: data.isVisible,
        source: 'test',
        timestamp: Date.now(),
      });

      const result = await this.neo4jService.write(
        `
          MATCH (u:User {sub: $userId})
          MERGE (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
          WITH u, vp
          SET vp.${safeNodeId} = $prefJson
          RETURN vp
        `,
        {
          userId: data.userId,
          prefJson,
        },
      );

      return {
        status: 'success',
        userFound: userResult.records.length > 0,
        preferenceSet: result.records.length > 0,
        preferenceNode: result.records[0]?.get('vp')?.properties || null,
      };
    } catch (error) {
      this.logger.error(
        `Visibility test failed: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        message: `Visibility test failed: ${error.message}`,
        detailedMessage: error.toString(),
        stack: error.stack,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('visibility-read')
  async readVisibilityPreferences() {
    try {
      // List all VisibilityPreferencesNodes
      const result = await this.neo4jService.read(`
          MATCH (u:User)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
          RETURN u.sub as userId, vp
          LIMIT 5
        `);

      return {
        status: 'success',
        count: result.records.length,
        preferences: result.records.map((record) => ({
          userId: record.get('userId'),
          preferences: record.get('vp').properties,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Visibility read test failed: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        message: `Visibility read test failed: ${error.message}`,
        stack: error.stack,
      };
    }
  }
}
