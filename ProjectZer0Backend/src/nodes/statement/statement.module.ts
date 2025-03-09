import { Module } from '@nestjs/common';
import { StatementController } from './statement.controller';
import { StatementService } from './statement.service';
import { StatementSchema } from '../../neo4j/schemas/statement.schema';
import { KeywordExtractionModule } from '../../services/keyword-extraction/keyword-extraction.module';

@Module({
  imports: [KeywordExtractionModule],
  controllers: [StatementController],
  providers: [StatementService, StatementSchema],
  exports: [StatementService],
})
export class StatementModule {}
