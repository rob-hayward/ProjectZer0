// src/lib/constants/graph/coordinate-space.ts
export const COORDINATE_SPACE = {
    // World dimensions - using smaller, more reasonable values
    WORLD: {
        WIDTH: 2000,     // Reduced from 200000
        HEIGHT: 2000,    // Reduced from 200000
        VIEW: {
            MIN_ZOOM: 0.05,   // Keep this for full view
            MAX_ZOOM: 6.0,     // Adjusted for smaller coordinate space
            INITIAL_ZOOM: 2.5  // Adjusted for smaller coordinate space
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
            QUANTITY: {
                DETAIL: 1600,    // 3x larger than standard nodes
                PREVIEW: 320     // Keep the same preview size
            },
            CONTROL: {           // New control node specific sizes
                DETAIL: 450,     // Smaller detail view for control node
                PREVIEW: 250     // Smaller preview for control node
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
                STATEMENT: 150,    // Match definition collision padding
                QUANTITY: 200      // Larger collision padding for quantity nodes
            }
        }
    },

    // Layout distances and spacing - adjusted for smaller coordinate space
    LAYOUT: {
        RING_SPACING: {
            INITIAL: 650,         // do not change
            INCREMENT: 0.2,        // Increase per ring
            DEFINITION_EXPANSION_BUFFER: 80, // Additional buffer when definitions expand
            PREVIEW_MODE_BUFFER: 60, // Buffer for preview mode
        },
        NAVIGATION: {
            // Direct distances from central node perimeter to navigation nodes
            DISTANCE: {
                DETAIL_MODE: 70,   // Distance when central node is in detail mode
                PREVIEW_MODE: 50,  // Distance when central node is in preview mode
                CONTROL: {         // Specific distances for control node (which is smaller)
                    DETAIL_MODE: 0,  // Much smaller distance to bring navigation nodes closer to control node
                    PREVIEW_MODE: 15   // Even smaller distance for preview mode control node
                },
                // Fixed distances from control node edge for precise positioning
                FIXED_DISTANCE: {
                    DETAIL_MODE: 70,  // Fixed distance from control node edge in detail mode
                    PREVIEW_MODE: 50   // Fixed distance from control node edge in preview mode - smaller to move inward
                }
            },
            // Scaling factors for connection endpoints
            CONNECTION_SCALING: {
                DETAIL_MODE: 1/4.35,  // Scaling factor for detail mode endpoints 
                PREVIEW_MODE: 1/1.38,  // Scaling factor for preview mode endpoints
                CONTROL: {
                    DETAIL_MODE: 1/8,  // Stronger reduction for control node detail mode
                    PREVIEW_MODE: 1/4   // Stronger reduction for control node preview mode
                }
            }
        },
        FORCES: {
            CHARGE: {
                STRENGTH: {
                    // Adjusted force strengths for smaller coordinate space
                    WORD: -900,         // Reduced from -9000
                    DEFINITION: {
                        LIVE: -300,     // Reduced from -1600
                        ALTERNATIVE: -100  // Reduced from -300
                    },
                    STATEMENT: -300,    // Reduced from -1600
                    QUANTITY: -400,     // New strength for quantity nodes
                    NAVIGATION: -20     // Reduced from -50
                },
                DISTANCE: {
                    MIN: 50,            // Reduced from 200
                    MAX: 1000           // Reduced from 18000
                }
            }
        },
        CLUSTER: {
            MIN_SIZE: 500,        // Reduced from 5000
            SPACING: 1000         // Reduced from 10000
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