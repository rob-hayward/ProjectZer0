// src/lib/constants/graph/simulation.ts
export const SIMULATION = {
    BASE: {
        VELOCITY_DECAY: 0.4,
        ALPHA_DECAY: 0.02,
        ALPHA_MIN: 0.001,
        ALPHA_VALUES: {
            START: 1,
            RESTART: 0.3
        }
    },
    FORCES: {
        CHARGE: {
            DISTANCE: {
                MIN: 200,
                MAX: 18000
            }
        },
        COLLISION: {
            STRENGTH: 1,
            ITERATIONS: 6,
            PADDING: {
                BASE: 40,
                NAVIGATION: 10,
                DEFINITION: 150
            }
        }
    }
} as const;