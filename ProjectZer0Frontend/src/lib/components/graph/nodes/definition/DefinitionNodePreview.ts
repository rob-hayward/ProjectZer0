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
    const startX = centerX - (style.previewSize / 2) + style.padding.preview;
    let y = centerY - (style.previewSize / 3);
    const maxWidth = style.previewSize - (style.padding.preview * 2);

    // Draw title
    ctx.font = NODE_CONSTANTS.FONTS.title;
    ctx.fillStyle = style.colors.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'live' ? "Live Definition" : "Alternative Definition", startX, y);
    y += style.lineHeight.preview;
    
    // Draw word
    ctx.font = NODE_CONSTANTS.FONTS.value;
    ctx.fillText(word, startX, y);
    y += style.lineHeight.preview * 2;
    
    // Draw definition text
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
        ctx.fillText(
            "click to zoom",
            centerX,
            centerY + (style.previewSize * 0.3)
        );
    }
}