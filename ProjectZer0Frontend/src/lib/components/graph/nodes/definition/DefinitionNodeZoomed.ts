import type { Definition, NodeStyle } from '$lib/types/nodes';
import type { UserProfile } from '$lib/types/user';
import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
import { drawWrappedText, getDisplayName, getVoteValue } from '../utils/nodeUtils';

export function drawDefinitionNodeZoomed(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    style: NodeStyle,
    definition: Definition,
    word: string,
    creatorDetails: UserProfile | null,
    type: 'live' | 'alternative'
) {
    const CONTENT_WIDTH = 350;
    const CONTENT_START_Y = -180;
    
    const startX = centerX - (CONTENT_WIDTH / 2);
    let y = centerY + CONTENT_START_Y;

    // Draw title
    ctx.font = NODE_CONSTANTS.FONTS.title;
    ctx.fillStyle = style.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'live' ? "Live Definition Node" : "Alternative Definition Node", centerX, y);
    y += 40;

    // Draw word section
    ctx.font = `18px "Orbitron", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText("word:", startX, y);
    
    const wordOffset = ctx.measureText("word: ").width + 10;
    ctx.fillText(word, startX + wordOffset, y);
    y += 35;

    // Draw definition section
    ctx.fillText("definition:", startX, y);
    y += 20;

    ctx.font = NODE_CONSTANTS.FONTS.value;
    y = drawWrappedText(
        ctx,
        definition.text,
        startX,
        y,
        CONTENT_WIDTH,
        style.lineHeight.zoomed
    );
    y += 35;

    // Draw votes section
    if (definition.createdBy !== 'FreeDictionaryAPI') {
        ctx.font = NODE_CONSTANTS.FONTS.title;
        ctx.fillText("definition approval votes:", startX, y);
        
        ctx.font = NODE_CONSTANTS.FONTS.value;
        const votesOffset = ctx.measureText("definition approval votes: ").width + 10;
        ctx.fillText(getVoteValue(definition.votes).toString(), startX + votesOffset, y);
        y += 35;
    }

    // Credits section
    y = centerY + (CIRCLE_RADIUS - 110);
    
    ctx.font = '10px "Orbitron", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText("Definition created by:", startX, y);
    y += 20;

    ctx.fillStyle = 'white';
    const creator = getDisplayName(
        definition.createdBy,
        creatorDetails,
        false
    );
    ctx.fillText(creator, startX, y);
}