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
                DETAIL: 500,
                PREVIEW: 200
            },
            DEFINITION: {
                DETAIL: 600,
                PREVIEW: 320
            },
            STATEMENT: {  
                DETAIL: 600,     // IMPORTANT: Match definition size exactly
                PREVIEW: 320     // Match definition preview size
            },
            OPENQUESTION: {      // NEW: OpenQuestion node sizes (same as statement)
                DETAIL: 600,
                PREVIEW: 320
            },
            ANSWER: {
                PREVIEW: 320,
                DETAIL: 600
            },
            EVIDENCE: {
                PREVIEW: 320,
                DETAIL: 600
            },
            QUANTITY: {
                DETAIL: 1300,    // 3x larger than standard nodes
                PREVIEW: 320     // Keep the same preview size
            },
            DASHBOARD: {         // New dashboard specific sizes
                DETAIL: 600,     // Same as definition detail size
                PREVIEW: 320     // Same as definition preview size
            },
            CONTROL: {           // New control node specific sizes
                DETAIL: 450,     // Smaller detail view for control node
                PREVIEW: 100     // Minimal preview - just shows icon (similar to navigation nodes)
            },
            COMMENT: {
                DETAIL: 600,    
                PREVIEW: 320    
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
                OPENQUESTION: 150, // NEW: Same as statement collision padding
                QUANTITY: 200,     // Larger collision padding for quantity nodes
                DASHBOARD: 150,    // Same as definition collision padding
                COMMENT: 10,       // Small collision padding for comment nodes
                CONTROL: 10        // Small collision padding for control node preview
            }
        }
    },

    // Content boxes - largest square that fits in each node circle
    // Formula: side = radius × √2 (where radius = diameter ÷ 2)
    CONTENT_BOXES: {
        STANDARD: {
            DETAIL: 424,        // (600÷2) × √2 = 424.26
            PREVIEW: 226        // (320÷2) × √2 = 226.27
        },
        WORD: {
            DETAIL: 354,        // (500÷2) × √2 = 353.55
            PREVIEW: 141        // (200÷2) × √2 = 141.42
        },
        DEFINITION: {
            DETAIL: 424,        // (600÷2) × √2 = 424.26
            PREVIEW: 226        // (320÷2) × √2 = 226.27
        },
        STATEMENT: {
            DETAIL: 424,        // (600÷2) × √2 = 424.26
            PREVIEW: 226        // (320÷2) × √2 = 226.27
        },
        OPENQUESTION: {         // NEW: OpenQuestion content box sizes (same as statement)
            DETAIL: 424,        // (600÷2) × √2 = 424.26
            PREVIEW: 226        // (320÷2) × √2 = 226.27
        },
        QUANTITY: {
            DETAIL: 919,        // (1300÷2) × √2 = 919.24
            PREVIEW: 226        // (320÷2) × √2 = 226.27
        },
        DASHBOARD: {            // New dashboard content box sizes
            DETAIL: 424,        // (600÷2) × √2 = 424.26 - same as definition
            PREVIEW: 226        // (320÷2) × √2 = 226.27 - same as definition
        },
        CONTROL: {
            DETAIL: 318,        // (450÷2) × √2 = 318.20
            PREVIEW: 71         // (100÷2) × √2 = 70.71 - minimal size for icon
        },
        COMMENT: {
            DETAIL: 424,        // (600÷2) × √2 = 424.26
            PREVIEW: 226        // (320÷2) × √2 = 226.27
        },
        NAVIGATION: 56,         // (80÷2) × √2 = 56.57
        HIDDEN: 71              // (100÷2) × √2 = 70.71
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
        // Add specific settings for discussion view layout
        DISCUSSION: {
            COMMENT_RINGS: {
                ROOT_RADIUS: 400,          // Distance of root comments from central node
                REPLY_RADIUS_INCREMENT: 200, // Additional distance for each level of replies
                SPACING_FACTOR: 1.2        // Spacing between comments in the same ring
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
                    OPENQUESTION: -300, // NEW: Same as statement
                    QUANTITY: -400,     // New strength for quantity nodes
                    DASHBOARD: -300,    // Same as definition and statement
                    CONTROL: -50,       // Weak repulsion for control node
                    NAVIGATION: -20,    // Reduced from -50
                    COMMENT: -100       // Weak repulsion for comment nodes
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