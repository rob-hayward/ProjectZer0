// src/lib/components/graph/nodes/utils/textUtils.ts

/**
 * Wraps text into lines based on character limit
 * 
 * @param text - Text to wrap
 * @param maxCharsPerLine - Maximum characters per line
 * @param maxLines - Maximum number of lines (optional)
 * @returns Array of text lines
 */
export function wrapText(
    text: string, 
    maxCharsPerLine: number, 
    maxLines?: number
  ): string[] {
    if (!text) return [''];
    
    const lines = text.split(' ').reduce((acc, word) => {
      const currentLine = acc[acc.length - 1] || '';
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      
      if (!currentLine || testLine.length <= maxCharsPerLine) {
        acc[acc.length - 1] = testLine;
      } else {
        acc.push(word);
      }
      return acc;
    }, ['']);
  
    return maxLines ? lines.slice(0, maxLines) : lines;
  }
  
  /**
   * Wraps text for preview mode with standard settings
   * 
   * @param text - Text to wrap
   * @param radius - Node radius for width calculation
   * @param maxLines - Maximum lines to show
   * @returns Array of text lines
   */
  export function wrapTextForPreview(
    text: string, 
    radius: number, 
    maxLines: number = 5
  ): string[] {
    const textWidth = radius * 2 - 45;
    const maxCharsPerLine = Math.floor(textWidth / 8); // 8px per character estimate
    return wrapText(text, maxCharsPerLine, maxLines);
  }
  
  /**
   * Truncates text to a maximum length with ellipsis
   * 
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   */
  export function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  }
  
  /**
   * Formats numbers consistently across the application
   * 
   * @param value - Number to format
   * @returns Formatted number string
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
   * 
   * @param date - Date to format (string or Date object)
   * @returns Formatted date string
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
   * Calculates text width for SVG text elements
   * 
   * @param radius - Node radius
   * @param padding - Padding to subtract from width
   * @returns Calculated text width
   */
  export function calculateTextWidth(radius: number, padding: number = 45): number {
    return radius * 2 - padding;
  }
  
  /**
   * Calculates maximum characters per line based on width and font size
   * 
   * @param width - Available width in pixels
   * @param fontSize - Font size in pixels (default 8)
   * @returns Maximum characters per line
   */
  export function calculateMaxCharsPerLine(width: number, fontSize: number = 8): number {
    return Math.floor(width / fontSize);
  }
  
  /**
   * Creates a score display string from net votes
   * 
   * @param netVotes - Net vote count
   * @returns Formatted score string
   */
  export function formatScore(netVotes: number): string {
    return netVotes > 0 ? `+${netVotes}` : netVotes.toString();
  }
  
  /**
   * Determines vote status from net votes
   * 
   * @param netVotes - Net vote count
   * @returns Status string
   */
  export function getVoteStatus(netVotes: number): string {
    return netVotes > 0 ? 'agreed' : netVotes < 0 ? 'disagreed' : 'undecided';
  }