import {
  Injectable,
  Inject,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import neo4j, { Driver, SessionConfig, Result } from 'neo4j-driver';
import { NEO4J_DRIVER } from './neo4j.constants';

@Injectable()
export class Neo4jService implements OnApplicationShutdown {
  private readonly logger = new Logger(Neo4jService.name);

  constructor(@Inject(NEO4J_DRIVER) private readonly driver: Driver) {}

  getReadSession(database?: string) {
    return this.driver.session(this.getSessionConfig(database, 'READ'));
  }

  getWriteSession(database?: string) {
    return this.driver.session(this.getSessionConfig(database, 'WRITE'));
  }

  private getSessionConfig(
    database?: string,
    defaultAccessMode: 'READ' | 'WRITE' = 'READ',
  ): SessionConfig {
    const config: SessionConfig = {
      defaultAccessMode: neo4j.session[defaultAccessMode],
    };
    if (database) {
      config.database = database;
    }
    return config;
  }

  async read(
    query: string,
    params?: Record<string, any>,
    database?: string,
  ): Promise<Result> {
    const session = this.getReadSession(database);
    try {
      return await session.run(query, params);
    } catch (error) {
      this.logger.error(
        `Error executing read query: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async write(
    query: string,
    params?: Record<string, any>,
    database?: string,
  ): Promise<Result> {
    const session = this.getWriteSession(database);
    try {
      return await session.run(query, params);
    } catch (error) {
      this.logger.error(
        `Error executing write query: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  async testConnection(): Promise<string> {
    try {
      const serverInfo = await this.driver.getServerInfo();
      this.logger.log('Connection successful. Server info:', serverInfo);
      const versionInfo =
        serverInfo.agent || 'Version information not available';
      return `Connection successful! Neo4j info: ${versionInfo}`;
    } catch (error) {
      this.logger.error('Neo4j connection error:', error);
      throw new Error(`Failed to connect to Neo4j: ${error.message}`);
    }
  }

  async onApplicationShutdown() {
    this.logger.log('Closing Neo4j connection...');
    await this.driver.close();
    this.logger.log('Neo4j connection closed');
  }
}
