import { Module, DynamicModule, Global } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';
import { Neo4jInitService } from './neo4j-init.service';
import { NEO4J_OPTIONS, NEO4J_DRIVER } from './neo4j.constants';
import { createDriver } from './neo4j.utils';
import { Logger } from '@nestjs/common';

const logger = new Logger('Neo4jModule');

@Global()
@Module({})
export class Neo4jModule {
  static forRootAsync(options): DynamicModule {
    return {
      module: Neo4jModule,
      providers: [
        {
          provide: NEO4J_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: NEO4J_DRIVER,
          useFactory: async (config) => {
            try {
              logger.log('Initializing Neo4j driver');
              const driver = await createDriver(config);
              return driver;
            } catch (error) {
              logger.error(
                `Failed to create Neo4j driver: ${error.message}`,
                error.stack,
              );
              throw error;
            }
          },
          inject: [NEO4J_OPTIONS],
        },
        Neo4jService,
        Neo4jInitService,
      ],
      exports: [Neo4jService],
    };
  }
}
