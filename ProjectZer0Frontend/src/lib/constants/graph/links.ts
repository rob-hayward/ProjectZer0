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
            // Very subtle base width
            BASE_STROKE_WIDTH: 1.0,
            // Modest maximum width to avoid overly thick lines
            MAX_STROKE_WIDTH: 2.0,
            // Very small increment for thickness (barely noticeable)
            STROKE_WIDTH_INCREMENT: 0.15,
            GRADIENT: {
                // Start with lower base opacity for weak relationships
                MIN_OPACITY: 0.2,
                // Strong relationships have high opacity (more noticeable)
                MAX_OPACITY: 0.95,
                // Larger opacity increment (more visible difference)
                OPACITY_INCREMENT: 0.1,
            },
            GLOW: {
                // Minimal glow for single-keyword relationships
                BASE_INTENSITY: 1.0,
                // Strong glow for multi-keyword relationships
                MAX_INTENSITY: 10.0,
                // Significant increase in glow per relationship
                INTENSITY_INCREMENT: 1.0,
                // Start with subtle glow opacity
                BASE_OPACITY: 0.15,
                // Maximum glow opacity - noticeable but not overwhelming
                MAX_OPACITY: 0.7,
                // Significant opacity increment per keyword
                OPACITY_INCREMENT: 0.07
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