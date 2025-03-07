// src/components/graph/nodes/utils/nodeUtils.ts
import type { UserProfile } from '$lib/types/domain/user';

interface VoteWithLow {
    low: number;
}

interface NodeWithVotes {
    positiveVotes?: number | VoteWithLow;
    negativeVotes?: number | VoteWithLow;
    votes?: number | VoteWithLow;
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

    // Update the getNetVotes function to be more flexible with its parameter type
    export function getNetVotes(nodeData: any): number {
        // Safety check for null/undefined
        if (!nodeData) return 0;

        // If using new voting system with positiveVotes/negativeVotes
        if ('positiveVotes' in nodeData && 'negativeVotes' in nodeData) {
            const pos = getVoteValue(nodeData.positiveVotes);
            const neg = getVoteValue(nodeData.negativeVotes);
            return pos - neg;
        }
        
        // Fallback for old voting system with just votes property
        if ('votes' in nodeData) {
            return getVoteValue(nodeData.votes);
        }
        
        // If nothing matches, return 0
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