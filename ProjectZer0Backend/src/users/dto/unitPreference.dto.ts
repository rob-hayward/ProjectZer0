// src/users/dto/unitPreference.dto.ts

import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UnitPreference {
  @IsString()
  unitId: string;

  @IsNumber()
  @IsOptional()
  lastUpdated?: number;
}

export class SetUnitPreferenceDto {
  @IsString()
  nodeId: string;

  @IsString()
  unitId: string;
}
