// ProjectZer0Frontend/src/lib/constants/graph/universal-graph.ts
// PHASE 2.7: D3-Native Implementation with forceRadial
// UPDATED: Adjusted positioning distances for smaller control node

export const BATCH_RENDERING = {
  MAX_BATCHES: 4,           // For batch mode
  BATCH_SIZE: 10,           // For batch mode
  DELAY_BETWEEN_BATCHES: 500, // For batch mode
  ENABLE_SEQUENTIAL: true,  // Sequential mode enabled
  
  // PHASE 2.7: D3-Native Implementation Toggle
  ENABLE_SINGLE_NODE_MODE: true,  // Single-node sequential with D3 settlement
  
  // PHASE 2.7: Single-node rendering configuration with D3 settlement
  SINGLE_NODE_MODE: {
    BASE_DISTANCE: 120,     // UPDATED: Starting distance from center for first node (was 250)
                            // Reduced to account for smaller control node (50 radius)
                            // Creates ~70 unit gap from control node edge
    DISTANCE_INCREMENT: 30, // UPDATED: Distance increase per vote rank (was 40)
                            // Slightly tighter spiral for better density
    NODE_DELAY: 50,         // Delay between individual nodes (ms)
    QUICK_SETTLE_TIME: 200, // Fast settling time per node
    MAX_NODES: 40,          // Maximum nodes to render
    USE_GOLDEN_ANGLE: true, // Use golden angle for natural distribution
    
    // NEW: Settlement phase configuration
    SETTLEMENT_DELAY: 300,  // Delay before starting settlement phase (ms)
    SETTLEMENT_ALPHA: 0.6,  // Initial alpha for settlement phase
    SETTLEMENT_DECAY: 0.02, // Alpha decay during settlement
    SETTLEMENT_MIN: 0.005,  // Minimum alpha before stopping
  },
  
  // PHASE 2.7: D3-Native force configuration
  D3_NATIVE_FORCES: {
    // Drop phase forces (minimal, nodes are pinned)
    DROP_PHASE: {
      CHARGE: {
        STRENGTH: -50,      // Very weak during drops
        DISTANCE_MAX: 200,  // Limited range
        THETA: 0.9          // Barnes-Hut approximation
      },
      COLLISION: {
        RADIUS_PADDING: 20, // Minimal padding
        STRENGTH: 0.5,      // Weak collision
        ITERATIONS: 1       // Single iteration for performance
      },
      LINK: {
        STRENGTH: 0.01,     // Very weak links
        DISTANCE: 150       // Standard distance
      }
    },
    
    // Settlement phase forces (D3-native)
    SETTLEMENT_PHASE: {
      RADIAL: {
        STRENGTH: 0.9,      // Strong to maintain vote order
        // Radius is dynamic based on vote rank
      },
      CHARGE: {
        STRENGTH: -300,     // Moderate repulsion for spacing
        DISTANCE_MIN: 50,   // Minimum effect distance
        DISTANCE_MAX: 600,  // Maximum effect distance
        THETA: 0.9,         // Barnes-Hut for performance
        DECAY_ALPHA: 0.3,   // When to start reducing strength
      },
      COLLISION: {
        RADIUS_PADDING: 35, // Good spacing between nodes
        STRENGTH: 0.8,      // Strong collision avoidance
        ITERATIONS: 2,      // Balance accuracy/performance
        DISABLE_ALPHA: 0.02 // Disable when alpha < this
      },
      LINK: {
        STRENGTH: 0.05,     // Weak to not interfere with radial
        // Distance is dynamic based on node distances
      }
    }
  },

  // PHASE 2.7: Simulation configuration for D3-native approach
  D3_SIMULATION: {
    VELOCITY_DECAY: 0.65,   // Higher = faster settling
    ALPHA_DECAY: 0.03,      // Moderate cooling rate
    ALPHA_MIN: 0.01,        // Stop sooner for performance
    INITIAL_ALPHA: 1.0,     // Full energy for standard mode
    SETTLEMENT_ALPHA: 0.6,  // Moderate energy for settlement
  },

  // PHASE 2.7: Performance optimizations
  PERFORMANCE: {
    MAX_TICKS_PER_FRAME: 5,   // Batch simulation ticks
    LINK_PATH_CACHE_SIZE: 500, // Maximum cached link paths
    NODE_RADIUS_CACHE: true,   // Enable radius caching
    BARNES_HUT_THETA: 0.9,     // Approximation threshold
    DISABLE_COLLISION_ALPHA: 0.02, // When to disable collision
    CHARGE_STRENGTH_DECAY: true,   // Reduce charge over time
  },

  // PHASE 2.7: Initial positioning
  POSITIONING: {
    USE_FIBONACCI_SPIRAL: true,  // Better than golden angle alone
    ANGLE_JITTER: 0.15,         // Random variation (radians)
    FIBONACCI_ANGLE: 2.39996,   // Golden angle in radians
  },

  // PHASE 2.7: Performance comparison
  PERFORMANCE_COMPARISON: {
    CUSTOM_FORCES: {
      DESCRIPTION: 'Custom angular spreading and constraints',
      COMPLEXITY: 'O(n²) for angular force',
      PERFORMANCE: 'Poor at 1000+ nodes',
      VOTE_ORDERING: 'Perfect',
      NATURAL_SPACING: 'Good'
    },
    D3_NATIVE: {
      DESCRIPTION: 'D3 forceRadial + forceManyBody + forceCollide',
      COMPLEXITY: 'O(n log n) with Barnes-Hut',
      PERFORMANCE: 'Excellent at 1000+ nodes',
      VOTE_ORDERING: 'Perfect (via forceRadial)',
      NATURAL_SPACING: 'Excellent'
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
    SETTLEMENT_DELAY: number;
    SETTLEMENT_ALPHA: number;
    SETTLEMENT_DECAY: number;
    SETTLEMENT_MIN: number;
  };
  D3_NATIVE_FORCES: {
    DROP_PHASE: {
      CHARGE: {
        STRENGTH: number;
        DISTANCE_MAX: number;
        THETA: number;
      };
      COLLISION: {
        RADIUS_PADDING: number;
        STRENGTH: number;
        ITERATIONS: number;
      };
      LINK: {
        STRENGTH: number;
        DISTANCE: number;
      };
    };
    SETTLEMENT_PHASE: {
      RADIAL: {
        STRENGTH: number;
      };
      CHARGE: {
        STRENGTH: number;
        DISTANCE_MIN: number;
        DISTANCE_MAX: number;
        THETA: number;
        DECAY_ALPHA: number;
      };
      COLLISION: {
        RADIUS_PADDING: number;
        STRENGTH: number;
        ITERATIONS: number;
        DISABLE_ALPHA: number;
      };
      LINK: {
        STRENGTH: number;
      };
    };
  };
  D3_SIMULATION: {
    VELOCITY_DECAY: number;
    ALPHA_DECAY: number;
    ALPHA_MIN: number;
    INITIAL_ALPHA: number;
    SETTLEMENT_ALPHA: number;
  };
  PERFORMANCE: {
    MAX_TICKS_PER_FRAME: number;
    LINK_PATH_CACHE_SIZE: number;
    NODE_RADIUS_CACHE: boolean;
    BARNES_HUT_THETA: number;
    DISABLE_COLLISION_ALPHA: number;
    CHARGE_STRENGTH_DECAY: boolean;
  };
  POSITIONING: {
    USE_FIBONACCI_SPIRAL: boolean;
    ANGLE_JITTER: number;
    FIBONACCI_ANGLE: number;
  };
  PERFORMANCE_COMPARISON: {
    CUSTOM_FORCES: {
      DESCRIPTION: string;
      COMPLEXITY: string;
      PERFORMANCE: string;
      VOTE_ORDERING: string;
      NATURAL_SPACING: string;
    };
    D3_NATIVE: {
      DESCRIPTION: string;
      COMPLEXITY: string;
      PERFORMANCE: string;
      VOTE_ORDERING: string;
      NATURAL_SPACING: string;
    };
  };
};