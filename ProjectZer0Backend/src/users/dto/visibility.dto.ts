// src/users/dto/visibility.dto.ts

import { IsString, IsBoolean, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for setting visibility preferences
 */
export class VisibilityPreferenceDto {
  @IsString()
  @IsNotEmpty()
  nodeId: string;

  @IsBoolean()
  isVisible: boolean;
}

/**
 * Response model for visibility preference operations
 */
export class VisibilityPreferenceResponseDto {
  success: boolean;
  preference: {
    isVisible: boolean;
    nodeId: string;
    source: 'user' | 'community';
    timestamp: number;
  };
  message?: string;
}

/**
 * Model for user visibility preferences
 */
export interface VisibilityPreference {
  isVisible: boolean;
  source: 'user' | 'community';
  timestamp: number;
}
