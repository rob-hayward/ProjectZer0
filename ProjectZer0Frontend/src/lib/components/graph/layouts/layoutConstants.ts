// ProjectZer0Frontend/src/lib/components/graph/layouts/layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
    // Original constants for word/definition views
    RADIUS: {
        CENTER: 0,
        LIVE_DEFINITION: {
            ANGLE: -Math.PI / 7,  // Optimal angle for up-right positioning
            RADIUS_DIVISOR: 2,    // Divide node sizes by this for better spacing
            PADDING: 300           // Additional padding between nodes
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

    // Navigation-specific layout constants with view mode support
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
            RADIAL: 2.0,        // Maintain circular formation
            COLLISION: 1.5,      // Prevent overlap
            CHARGE: -200         // Node repulsion
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