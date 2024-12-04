// src/components/graph/nodes/utils/nodeStyles.ts
import type { NodeStyle } from '$lib/types/nodes';
import { NODE_CONSTANTS } from '../base/BaseNodeConstants';

export function createWordNodeStyle(): NodeStyle {
    return {
        previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
        zoomedSize: NODE_CONSTANTS.SIZES.WORD.zoomed,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT
    };
}

export function createDefinitionNodeStyle(): NodeStyle {
    return {
        previewSize: NODE_CONSTANTS.SIZES.DEFINITION.preview,
        zoomedSize: NODE_CONSTANTS.SIZES.DEFINITION.zoomed,
        colors: NODE_CONSTANTS.COLORS.DEFINITION,
        padding: NODE_CONSTANTS.PADDING,
        lineHeight: NODE_CONSTANTS.LINE_HEIGHT
    };
}