// src/lib/constants/graph/layouts.ts
export const LAYOUTS = {
    SINGLE_NODE: {
        FORCES: {
            CENTRAL: {
                CHARGE: {
                    STRENGTH: -500,
                    DISTANCE: {
                        MIN: 200,
                        MAX: 1000
                    }
                },
                COLLISION: {
                    PADDING: 20,
                    STRENGTH: 1.0,
                    ITERATIONS: 6
                }
            }
        }
    },
    WORD_DEFINITION: {
        INITIAL_POSITIONS: {
            LIVE_DEFINITION: {
                X: 300,
                Y: 0
            },
            ALTERNATIVE_SPREAD: {
                X_RANGE: 3000,
                Y_RANGE: 3000
            }
        },
        FORCES: {
            MANY_BODY: {
                WORD: {
                    STRENGTH: -9000,
                    DISTANCE: {
                        MIN: 200,
                        MAX: 3000
                    }
                },
                DEFINITION: {
                    LIVE: { STRENGTH: -1600 },
                    ALTERNATIVE: {
                        BASE_STRENGTH: -300,
                        VOTE_MULTIPLIER: 1
                    }
                }
            }
        }
    },
    NAVIGATION: {
        RADIAL: {
            BASE_PADDING: 10,
            MULTIPLIERS: {
                DETAIL: 0.5,
                PREVIEW: 0.55
            }
        },
        FORCE: {
            STRENGTH: 1,
            CHARGE: -100,
            COLLISION_PADDING: 10
        }
    }
} as const;