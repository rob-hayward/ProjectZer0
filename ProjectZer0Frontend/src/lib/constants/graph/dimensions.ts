// src/lib/constants/graph/dimensions.ts
export const DIMENSIONS = {
    WIDTH: 12000 as const,
    HEIGHT: 12000 as const
} as const;

// Type helper
export type GraphDimensions = typeof DIMENSIONS;