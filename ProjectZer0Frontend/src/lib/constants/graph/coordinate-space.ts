// src/lib/constants/graph/coordinate-space.ts
export const COORDINATE_SPACE = {
    // World dimensions
    WORLD: {
        WIDTH: 200000,
        HEIGHT: 200000,
        VIEW: {
            MIN_ZOOM: 0.05,   // Keep this for full view
            MAX_ZOOM: 400,     // Increase significantly from 4
            INITIAL_ZOOM: 250  // New constant for our preferred starting zoom
        }
    },

    // Node sizes - all other measurements should be relative to these base sizes
    NODES: {
        SIZES: {
            STANDARD: {
                DETAIL: 600,     // Base size for detail views
                PREVIEW: 320     // Base size for previews
            },
            WORD: {
                DETAIL: 600,
                PREVIEW: 135
            },
            DEFINITION: {
                DETAIL: 600,
                PREVIEW: 320
            },
            NAVIGATION: 80
        },
        PADDING: {
            DETAIL: 40,
            PREVIEW: 10,
            COLLISION: {
                BASE: 40,
                NAVIGATION: 10,
                DEFINITION: 150
            }
        }
    },

    // Layout distances and spacing
    LAYOUT: {
        RING_SPACING: {
            INITIAL: 1000,           // Base spacing for first ring
            INCREMENT: 0.2           // Increase per ring
        },
        NAVIGATION: {
            RING_DISTANCE: 40       // Distance from central node perimeter to navigation node perimeter
        },
        FORCES: {
            CHARGE: {
                STRENGTH: {
                    WORD: -9000,
                    DEFINITION: {
                        LIVE: -1600,
                        ALTERNATIVE: -300
                    },
                    NAVIGATION: -100
                },
                DISTANCE: {
                    MIN: 200,
                    MAX: 18000
                }
            }
        },
        CLUSTER: {
            MIN_SIZE: 5000,          // Minimum size for a cluster
            SPACING: 10000           // Space between clusters
        }
    },

    // Animation and transition distances
    ANIMATION: {
        VELOCITY_DECAY: 0.4,
        ALPHA_DECAY: 0.02,
        ALPHA_MIN: 0.001
    }
} as const;

// Type helper
export type CoordinateSpace = typeof COORDINATE_SPACE;