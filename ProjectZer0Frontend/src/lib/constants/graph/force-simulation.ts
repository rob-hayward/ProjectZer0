// src/lib/constants/graph/force-simulation.ts
import { COORDINATE_SPACE } from './coordinate-space';

export const FORCE_SIMULATION = {
    // Base simulation parameters
    SIMULATION: {
        BASE: {
            VELOCITY_DECAY: COORDINATE_SPACE.ANIMATION.VELOCITY_DECAY,
            ALPHA_DECAY: COORDINATE_SPACE.ANIMATION.ALPHA_DECAY,
            ALPHA_MIN: COORDINATE_SPACE.ANIMATION.ALPHA_MIN,
            ALPHA_VALUES: {
                START: 1,
                RESTART: 0.3
            }
        }
    },

    // Layout-specific configurations
    LAYOUTS: {
        SINGLE_NODE: {
            FORCES: {
                CENTRAL: {
                    CHARGE: {
                        STRENGTH: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.WORD,
                        DISTANCE: {
                            MIN: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MIN,
                            MAX: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE.MAX
                        }
                    },
                    COLLISION: {
                        PADDING: COORDINATE_SPACE.NODES.PADDING.COLLISION.BASE,
                        STRENGTH: 1.0,
                        ITERATIONS: 6
                    }
                }
            }
        },
        WORD_DEFINITION: {
            INITIAL_POSITIONS: {
                LIVE_DEFINITION: {
                    X: COORDINATE_SPACE.NODES.SIZES.DEFINITION.PREVIEW,
                    Y: 0
                }
            },
            FORCES: {
                MANY_BODY: {
                    WORD: {
                        STRENGTH: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.WORD,
                        DISTANCE: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.DISTANCE
                    },
                    DEFINITION: {
                        LIVE: { 
                            STRENGTH: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.DEFINITION.LIVE 
                        },
                        ALTERNATIVE: {
                            BASE_STRENGTH: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.DEFINITION.ALTERNATIVE,
                            VOTE_MULTIPLIER: 1
                        }
                    }
                }
            }
        },
        NAVIGATION: {
            RADIAL: {
                BASE_PADDING: COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION,
                MULTIPLIERS: {
                    DETAIL: 0.5,
                    PREVIEW: 0.55
                }
            },
            FORCE: {
                STRENGTH: 1,
                CHARGE: COORDINATE_SPACE.LAYOUT.FORCES.CHARGE.STRENGTH.NAVIGATION,
                COLLISION_PADDING: COORDINATE_SPACE.NODES.PADDING.COLLISION.NAVIGATION
            }
        }
    }
} as const;