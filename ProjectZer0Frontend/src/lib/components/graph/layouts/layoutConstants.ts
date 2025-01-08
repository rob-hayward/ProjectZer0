// src/lib/components/graph/layouts/layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
    // Original constants for word/definition views
    RADIUS: {
        CENTER: 0,
        LIVE_DEFINITION: {
            ANGLE: -Math.PI / 7,    // Keep successful angle
            PADDING: 350            // Current live definition distance
        },
        ALTERNATIVE_DEFINITIONS: {
            MIN_RADIUS: 700,        // Doubled from previous 400
            MAX_RADIUS: 1200,       // Increased for more spread
            VOTE_SCALE_FACTOR: 50,
            ANGULAR_SEPARATION: Math.PI / 6,
            PREVIEW: {
                SCALE: 0.6,
                SPACING: 150,
                MIN_RADIUS: 700,    // Match the main MIN_RADIUS
                MAX_RADIUS: 1200    // Match the main MAX_RADIUS
            },
            DETAIL: {
                SCALE: 1,
                SPACING: 200,
                MIN_RADIUS: 800,    // Match the main MIN_RADIUS
                MAX_RADIUS: 1200    // Match the main MAX_RADIUS
            }
        }
    },

    // Force simulation parameters
    FORCES: {
        CHARGE: {
            WORD: 0,
            DEFINITION: {
                LIVE: -400,
                ALTERNATIVE: -800,   // Strong repulsion between alternative nodes
                PREVIEW: -600
            }
        },
        COLLISION: {
            STRENGTH: {
                NORMAL: 1,          // Maximum strength to prevent overlap
                PREVIEW: 1.2        // Even stronger in preview to prevent overlap
            },
            PADDING: {
                NORMAL: 20,
                PREVIEW: 10
            }
        },
        LINK: {
            STRENGTH: {
                LIVE: 1.0,          // Strong connection to live definition
                ALTERNATIVE: 0.5,    // Base strength for alternatives
                VOTE_SCALE: 0.05    // Factor to scale strength by votes
            }
        },
        RADIAL: {
            STRENGTH: {
                NORMAL: 1.0,
                PREVIEW: 1.2
            }
        }
    },

    // Navigation-specific layout constants
    NAVIGATION: {
        RADIUS: {
            DETAIL: 350,        // Original radius for detail view
            PREVIEW: 130        // Smaller radius for preview view
        },
        SPACING: {
            DETAIL: 60,         // Original spacing for detail view
            PREVIEW: 45         // Smaller spacing for preview view
        },
        STRENGTH: {
            RADIAL: 2.0,       // Maintain circular formation
            COLLISION: 1.5,     // Prevent overlap
            CHARGE: -200        // Node repulsion
        }
    },

    // Simulation settings
    SIMULATION: {
        VELOCITY_DECAY: 0.7,    // Increased to stabilize positions
        ALPHA_DECAY: 0.02,      // Adjusted for quicker settling
        ITERATIONS: 500         // Increased for better settling
    },

    // Colors for edges/links
    EDGES: {
        WORD_TO_LIVE: {
            COLOR: COLORS.PRIMARY.BLUE,
            OPACITY: 0.8
        },
        WORD_TO_ALTERNATIVE: {
            COLOR: COLORS.PRIMARY.PURPLE,
            OPACITY: {
                NORMAL: 0.8,
                PREVIEW: 0.6    // Slightly more transparent in preview
            }
        }
    },

    // Transition timings
    TRANSITIONS: {
        DURATION: 750,
        EASING: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
} as const;