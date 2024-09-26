// src/neo4j/neo4j.module.ts

import { Module, DynamicModule } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';
import { Neo4jInitService } from './neo4j-init.service';
import { NEO4J_OPTIONS, NEO4J_DRIVER } from './neo4j.constants';
import { createDriver } from './neo4j.utils';

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
              const driver = await createDriver(config);
              return driver;
            } catch (error) {
              throw error;
            }
          },
          inject: [NEO4J_OPTIONS],
        },
        Neo4jService,
        Neo4jInitService,
      ],
      exports: [Neo4jService],
      global: true,
    };
  }
}
