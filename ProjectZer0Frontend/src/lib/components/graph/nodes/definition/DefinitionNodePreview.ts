// src/components/graph/nodes/definition/DefinitionNodePreview.ts
import type { Definition, NodeStyle } from '$lib/types/nodes';
import { NODE_CONSTANTS } from '../base/BaseNodeConstants';
import { drawWrappedText } from '../utils/nodeUtils';

export function drawDefinitionNodePreview(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    style: NodeStyle,
    isHovered: boolean,
    definition: Definition,
    word: string,
    type: 'live' | 'alternative'
) {
    console.log('Drawing definition preview:', {
        centerX,
        centerY,
        style,
        isHovered,
        type,
        word,
        definition
    });

    // Draw a visible background for debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, style.previewSize / 2 - 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const startX = centerX - (style.previewSize / 2) + style.padding.preview;
    let y = centerY - (style.previewSize / 3);
    const maxWidth = style.previewSize - (style.padding.preview * 2);

    // Draw title with enhanced visibility
    ctx.font = NODE_CONSTANTS.FONTS.title;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'live' ? "Live Definition" : "Alternative Definition", startX, y);
    y += style.lineHeight.preview;
    
    // Draw word with enhanced visibility
    ctx.font = NODE_CONSTANTS.FONTS.value;
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText(word, startX, y);
    y += style.lineHeight.preview * 2;
    
    // Draw definition text with enhanced visibility
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    y = drawWrappedText(
        ctx,
        definition.text,
        startX,
        y,
        maxWidth,
        style.lineHeight.preview
    );

    // Draw hover text if needed
    if (isHovered) {
        ctx.font = NODE_CONSTANTS.FONTS.hover;
        ctx.textAlign = 'center';
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

    console.log('Finished drawing definition preview');
}