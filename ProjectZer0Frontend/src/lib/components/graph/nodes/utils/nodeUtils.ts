// src/components/graph/nodes/utils/nodeUtils.ts
import type { UserProfile } from '$lib/types/domain/user';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';

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

/**
 * Convert Neo4j vote values to regular numbers
 * This uses the central getNeo4jNumber utility for consistency
 */
export function getVoteValue(votes: any): number {
    return getNeo4jNumber(votes);
}

/**
 * Calculate net votes for a node using the standardized extraction
 */
export function getNetVotes(nodeData: any): number {
    // Safety check for null/undefined
    if (!nodeData) return 0;
    
    // If using votes system with positiveVotes/negativeVotes
    if ('positiveVotes' in nodeData && 'negativeVotes' in nodeData) {
        const pos = getNeo4jNumber(nodeData.positiveVotes);
        const neg = getNeo4jNumber(nodeData.negativeVotes);
        return pos - neg;
    }
    
    // Fallback for old voting system with just votes property
    if ('votes' in nodeData) {
        return getNeo4jNumber(nodeData.votes);
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