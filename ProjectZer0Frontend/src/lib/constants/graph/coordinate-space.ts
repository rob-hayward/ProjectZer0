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
                BASE: 20,          // Collision padding for central nodes
                NAVIGATION: 5,     // Collision padding for navigation nodes
                DEFINITION: 150    // Collision padding for definition nodes
            }
        }
    },

    // Layout distances and spacing
    LAYOUT: {
        RING_SPACING: {
            INITIAL: 1000,         // Base spacing for first ring
            INCREMENT: 0.2         // Increase per ring
        },
        NAVIGATION: {
            // No longer using this for navigation node positioning
            // Simple, direct padding is set in the layout component
            NODE_PADDING: 70       // Direct spacing between node perimeters
        },
        FORCES: {
            CHARGE: {
                STRENGTH: {
                    WORD: -9000,
                    DEFINITION: {
                        LIVE: -1600,
                        ALTERNATIVE: -300
                    },
                    NAVIGATION: -50  // Reduced repulsion for navigation nodes
                },
                DISTANCE: {
                    MIN: 200,
                    MAX: 18000
                }
            }
        },
        CLUSTER: {
            MIN_SIZE: 5000,        // Minimum size for a cluster
            SPACING: 10000         // Space between clusters
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