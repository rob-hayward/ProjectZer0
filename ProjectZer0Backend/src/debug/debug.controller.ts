// src/debug/debug.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
  Request,
} from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Post('visibility-preference-test')
  async testVisibilityPreferenceWithAuth(
    @Body() data: { nodeId: string; isVisible: boolean },
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.sub;
      this.logger.log(
        `Testing visibility preference with actual user auth - User: ${userId}, Node: ${data.nodeId}, Visible: ${data.isVisible}`,
      );
      this.logger.log(`Request user object: ${JSON.stringify(req.user)}`);

      // Basic approach using set property directly
      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)
        SET vp.test_direct = $isVisible,
            vp.test_timestamp = timestamp()
        RETURN vp
      `;

      const result = await this.neo4jService.write(query, {
        userId,
        isVisible: data.isVisible,
      });

      this.logger.log(
        `Query executed, records: ${result.records?.length || 0}`,
      );

      return {
        status: 'success',
        userId: userId,
        userFound: result.records.length > 0,
        preferenceSet: result.records.length > 0,
        preferenceNode: result.records[0]?.get('vp')?.properties || null,
      };
    } catch (error) {
      this.logger.error(
        `Visibility test with auth failed: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        userId: req.user?.sub || 'unknown',
        message: `Visibility test failed: ${error.message}`,
        detailedMessage: error.toString(),
        stack: error.stack,
      };
    }
  }

  // Add this to debug.controller.ts

  @UseGuards(JwtAuthGuard)
  @Post('property-map-test')
  async testPropertyMapAccess(
    @Body() data: { nodeId: string; value: string },
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.sub;
      this.logger.log(
        `Testing property map access with user: ${userId}, nodeId: ${data.nodeId}, value: ${data.value}`,
      );

      // Make the node ID safe by removing problematic characters
      const safeNodeId = data.nodeId.replace(/[^a-zA-Z0-9]/g, '_');
      this.logger.log(
        `Original nodeId: ${data.nodeId}, Safe nodeId: ${safeNodeId}`,
      );

      // Test using indexed property access instead of dynamic property names
      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_TEST_PROPS]->(t:TestPropsNode)
        // Initialize the map if it doesn't exist
        SET t.props = CASE WHEN t.props IS NULL THEN {} ELSE t.props END
        // Add to the map using indexed notation
        SET t.props = t.props + {$safeNodeId: $value}
        // Retrieve the map entry using indexed notation
        RETURN t.props, t.props[$safeNodeId] as value
      `;

      this.logger.log(`Query: ${query}`);
      this.logger.log(
        `Parameters: userId=${userId}, safeNodeId=${safeNodeId}, value=${data.value}`,
      );

      const result = await this.neo4jService.write(query, {
        userId,
        safeNodeId,
        value: data.value,
      });

      this.logger.log(
        `Query executed, records: ${result.records?.length || 0}`,
      );

      return {
        status: 'success',
        userId: userId,
        originalNodeId: data.nodeId,
        safeNodeId: safeNodeId,
        propsMap: result.records[0]?.get('props'),
        retrievedValue: result.records[0]?.get('value'),
      };
    } catch (error) {
      this.logger.error(
        `Property map test failed: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        userId: req.user?.sub || 'unknown',
        message: `Property map test failed: ${error.message}`,
        error: error.toString(),
        stack: error.stack,
      };
    }
  }

  // Add this to debug.controller.ts

  @UseGuards(JwtAuthGuard)
  @Post('direct-property-test')
  async testDirectProperty(
    @Body() data: { nodeId: string; value: string },
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.sub;
      this.logger.log(
        `Testing direct property access with user: ${userId}, nodeId: ${data.nodeId}, value: ${data.value}`,
      );

      // Make the node ID safe by removing problematic characters
      const safeNodeId = data.nodeId.replace(/[^a-zA-Z0-9]/g, '_');
      this.logger.log(
        `Original nodeId: ${data.nodeId}, Safe nodeId: ${safeNodeId}`,
      );

      // Use direct property with string concatenation instead of parameter substitution
      const propertyName = `test_${safeNodeId}`;
      const query = `
        MATCH (u:User {sub: $userId})
        MERGE (u)-[:HAS_TEST_PROPS]->(t:TestPropsNode)
        SET t.${propertyName} = $value
        RETURN t.${propertyName} as value
      `;

      this.logger.log(`Query: ${query}`);
      this.logger.log(`Parameters: userId=${userId}, value=${data.value}`);

      const result = await this.neo4jService.write(query, {
        userId,
        value: data.value,
      });

      this.logger.log(
        `Query executed, records: ${result.records?.length || 0}`,
      );

      return {
        status: 'success',
        userId: userId,
        originalNodeId: data.nodeId,
        safeNodeId: safeNodeId,
        propertyName: propertyName,
        retrievedValue: result.records[0]?.get('value'),
      };
    } catch (error) {
      this.logger.error(
        `Direct property test failed: ${error.message}`,
        error.stack,
      );
      return {
        status: 'error',
        userId: req.user?.sub || 'unknown',
        message: `Direct property test failed: ${error.message}`,
        error: error.toString(),
        stack: error.stack,
      };
    }
  }
}
