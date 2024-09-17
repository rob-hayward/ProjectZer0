import { Injectable, Inject, OnApplicationShutdown } from '@nestjs/common';
import neo4j, { Driver, SessionConfig } from 'neo4j-driver';
import { NEO4J_DRIVER } from './neo4j.constants';

@Injectable()
export class Neo4jService implements OnApplicationShutdown {
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

  async onApplicationShutdown() {
    await this.driver.close();
  }
}
