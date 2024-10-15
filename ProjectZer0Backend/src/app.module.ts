import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Neo4jModule } from './neo4j/neo4j.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { NodesModule } from './nodes/nodes.module';
import { WordSchema } from './neo4j/schemas/word.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    Neo4jModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('NEO4J_URI'),
        username: configService.get('NEO4J_USERNAME'),
        password: configService.get('NEO4J_PASSWORD'),
      }),
    }),
    UsersModule,
    AuthModule,
    NodesModule,
  ],
  controllers: [AppController],
  providers: [AppService, WordSchema],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly wordSchema: WordSchema) {}

  async onModuleInit() {
    await this.wordSchema.initializeConstraints();
  }
}
