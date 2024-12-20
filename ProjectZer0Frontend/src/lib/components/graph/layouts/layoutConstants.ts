// ProjectZer0Frontend/src/lib/components/graph/layouts/layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
    // Original constants for word/definition views
    RADIUS: {
        CENTER: 0,
        LIVE_DEFINITION: {
            ANGLE: -Math.PI / 7,  // Optimal angle for up-right positioning
            RADIUS_DIVISOR: 3,    // Divide node sizes by this for better spacing
            PADDING: 20           // Additional padding between nodes
        },
        ALTERNATIVE_BASE: 150,
        MAX_RADIUS: 200
    },

    // Force simulation parameters
    FORCES: {
        CHARGE: {
            WORD: 0,
            DEFINITION: -400
        },
        COLLISION: {
            STRENGTH: 0.5,
            PADDING: 20
        },
        LINK: {
            STRENGTH: 0.5
        },
        RADIAL: {
            STRENGTH: 1.0
        }
    },

    // New navigation-specific layout constants
    NAVIGATION: {
        RADIUS: 350,         // Increased radius for better spacing
        SPACING: 60,         // Increased minimum spacing between nodes
        STRENGTH: {
            RADIAL: 2.0,     // Increased to maintain circular formation
            COLLISION: 1.5,   // Increased to prevent overlap
            CHARGE: -200     // Stronger repulsion between nodes
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
            OPACITY: 0.8
        }
    }
} as const;