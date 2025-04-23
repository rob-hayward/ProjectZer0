// src/units/unit.module.ts
import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';

@Module({
  providers: [UnitService],
  controllers: [UnitController],
  exports: [UnitService],
})
export class UnitModule {}
