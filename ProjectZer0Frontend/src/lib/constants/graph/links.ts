// ProjectZer0Frontend/src/lib/constants/graph/links.ts
import { COLORS } from '$lib/constants/colors';

export const LINK_CONSTANTS = {
    STYLES: {
        WORD_TO_DEFINITION: {
            STROKE_WIDTH: 1.5,
            GRADIENT: {
                START_OPACITY: 0.8,
                END_OPACITY: 0.8
            }
        },
        WORD_TO_ALT_DEFINITION: {
            STROKE_WIDTH: 1.25,
            GRADIENT: {
                START_OPACITY: 0.5,
                END_OPACITY: 0.5
            }
        },
        NAVIGATION: {
            STROKE_WIDTH: 1,
            OPACITY: 0.3
        }
    },
    COLORS: {
        WORD: COLORS.PRIMARY.BLUE,
        WORD_ALT: COLORS.PRIMARY.PURPLE,
        DEFINITION: {
            LIVE: COLORS.PRIMARY.BLUE,
            ALTERNATIVE: COLORS.PRIMARY.PURPLE
        }
    },
    ANIMATION: {
        TRANSITION_DURATION: 300,
        OPACITY_TRANSITION: {
            DURATION: 200,
            DELAY: 50
        }
    }
} as const;

// Helper function to get link opacity based on node modes and definition type
export function getLinkOpacity(
    isLiveDefinition: boolean,
    sourceMode: 'preview' | 'detail',
    targetMode: 'preview' | 'detail'
): number {
    // Live definition links are always more visible
    if (isLiveDefinition) {
        return targetMode === 'detail' || sourceMode === 'detail' 
            ? 0.8 : 0.6;
    }
    
    // Alternative definition links are less visible
    return targetMode === 'detail' || sourceMode === 'detail'
        ? 0.4 : 0.25;
}

// Type helper
export type LinkConstants = typeof LINK_CONSTANTS;