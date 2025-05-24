// src/lib/components/graph/nodes/utils/textUtils.ts
import { COORDINATE_SPACE } from '$lib/constants/graph/coordinate-space';
import type { NodeType } from '$lib/types/graph/enhanced';

/**
 * Enhanced text wrapping that uses content box dimensions
 */
export function wrapTextForContentBox(
    text: string,
    nodeType: NodeType,
    mode: 'preview' | 'detail',
    options: {
        fontSize?: number;
        fontFamily?: string;
        padding?: number;
        maxLines?: number;
        section?: 'content' | 'voting' | 'stats';
    } = {}
): string[] {
    const {
        fontSize = 14,
        fontFamily = 'Inter', // New default font
        padding = 20,
        maxLines = undefined,
        section = 'content'
    } = options;

    // Get content box size for this node type
    const boxSize = getContentBoxSize(nodeType, mode);
    
    // Calculate available width (with padding)
    const availableWidth = boxSize - (padding * 2);
    
    // Get section height allocation
    const sectionHeight = getSectionHeight(boxSize, section);
    
    // Estimate character width based on font
    const charWidth = getCharacterWidth(fontSize, fontFamily);
    const maxCharsPerLine = Math.floor(availableWidth / charWidth);
    
    // Calculate max lines based on section height and font size
    const lineHeight = fontSize * 1.4; // Standard line height
    const calculatedMaxLines = Math.floor(sectionHeight / lineHeight);
    const finalMaxLines = maxLines !== undefined 
        ? Math.min(maxLines, calculatedMaxLines) 
        : calculatedMaxLines;

    return wrapText(text, maxCharsPerLine, finalMaxLines);
}

/**
 * Get content box size for any node type and mode
 */
function getContentBoxSize(nodeType: NodeType, mode: 'preview' | 'detail'): number {
    const sizeMap = COORDINATE_SPACE.CONTENT_BOXES;
    
    switch(nodeType) {
        case 'word': 
            return mode === 'detail' ? sizeMap.WORD.DETAIL : sizeMap.WORD.PREVIEW;
        case 'definition': 
            return mode === 'detail' ? sizeMap.DEFINITION.DETAIL : sizeMap.DEFINITION.PREVIEW;
        case 'statement': 
            return mode === 'detail' ? sizeMap.STATEMENT.DETAIL : sizeMap.STATEMENT.PREVIEW;
        case 'quantity': 
            return mode === 'detail' ? sizeMap.QUANTITY.DETAIL : sizeMap.QUANTITY.PREVIEW;
        case 'comment': 
            return mode === 'detail' ? sizeMap.COMMENT.DETAIL : sizeMap.COMMENT.PREVIEW;
        default: 
            return mode === 'detail' ? sizeMap.STANDARD.DETAIL : sizeMap.STANDARD.PREVIEW;
    }
}

/**
 * Get allocated height for different sections within content box
 */
function getSectionHeight(boxSize: number, section: 'content' | 'voting' | 'stats'): number {
    switch(section) {
        case 'content': return Math.floor(boxSize * 0.60); // 60% for main content
        case 'voting': return Math.floor(boxSize * 0.25);  // 25% for voting controls
        case 'stats': return Math.floor(boxSize * 0.15);   // 15% for statistics
        default: return boxSize;
    }
}

/**
 * Estimate character width for different fonts
 */
function getCharacterWidth(fontSize: number, fontFamily: string): number {
    // Character width estimates (pixels per character at given font size)
    const fontWidthRatios = {
        'Inter': 0.6,           // Recommended new font - efficient
        'Source Sans Pro': 0.6,  // Alternative - efficient  
        'Roboto': 0.6,          // Alternative - efficient
        'Orbitron': 0.8,        // Current font - less efficient
        'monospace': 0.7,       // Fallback
        'sans-serif': 0.6       // Fallback
    };
    
    const ratio = fontWidthRatios[fontFamily as keyof typeof fontWidthRatios] || 0.6;
    return fontSize * ratio;
}

/**
 * Original text wrapping function (enhanced)
 */
export function wrapText(
    text: string, 
    maxCharsPerLine: number, 
    maxLines?: number
): string[] {
    if (!text) return [''];
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        
        if (!currentLine || testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    // Apply line limit if specified
    if (maxLines && lines.length > maxLines) {
        const truncatedLines = lines.slice(0, maxLines);
        // Add ellipsis to last line if text was truncated
        if (truncatedLines.length > 0) {
            const lastLine = truncatedLines[truncatedLines.length - 1];
            if (lastLine.length + 3 <= maxCharsPerLine) {
                truncatedLines[truncatedLines.length - 1] = lastLine + '...';
            } else {
                truncatedLines[truncatedLines.length - 1] = lastLine.slice(0, -3) + '...';
            }
        }
        return truncatedLines;
    }
    
    return lines;
}

/**
 * Wraps text for preview mode with standard settings
 */
export function wrapTextForPreview(
    text: string, 
    nodeType: NodeType,
    maxLines: number = 3
): string[] {
    return wrapTextForContentBox(text, nodeType, 'preview', {
        fontSize: 12,
        fontFamily: 'Inter',
        maxLines,
        section: 'content'
    });
}

/**
 * Wraps text for detail mode with standard settings
 */
export function wrapTextForDetail(
    text: string, 
    nodeType: NodeType,
    section: 'content' | 'voting' | 'stats' = 'content',
    maxLines?: number
): string[] {
    return wrapTextForContentBox(text, nodeType, 'detail', {
        fontSize: 14,
        fontFamily: 'Inter',
        maxLines,
        section
    });
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
}

/**
 * Formats numbers consistently across the application
 */
export function formatNumber(value: number): string {
    if (value === undefined || value === null) return '-';
    return Math.abs(value) < 0.01 
        ? value.toExponential(2) 
        : Number.isInteger(value) 
            ? value.toString() 
            : value.toFixed(2);
}

/**
 * Formats date consistently across the application
 */
export function formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Creates a score display string from net votes
 */
export function formatScore(netVotes: number): string {
    return netVotes > 0 ? `+${netVotes}` : netVotes.toString();
}

/**
 * Determines vote status from net votes
 */
export function getVoteStatus(netVotes: number): string {
    return netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
}