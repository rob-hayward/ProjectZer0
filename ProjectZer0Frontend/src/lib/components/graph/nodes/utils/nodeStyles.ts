// ProjectZer0Frontend/src/lib/components/graph/nodes/utils/nodeStyles.ts
import type { NodeStyle } from '$lib/types/domain/nodes';
import { NODE_CONSTANTS } from '../../../../constants/graph/node-styling';

export function createWordNodeStyle(): NodeStyle {
    return {
        previewSize: NODE_CONSTANTS.SIZES.WORD.preview,
        detailSize: NODE_CONSTANTS.SIZES.WORD.detail,
        colors: NODE_CONSTANTS.COLORS.WORD,
        padding: {
            preview: NODE_CONSTANTS.PADDING.preview,
            detail: NODE_CONSTANTS.PADDING.detail
        },
        lineHeight: {
            preview: NODE_CONSTANTS.LINE_HEIGHT.preview,
            detail: NODE_CONSTANTS.LINE_HEIGHT.detail
        },
        stroke: NODE_CONSTANTS.STROKE
    };
}

export function createDefinitionNodeStyle(type: 'live' | 'alternative'): NodeStyle {
    return {
        previewSize: type === 'live' 
            ? NODE_CONSTANTS.SIZES.DEFINITION.live.preview
            : NODE_CONSTANTS.SIZES.DEFINITION.alternative.preview,
        detailSize: type === 'live'
            ? NODE_CONSTANTS.SIZES.DEFINITION.live.detail
            : NODE_CONSTANTS.SIZES.DEFINITION.alternative.detail,
        colors: NODE_CONSTANTS.COLORS.DEFINITION[type],
        padding: {
            preview: NODE_CONSTANTS.PADDING.preview,
            detail: NODE_CONSTANTS.PADDING.detail
        },
        lineHeight: {
            preview: NODE_CONSTANTS.LINE_HEIGHT.preview,
            detail: NODE_CONSTANTS.LINE_HEIGHT.detail
        },
        stroke: NODE_CONSTANTS.STROKE
    };
}