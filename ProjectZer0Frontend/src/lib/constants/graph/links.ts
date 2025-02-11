// src/lib/components/graph/links/LinkConstants.ts
import { COLORS } from '$lib/constants/colors';

export const LINK_CONSTANTS = {
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
    }
} as const;