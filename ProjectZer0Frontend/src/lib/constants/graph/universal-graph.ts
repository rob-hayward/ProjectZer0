// ProjectZer0Frontend/src/lib/constants/graph/universal-graph.ts
// PHASE 2.6: Single-node rendering for guaranteed vote ordering

export const BATCH_RENDERING = {
  MAX_BATCHES: 4,           // For batch mode
  BATCH_SIZE: 10,           // For batch mode
  DELAY_BETWEEN_BATCHES: 500, // For batch mode
  ENABLE_SEQUENTIAL: true,  // Sequential mode enabled
  
  // PHASE 2.6: TOGGLE BETWEEN MODES - Change this to switch modes
  ENABLE_SINGLE_NODE_MODE: true,  // 🔄 SET TO true FOR SINGLE-NODE, false FOR BATCH
  
  // PHASE 2.6: Single-node rendering configuration
  SINGLE_NODE_MODE: {
    BASE_DISTANCE: 250,     // Starting distance from center for first node
    DISTANCE_INCREMENT: 40, // Distance increase per vote rank (guaranteed ordering)
    NODE_DELAY: 150,        // Delay between individual nodes (ms)
    QUICK_SETTLE_TIME: 200, // Fast settling time per node
    MAX_NODES: 40,          // Maximum nodes to render
    USE_GOLDEN_ANGLE: true, // Use golden angle for natural distribution
  },
  
  // PHASE 2.6: Optimized force configuration for single-node mode
  SINGLE_NODE_FORCES: {
    COLLISION: {
      BUFFER: 50,           // Moderate collision buffer
      STRENGTH: 0.7,        // Good collision prevention
      ITERATIONS: 2,        // Fewer iterations for performance
    },
    REPULSION: {
      STRENGTH: -150,       // Light repulsion (less needed with good spacing)
      DISTANCE_MIN: 30,     // Standard distance
      DISTANCE_MAX: 600,    // Shorter range for performance
      THETA: 0.9,           // Favor performance
    },
    CENTER_ATTRACTION: {
      STRENGTH: 0.01,       // Very weak center attraction
    },
    LINK: {
      STRENGTH: 0.03,       // Very weak link forces
      DISTANCE: 120,        // Standard link distance
    }
  },

  // PHASE 2.6: Fast simulation for single-node rendering
  SINGLE_NODE_SIMULATION: {
    VELOCITY_DECAY: 0.5,    // Higher decay = faster settling per node
    ALPHA_DECAY: 0.15,      // Much faster cooling
    ALPHA_MIN: 0.02,        // Higher minimum = stops simulation sooner
    INITIAL_ALPHA: 0.3,     // Lower starting energy = faster settling
    TARGET_ALPHA: 0,        // Target complete stillness
  },

  // PHASE 2.6: Performance comparison (for reference)
  PERFORMANCE_COMPARISON: {
    BATCH_MODE: {
      TOTAL_TIME: '~3000ms',
      DESCRIPTION: '4 batches × 500ms + settling time',
      VOTE_ORDERING: 'Good (with path-blocking prevention)',
      DOM_UPDATES: '4 updates',
      SIMULATION_RESTARTS: '4 restarts'
    },
    SINGLE_NODE_MODE: {
      TOTAL_TIME: '~6000ms', 
      DESCRIPTION: '40 nodes × 150ms + quick settling per node',
      VOTE_ORDERING: 'Perfect (mathematically guaranteed)',
      DOM_UPDATES: '40 updates',
      SIMULATION_RESTARTS: '40 restarts (but lightweight)'
    }
  }
} satisfies {
  MAX_BATCHES: number;
  BATCH_SIZE: number;
  DELAY_BETWEEN_BATCHES: number;
  ENABLE_SEQUENTIAL: boolean;
  ENABLE_SINGLE_NODE_MODE: boolean;
  SINGLE_NODE_MODE: {
    BASE_DISTANCE: number;
    DISTANCE_INCREMENT: number;
    NODE_DELAY: number;
    QUICK_SETTLE_TIME: number;
    MAX_NODES: number;
    USE_GOLDEN_ANGLE: boolean;
  };
  SINGLE_NODE_FORCES: {
    COLLISION: {
      BUFFER: number;
      STRENGTH: number;
      ITERATIONS: number;
    };
    REPULSION: {
      STRENGTH: number;
      DISTANCE_MIN: number;
      DISTANCE_MAX: number;
      THETA: number;
    };
    CENTER_ATTRACTION: {
      STRENGTH: number;
    };
    LINK: {
      STRENGTH: number;
      DISTANCE: number;
    };
  };
  SINGLE_NODE_SIMULATION: {
    VELOCITY_DECAY: number;
    ALPHA_DECAY: number;
    ALPHA_MIN: number;
    INITIAL_ALPHA: number;
    TARGET_ALPHA: number;
  };
  PERFORMANCE_COMPARISON: {
    BATCH_MODE: {
      TOTAL_TIME: string;
      DESCRIPTION: string;
      VOTE_ORDERING: string;
      DOM_UPDATES: string;
      SIMULATION_RESTARTS: string;
    };
    SINGLE_NODE_MODE: {
      TOTAL_TIME: string;
      DESCRIPTION: string;
      VOTE_ORDERING: string;
      DOM_UPDATES: string;
      SIMULATION_RESTARTS: string;
    };
  };
};