import { Module } from '@nestjs/common';
import { BeliefController } from './belief.controller';
import { BeliefService } from './belief.service';
import { BeliefSchema } from '../../neo4j/schemas/belief.schema';

@Module({
  controllers: [BeliefController],
  providers: [BeliefService, BeliefSchema],
  exports: [BeliefService],
})
export class BeliefModule {}
