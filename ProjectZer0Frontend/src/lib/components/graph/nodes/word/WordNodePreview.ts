// src/components/graph/nodes/word/WordNodePreview.ts
import type { WordNode, NodeStyle } from '$lib/types/nodes';
import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
import { drawWrappedText } from '../utils/nodeUtils';

export function drawWordNodePreview(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    style: NodeStyle,
    isHovered: boolean,
    wordData: WordNode
) {
    const titleY = centerY - (style.previewSize * 0.25);
    const wordY = centerY;

    // Draw "Word Node" title
    ctx.font = NODE_CONSTANTS.FONTS.title;
    ctx.fillStyle = style.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Word Node", centerX, titleY);

    // Draw the word itself
    ctx.font = NODE_CONSTANTS.FONTS.value;
    ctx.fillText(wordData.word, centerX, wordY);

    // Draw hover text if needed
    if (isHovered) {
        ctx.font = NODE_CONSTANTS.FONTS.hover;
        ctx.fillText(
            "click to zoom",
            centerX,
            centerY + (style.previewSize * 0.3)
        );
    }
}