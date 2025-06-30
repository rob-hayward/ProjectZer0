// ProjectZer0Frontend/src/lib/constants/graph/universal-graph.ts

export const BATCH_RENDERING = {
  MAX_BATCHES: 2,           // default
  BATCH_SIZE: 10,
  DELAY_BETWEEN_BATCHES: 500,
  ENABLE_SEQUENTIAL: true,
} satisfies {
  MAX_BATCHES: number|null;
  BATCH_SIZE: number;
  DELAY_BETWEEN_BATCHES: number;
  ENABLE_SEQUENTIAL: boolean;
};
