// src/lib/components/graph/edges/base/BaseEdgeConstants.ts

import { COLORS } from '$lib/constants/colors';

export const EDGE_CONSTANTS = {
    STYLES: {
        WORD_TO_DEFINITION: {
            STROKE_WIDTH: 1.5,
            GRADIENT: {
                START_OPACITY: 0.8,
                END_OPACITY: 0.8
            }
        }
    },
    COLORS: {
        WORD: COLORS.PRIMARY.BLUE,
        DEFINITION: {
            LIVE: COLORS.PRIMARY.BLUE,
            ALTERNATIVE: COLORS.PRIMARY.PURPLE
        }
    },
    FORCES: {
        LIVE_LINK_STRENGTH: 1.0,
        ALTERNATIVE_LINK_STRENGTH: 0.7,
        DEFAULT_LINK_STRENGTH: 0.5
    }
} as const;