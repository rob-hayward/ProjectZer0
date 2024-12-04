// src/components/graph/nodes/utils/nodeUtils.ts
import type { UserProfile } from '$lib/types/user';

interface VoteWithLow {
    low: number;
}

export function drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number
): number {
    const words = text.split(' ');
    let line = '';
    let y = startY;

    for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, x, y);
            line = word;
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    
    if (line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
    }

    return y;
}

export function getVoteValue(votes: number | VoteWithLow | unknown): number {
    if (typeof votes === 'number') return votes;
    if (isVoteWithLow(votes)) {
        return votes.low;
    }
    return 0;
}

export function getDisplayName(
    userId: string, 
    userDetails: UserProfile | null, 
    isAnonymous: boolean = false
): string {
    if (isAnonymous) return 'Anonymous';
    if (userId === 'FreeDictionaryAPI') return 'Free Dictionary API';
    return userDetails?.preferred_username || userDetails?.name || 'User';
}

function isVoteWithLow(vote: unknown): vote is VoteWithLow {
    return typeof vote === 'object' && 
           vote !== null && 
           'low' in vote && 
           typeof (vote as VoteWithLow).low === 'number';
}