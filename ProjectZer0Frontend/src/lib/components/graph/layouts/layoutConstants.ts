// ProjectZer0Frontend/src/lib/components/graph/layouts/layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
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

    // Simulation settings
    SIMULATION: {
        VELOCITY_DECAY: 0.4,
        ALPHA_DECAY: 0.01,
        ITERATIONS: 300
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