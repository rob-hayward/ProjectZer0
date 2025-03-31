// src/users/dto/visibility-preference.dto.ts

/**
 * Data Transfer Object for setting visibility preferences
 */
export class VisibilityPreferenceDto {
  nodeId: string;
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
