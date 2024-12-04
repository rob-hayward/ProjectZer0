// src/components/graph/nodes/word/WordNodeZoomed.ts
import type { WordNode, NodeStyle } from '$lib/types/nodes';
import type { UserProfile } from '$lib/types/user';
import { NODE_CONSTANTS, CIRCLE_RADIUS } from '../base/BaseNodeConstants';
import { drawWrappedText, getDisplayName, getVoteValue } from '../utils/nodeUtils';

export function drawWordNodeZoomed(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    style: NodeStyle,
    wordData: WordNode,
    creatorDetails: UserProfile | null,
    liveDefinition: WordNode['definitions'][0] | null,
    definitionCreatorDetails: UserProfile | null
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
    ctx.fillText("Word Node", centerX, y);
    y += 40;

    // Draw word
    ctx.font = `18px "Orbitron", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText("word:", startX, y);
    
    const wordOffset = ctx.measureText("word: ").width + 10;
    ctx.fillText(wordData.word, startX + wordOffset, y);
    y += 35;

    // Draw definition section if available
    if (liveDefinition) {
        ctx.fillText("live definition:", startX, y);
        y += 20;

        ctx.font = NODE_CONSTANTS.FONTS.value;
        y = drawWrappedText(
            ctx,
            liveDefinition.text,
            startX,
            y,
            CONTENT_WIDTH,
            style.lineHeight.zoomed
        );
        y += 35;

        // Draw votes if not from API
        if (liveDefinition.createdBy !== 'FreeDictionaryAPI') {
            ctx.font = NODE_CONSTANTS.FONTS.title;
            ctx.fillText("definition approval votes:", startX, y);
            
            ctx.font = NODE_CONSTANTS.FONTS.value;
            const votesOffset = ctx.measureText("definition approval votes: ").width + 10;
            ctx.fillText(getVoteValue(liveDefinition.votes).toString(), startX + votesOffset, y);
            y += 35;
        }
    }

    // Credits section
    y = centerY + (CIRCLE_RADIUS - 110);

    const labelX = startX;
    const secondColumnX = startX + (CONTENT_WIDTH / 2) + 20;
    
    ctx.font = '10px "Orbitron", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText("Word created by:", labelX, y);
    if (liveDefinition) {
        ctx.fillText("Definition created by:", secondColumnX, y);
    }
    y += 20;

    ctx.fillStyle = 'white';
    const wordCreator = getDisplayName(wordData.createdBy, creatorDetails, !wordData.publicCredit);
    const defCreator = liveDefinition ? getDisplayName(
        liveDefinition.createdBy, 
        definitionCreatorDetails,
        false
    ) : '';
    
    ctx.fillText(wordCreator, labelX, y);
    if (liveDefinition) {
        ctx.fillText(defCreator, secondColumnX, y);
    }
}