// src/lib/components/graph/layouts/layoutConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LAYOUT_CONSTANTS = {
    // Base radius and positioning constants
    RADIUS: {
        CENTER: 0,
        LIVE_DEFINITION: {
            ANGLE: -Math.PI / 7,    // Angle for live definition relative to center
            PADDING: {
                PREVIEW: 250,       // Distance from center in preview mode
                DETAIL: 600         // Distance from center in detail mode
            }
        },
        ALTERNATIVE_DEFINITIONS: {
            PREVIEW: {
                SCALE: 0.6,         // Scale factor for preview nodes
                SPACING: 150,       // Minimum space between preview nodes
                MIN_RADIUS: 700,    // Minimum distance from center
                MAX_RADIUS: 10000000    // Maximum spread radius
            },
            DETAIL: {
                SCALE: 1,           // Full scale for detail mode
                SPACING: 550,       // Increased spacing for detail nodes
                MIN_RADIUS: 1500,   // Larger minimum distance for detail mode
                MAX_RADIUS: 100000000    // Larger maximum spread for detail mode
            },
            ANGULAR_SEPARATION: Math.PI / 6,  // Minimum angle between nodes
            VOTE_SCALE_FACTOR: 50   // How much votes affect radial position
        }
    },

    // Force simulation parameters
    FORCES: {
        CHARGE: {
            WORD: -1000,           // Base repulsion for word node
            DEFINITION: {
                LIVE: {
                    PREVIEW: -800,  // Live definition repulsion in preview
                    DETAIL: -2000   // Increased repulsion in detail mode
                },
                ALTERNATIVE: {
                    PREVIEW: -600,  // Alternative definition preview repulsion
                    DETAIL: -1800   // Detail mode repulsion
                }
            }
        },
        COLLISION: {
            STRENGTH: {
                NORMAL: 1.0,        // Base collision strength
                DETAIL: 1.5         // Increased collision strength for detail mode
            },
            PADDING: {
                NORMAL: 0,         // Base padding between nodes
                DETAIL: 350         // Increased padding for detail mode
            }
        },
        LINK: {
            STRENGTH: {
                LIVE: 1.0,          // Strong connection to live definition
                ALTERNATIVE: 0.3     // Weaker connection to alternatives
            },
            DISTANCE: {
                LIVE: {
                    PREVIEW: 400,    // Base distance for live definition
                    DETAIL: 800      // Increased distance in detail mode
                },
                ALTERNATIVE: {
                    PREVIEW: 600,    // Base distance for alternatives
                    DETAIL: 1000     // Increased distance in detail mode
                }
            }
        },
        RADIAL: {
            STRENGTH: {
                PREVIEW: 1.0,        // Standard radial force in preview
                DETAIL: 0.5          // Reduced radial force in detail for more flexibility
            }
        }
    },

    // Navigation-specific layout constants
    NAVIGATION: {
        RADIUS: {
            DETAIL: 355,            // Radius for navigation nodes in detail view
            PREVIEW: 130            // Radius in preview mode
        },
        SPACING: {
            DETAIL: 60,             // Space between navigation nodes in detail
            PREVIEW: 45             // Space in preview mode
        },
        STRENGTH: {
            RADIAL: 2.0,           // Force maintaining circular formation
            COLLISION: 1.5,         // Collision strength for navigation nodes
            CHARGE: -200           // Repulsion between navigation nodes
        }
    },

    // Simulation settings
    SIMULATION: {
        VELOCITY_DECAY: 0.4,       // How quickly node movement decays
        ALPHA_DECAY: 0.02,         // How quickly simulation cools down
        ITERATIONS: 300,           // Number of iterations per update
        ALPHA_TARGET: {
            NORMAL: 0,             // Regular simulation target (complete rest)
            TRANSITIONING: 0.3      // Keep some energy during transitions
        }
    },

    // Edge visualization constants
    EDGES: {
        WORD_TO_LIVE: {
            COLOR: COLORS.PRIMARY.BLUE,
            OPACITY: 0.8
        },
        WORD_TO_ALTERNATIVE: {
            COLOR: COLORS.PRIMARY.PURPLE,
            OPACITY: {
                NORMAL: 0.8,
                PREVIEW: 0.6
            }
        }
    },

    // Animation timings
    TRANSITIONS: {
        DURATION: 750,             // Standard transition duration in ms
        EASING: 'cubic-bezier(0.4, 0, 0.2, 1)' // Standard easing function
    }
} as const;