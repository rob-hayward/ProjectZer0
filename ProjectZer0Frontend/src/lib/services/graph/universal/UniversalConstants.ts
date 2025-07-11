// src/lib/services/graph/universal/UniversalConstants.ts
// All tunable constants for the Universal Graph layout

export const UNIVERSAL_LAYOUT = {
    // Node positioning constants
    POSITIONING: {
        BASE_DISTANCE: 250,              // Starting distance from center for first node
        DISTANCE_INCREMENT: 40,          // Distance increase per vote rank
        GOLDEN_ANGLE: Math.PI * (3 - Math.sqrt(5)), // Golden angle for spiral
        ANGLE_JITTER: 0.3,              // Random variation in angle (radians)
        
        // Vote-based distance calculation
        VOTE_DISTANCE_MULTIPLIER: 20,   // How much each vote affects distance
        INDEX_DISTANCE_MULTIPLIER: 30,  // How much node index affects distance
        BASE_BATCH_DISTANCE: 300,       // Base distance for batch positioning
    },
    
    // Rendering timing constants
    TIMING: {
        NODE_RENDER_DELAY: 50,          // Delay between rendering individual nodes (ms)
        BATCH_RENDER_DELAY: 500,        // Delay between rendering batches (ms)
        SETTLEMENT_START_DELAY: 300,    // Delay before starting settlement phase (ms)
        DOM_UPDATE_THROTTLE: 16,        // Minimum time between DOM updates (ms)
    },
    
    // Rendering limits
    LIMITS: {
        MAX_NODES_TO_RENDER: 40,        // Maximum nodes in single-node mode
        NODES_PER_BATCH: 10,            // Nodes per batch in batch mode
        MAX_BATCHES: 4,                 // Maximum number of batches
        LINK_PATH_CACHE_SIZE: 500,      // Maximum cached link paths
    },
    
    // Node sizing
    NODE_SIZING: {
        HIDDEN_NODE_RADIUS: 50,         // Radius for hidden nodes (diameter/2)
        COLLISION_PADDING: {
            DROP_PHASE: 30,             // Padding during drop phase
            SETTLEMENT_PHASE: 60,       // Padding during settlement phase
        },
        RADIUS_SCALE: 0.95,             // Scale factor for link connection points
    },
    
    // Settlement tracking
    SETTLEMENT: {
        TICK_LOG_INTERVAL: 20,          // Log every N ticks during settlement
        DETAILED_LOG_INTERVAL: 100,     // Detailed log every N ticks
        STUCK_VELOCITY_THRESHOLD: 0.5,  // Velocity below this = "stuck"
        MIN_MOVEMENT_THRESHOLD: 0.5,    // Average movement to consider settled
        MAX_SETTLEMENT_TICKS: 200,      // Maximum ticks before forcing settlement end
        KICK_INTERVAL: 50,              // Check for stuck nodes every N ticks
        STUCK_RATIO_THRESHOLD: 0.8,     // If this ratio of nodes are stuck, might be settled
    },
} as const;

// Type for the constants
export type UniversalLayoutConstants = typeof UNIVERSAL_LAYOUT;