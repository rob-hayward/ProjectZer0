// src/lib/services/graph/universal/UniversalForceConfig.ts
// D3 force simulation configuration for Universal Graph

export const UNIVERSAL_FORCES = {
    // Simulation parameters
    SIMULATION: {
        VELOCITY_DECAY: 0.4,            // Base velocity decay
        ALPHA_DECAY: 0.02,              // Base alpha decay  
        ALPHA_MIN: 0.001,               // Minimum alpha before stopping
        ALPHA_TARGET: 0,                // Target alpha (0 = let it run)
        
        // Phase-specific settings
        DROP_PHASE: {
            ALPHA: 0.3,                 // Initial alpha for drop phase
            VELOCITY_DECAY: 0.6,        // Higher decay for drop phase
            ALPHA_DECAY: 0.1,           // Faster decay for drop phase
            ALPHA_MIN: 0.01,            // Higher minimum for drop phase
        },
        
        SETTLEMENT_PHASE: {
            ALPHA: 0.5,                 // Lower initial energy for settlement
            VELOCITY_DECAY: 0.4,        // Moderate damping
            ALPHA_DECAY: 0.03,          // Faster decay for quicker settling
            ALPHA_MIN: 0.001,           // Standard minimum
            ALPHA_THRESHOLD: 0.01,      // Alpha threshold for considering settled
        },
    },
    
    // Drop phase forces (minimal, nodes are pinned)
    DROP_PHASE: {
        CHARGE: {
            STRENGTH: -100,             // Weak repulsion during drops
            DISTANCE_MIN: 30,           // Minimum distance for charge effect
            DISTANCE_MAX: 400,          // Maximum distance for charge effect
            THETA: 0.9,                 // Barnes-Hut approximation parameter
        },
        COLLISION: {
            STRENGTH: 0.5,              // Weak collision during drops
            ITERATIONS: 1,              // Single iteration for performance
            // Radius added dynamically based on node
        },
        CENTER: {
            X_STRENGTH: 0.01,           // Very weak centering
            Y_STRENGTH: 0.01,           // Very weak centering
        },
    },
    
    // Settlement phase forces (natural spacing)
    SETTLEMENT_PHASE: {
        CHARGE: {
            STRENGTH: -600,             // Moderate repulsion for natural spacing
            DISTANCE_MIN: 100,           // Minimum distance for charge effect
            DISTANCE_MAX: 1200,         // Maximum distance for charge effect
            THETA: 0.9,                 // Barnes-Hut approximation parameter
        },
        COLLISION: {
            STRENGTH: 0.9,              // Strong collision avoidance
            ITERATIONS: 3,              // More iterations for accuracy
            // Radius added dynamically: node.radius + 60
        },
        CENTER: {
            X_STRENGTH: 0.02,           // Gentle centering to prevent explosion
            Y_STRENGTH: 0.02,           // Gentle centering to prevent explosion
        },
        SOFT_RADIAL: {
            STRENGTH_MULTIPLIER: 0.001, // Very gentle force toward vote-based distance
            // Applied as: (targetDistance - currentDistance) * STRENGTH_MULTIPLIER * alpha
        },
        ANGULAR_SPREADING: {
            ANGLE_BUCKETS: 8,           // Group nodes into N angle buckets
            REPULSION_DISTANCE: 200,    // Apply force if nodes closer than this
            FORCE_MULTIPLIER: 0.005,    // Gentle angular repulsion
            // Applied when nodes are at similar angles to break spiral
        },
    },
    
    // Link forces (when applicable)
    LINK: {
        DISTANCE: 150,                  // Standard link distance
        STRENGTH: {
            DROP_PHASE: 0.01,           // Very weak during drops
            SETTLEMENT_PHASE: 0.05,     // Weak during settlement
        },
    },
    
    // Initial velocity for nodes
    INITIAL_VELOCITY: {
        SETTLEMENT_SPEED: 10,           // Initial speed when unpinning nodes
        ANGLE_VARIATION: 0.3,           // Random variation in initial direction
    },
} as const;

// Type for the force configuration
export type UniversalForceConfiguration = typeof UNIVERSAL_FORCES;