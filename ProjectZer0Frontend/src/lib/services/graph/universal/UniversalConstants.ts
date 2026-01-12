// src/lib/services/graph/universal/UniversalConstants.ts
// All tunable constants for the Universal Graph layout
// ULTRA-CLOSE: 3 nodes in first ring, very close to control node

export const UNIVERSAL_LAYOUT = {
    // Node positioning constants
    POSITIONING: {
        // Base distance from center for first ring
        BASE_DISTANCE: 160,              // ULTRA-CLOSE: Very near control node (was 200)
                                         // Control radius: 50, Content radius: 160
                                         // Initial overlap: 160 - 50 - 160 = -50 units
                                         // Force simulation will push to ~210-220 units
                                         // Final gap: ~0-10 units (extremely tight!)
        
        // Ring-based positioning (OPTIMIZED FOR PROXIMITY)
        FIRST_RING_SIZE: 3,              // TRIANGLE: Only 3 nodes in first ring (was 4)
                                         // Circumference at 210 (settled): ~1,319 units
                                         // Space per node: 1,319/3 = 440 units
                                         // Node diameter: 320 units
                                         // Comfortable fit with 120° separation
        
        SECOND_RING_SIZE: 6,             // HEXAGON: 6 nodes in second ring
                                         // Standard 60° separation
        
        THIRD_RING_SIZE: 9,              // NEW: Third ring for smooth progression
                                         // 40° separation, fills gap before spiral
        
        RING_DISTANCE_INCREMENT: 100,    // Distance between rings
                                         // Ring 1: ~210 (settled from 160)
                                         // Ring 2: ~310
                                         // Ring 3: ~410
                                         // Spiral: starts at ~510
        
        // Spiral positioning (for nodes beyond rings)
        DISTANCE_INCREMENT: 25,          // Distance increase per node in spiral
                                         // Smooth progression for nodes 19+
        
        // Angular distribution
        GOLDEN_ANGLE: Math.PI * (3 - Math.sqrt(5)), // Golden angle for spiral (≈137.5°)
        ANGLE_JITTER: 0.05,              // MINIMAL: Almost no jitter (was 0.1)
                                         // Maximum predictability for tight spacing
        
        // Legacy vote-based distance calculation (kept for compatibility)
        VOTE_DISTANCE_MULTIPLIER: 20,   // How much each vote affects distance
        INDEX_DISTANCE_MULTIPLIER: 30,  // How much node index affects distance
        BASE_BATCH_DISTANCE: 160,       // UPDATED: Base distance for batch positioning (was 200)
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
        MAX_NODES_TO_RENDER: 200,        // Maximum nodes in single-node mode
        NODES_PER_BATCH: 10,            // Nodes per batch in batch mode
        MAX_BATCHES: 20,                 // Maximum number of batches
        LINK_PATH_CACHE_SIZE: 500,      // Maximum cached link paths
    },
    
    // Node sizing
    NODE_SIZING: {
        HIDDEN_NODE_RADIUS: 50,         // Radius for hidden nodes (diameter/2)
        COLLISION_PADDING: {
            DROP_PHASE: 20,             // MINIMAL: Very tight during drops (was 25)
            SETTLEMENT_PHASE: 40,       // MINIMAL: Very tight during settlement (was 45)
                                        // Allows nodes to get as close as possible
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