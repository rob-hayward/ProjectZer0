import { Module, DynamicModule } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';
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
            console.log('Neo4j connection config:', config);
            try {
              const driver = await createDriver(config);
              console.log('Neo4j driver created successfully');
              return driver;
            } catch (error) {
              console.error('Failed to create Neo4j driver:', error);
              throw error;
            }
          },
          inject: [NEO4J_OPTIONS],
        },
        Neo4jService,
      ],
      exports: [Neo4jService],
      global: true,
    };
  }
}
