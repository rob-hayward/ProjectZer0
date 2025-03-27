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
            STATEMENT: {  
                DETAIL: 600,     // IMPORTANT: Match definition size exactly
                PREVIEW: 320     // Match definition preview size
            },
            NAVIGATION: 80,
            HIDDEN: 100
        },
        PADDING: {
            DETAIL: 40,
            PREVIEW: 10,
            COLLISION: {
                BASE: 20,          // Collision padding for central nodes
                NAVIGATION: 5,     // Collision padding for navigation nodes
                DEFINITION: 150,   // Collision padding for definition nodes
                STATEMENT: 150     // Match definition collision padding
            }
        }
    },

    // Layout distances and spacing
    LAYOUT: {
        RING_SPACING: {
            INITIAL: 650,         // Base spacing for first ring
            INCREMENT: 0.2,        // Increase per ring
            DEFINITION_EXPANSION_BUFFER: 80, // Additional buffer when definitions expand
            PREVIEW_MODE_BUFFER: 60, // Buffer for preview mode
        },
        NAVIGATION: {
            // Direct distances from central node perimeter to navigation nodes
            DISTANCE: {
                DETAIL_MODE: 70,   // Distance when central node is in detail mode
                PREVIEW_MODE: 50   // Distance when central node is in preview mode
            },
            // Scaling factors for connection endpoints
            CONNECTION_SCALING: {
                DETAIL_MODE: 1/4.35,  // Scaling factor for detail mode endpoints 
                PREVIEW_MODE: 1/1.38  // Scaling factor for preview mode endpoints
            }
        },
        FORCES: {
            CHARGE: {
                STRENGTH: {
                    WORD: -9000,
                    DEFINITION: {
                        LIVE: -1600,
                        ALTERNATIVE: -300
                    },
                    STATEMENT: -1600,  // IMPORTANT: Match definition charge strength
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