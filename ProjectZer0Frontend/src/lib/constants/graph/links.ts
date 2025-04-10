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
        STATEMENT_RELATION: {
            // Base stroke width for single relation - subtle start
            BASE_STROKE_WIDTH: 1.0,
            // Maximum stroke width - less extreme
            MAX_STROKE_WIDTH: 3.0,
            // Smaller increment for more gradual change
            STROKE_WIDTH_INCREMENT: 0.2,
            GRADIENT: {
                // Start with lower base opacity
                MIN_OPACITY: 0.5,
                // Higher max opacity but not full
                MAX_OPACITY: 0.9,
                // Smaller opacity increment
                OPACITY_INCREMENT: 0.05
            },
            GLOW: {
                // Start with modest glow
                BASE_INTENSITY: 1.5,
                // Stronger glow but not excessive
                MAX_INTENSITY: 5.0,
                // Modest glow increment per relationship
                INTENSITY_INCREMENT: 0.4,
                // Start with subtle glow opacity
                BASE_OPACITY: 0.2,
                // Maximum glow opacity - visible but not overwhelming
                MAX_OPACITY: 0.6,
                // Modest opacity increment
                OPACITY_INCREMENT: 0.05
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
        },
        STATEMENT: COLORS.PRIMARY.GREEN
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