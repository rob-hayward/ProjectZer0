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
    console.log('Drawing word preview:', {
        centerX,
        centerY,
        style,
        isHovered,
        word: wordData.word
    });

    const titleY = centerY - (style.previewSize * 0.25);
    const wordY = centerY;

    // Draw a visible background for debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, style.previewSize / 2 - 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw "Word Node" title with enhanced visibility
    ctx.font = NODE_CONSTANTS.FONTS.title;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Word Node", centerX, titleY);

    // Draw the word itself with enhanced visibility
    ctx.font = NODE_CONSTANTS.FONTS.value;
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText(wordData.word, centerX, wordY);

    // Draw hover text if needed
    if (isHovered) {
        ctx.font = NODE_CONSTANTS.FONTS.hover;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(
            "click to zoom",
            centerX,
            centerY + (style.previewSize * 0.3)
        );

        // Add hover glow effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    console.log('Finished drawing word preview');
}

