// ProjectZer0Frontend/src/lib/components/graphElements/layouts/concentricLayouts/word/wordConcentricPositioning.ts
import { 
    LAYOUT_CONSTANTS,
    DEFAULT_CONFIG,
    calculateNodePositions,
    calculateTransitionPositions
} from '../base/concentricPositioning';
import type { 
    NodeLayoutMetadata, 
    SortMode,
    ConcentricNodePosition 
} from '$lib/types/layout';

// Word-specific layout adjustments
export const WORD_LAYOUT_CONSTANTS = {
    // Any word-specific adjustments to spacing or sizing
    DEFINITION_SPACING_MULTIPLIER: 0.7,  // Make definitions slightly closer than default
    ALTERNATIVE_SPREAD: 0.9,     // Control how spread out alternative definitions are
} as const;

export function calculateWordNodePositions(
    centerNode: NodeLayoutMetadata,
    alternativeNodes: NodeLayoutMetadata[],
    sortMode: SortMode,
    canvasWidth: number,
    canvasHeight: number
): Map<string, ConcentricNodePosition> {
    // Use default config with word-specific adjustments
    const wordConfig = {
        ...DEFAULT_CONFIG,
        // Adjust spacing for word layout
        ringSpacing: DEFAULT_CONFIG.ringSpacing * WORD_LAYOUT_CONSTANTS.DEFINITION_SPACING_MULTIPLIER,
    };

    return calculateNodePositions(
        centerNode,
        alternativeNodes,
        wordConfig,
        sortMode,
        canvasWidth,
        canvasHeight
    );
}

// Re-export transition calculation for convenience
export { calculateTransitionPositions } from '../base/concentricPositioning';