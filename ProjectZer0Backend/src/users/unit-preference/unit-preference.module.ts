// ProjectZer0Backend/src/users/unit-preference/unit-preference.module.ts

import { Module, Logger } from '@nestjs/common';
import { UnitPreferenceController } from './unit-preference.controller';
import { UnitPreferenceService } from './unit-preference.service';
import { UnitPreferenceSchema } from '../../neo4j/schemas/unitPreference.schema';
import { Neo4jModule } from '../../neo4j/neo4j.module';

@Module({
  imports: [Neo4jModule],
  controllers: [UnitPreferenceController],
  providers: [UnitPreferenceService, UnitPreferenceSchema, Logger],
  exports: [UnitPreferenceService],
})
export class UnitModule {}
