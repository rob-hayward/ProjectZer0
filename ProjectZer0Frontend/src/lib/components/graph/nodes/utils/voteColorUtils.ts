// src/lib/utils/voteColorUtils.ts
/**
 * Utility functions for mapping vote counts to visual styling
 * Using a "stellar temperature" scale where:
 * - Highest votes: White/Blue-white (hottest stars)
 * - High votes: Yellow-white
 * - Medium votes: Yellow
 * - Low votes: Yellow-orange
 * - Zero votes: Orange
 * - Negative votes: Red to deep red (coolest stars)
 */

/**
 * Maps a vote count to a color on the stellar temperature scale
 * @param votes Net vote count (positive or negative)
 * @param maxVotes Maximum vote count to use for scaling (optional)
 * @returns Hex color string
 */
export function getVoteBasedColor(votes: number, maxVotes: number = 50): string {
    // Handle negative votes (red spectrum)
    if (votes < 0) {
        // Map negative votes from orange-red to deep red
        // We use a square root scale to make the transition more gradual
        const intensity = Math.min(1, Math.sqrt(Math.abs(votes) / 25));
        
        // Interpolate from orange-red (#FF4500) to deep red (#8B0000)
        const r = Math.floor(255 - intensity * (255 - 139));
        const g = Math.floor(69 - intensity * 69);
        const b = Math.floor(0 + intensity * 0);
        
        return rgbToHex(r, g, b);
    }
    
    // Handle zero votes (neutral orange)
    if (votes === 0) {
        return '#FF8C00'; // Dark orange
    }
    
    // Handle positive votes (yellow to white spectrum)
    // Use a logarithmic scale to better distribute visual differences
    // This makes small differences in low vote counts more visible
    const normalizedVotes = Math.min(1, Math.log(votes + 1) / Math.log(maxVotes + 1));
    
    // Interpolate from yellow-orange to white
    // Start from orange-yellow (#FFA500) for low positive votes
    // Transition through yellow (#FFFF00)
    // End at yellow-white (#FFFFCC) for highest votes
    
    if (normalizedVotes < 0.33) {
        // Orange-yellow to yellow (first third)
        const ratio = normalizedVotes * 3;
        const r = 255;
        const g = Math.floor(165 + ratio * (255 - 165));
        const b = 0;
        return rgbToHex(r, g, b);
    } else if (normalizedVotes < 0.66) {
        // Yellow to yellow-white (second third)
        const ratio = (normalizedVotes - 0.33) * 3;
        const r = 255;
        const g = 255;
        const b = Math.floor(ratio * 204);
        return rgbToHex(r, g, b);
    } else {
        // Yellow-white to white (final third for very high votes)
        const ratio = (normalizedVotes - 0.66) * 3;
        const r = 255;
        const g = 255;
        const b = Math.floor(204 + ratio * (255 - 204));
        return rgbToHex(r, g, b);
    }
}

/**
 * Get appropriate text color (black or white) based on background color brightness
 * @param bgColor Background color in hex
 * @returns Text color in hex
 */
export function getContrastingTextColor(bgColor: string): string {
    // Convert hex to RGB
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    
    // Calculate perceived brightness (YIQ equation)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // Return black for bright colors, white for dark colors
    return (yiq >= 160) ? '#000000' : '#FFFFFF';
}

/**
 * Calculate glow intensity based on vote count
 * Higher vote counts (pos or neg) have stronger glows
 * @param votes Net vote count
 * @param maxVotes Maximum vote benchmark
 * @returns Value between 0.3 (minimum) and 1.0 (maximum)
 */
export function getGlowIntensity(votes: number, maxVotes: number = 50): number {
    // Use absolute value to ensure positive and negative votes both get appropriate glow
    const absVotes = Math.abs(votes);
    
    // Normalize with log scale for better visual distribution
    const normalizedVotes = Math.min(1, Math.log(absVotes + 1) / Math.log(maxVotes + 1));
    
    // Scale between 0.3 (min) and 1.0 (max)
    return 0.3 + (normalizedVotes * 0.7);
}

/**
 * Calculate glow size based on vote count
 * @param votes Net vote count
 * @param baseSize Base glow size
 * @param maxVotes Maximum vote benchmark
 * @returns Glow size multiplier between 1.0 and 1.5
 */
export function getGlowSize(votes: number, baseSize: number, maxVotes: number = 50): number {
    const absVotes = Math.abs(votes);
    const normalizedVotes = Math.min(1, Math.log(absVotes + 1) / Math.log(maxVotes + 1));
    
    // Scale between 1.0 (min) and 1.5 (max)
    return baseSize * (1 + (normalizedVotes * 0.5));
}

/**
 * Convert RGB values to hex color string
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns Hex color string (e.g., "#FF5500")
 */
function rgbToHex(r: number, g: number, b: number): string {
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

/**
 * Convert a single color component to hex
 * @param c Color component (0-255)
 * @returns Hex string for component
 */
function componentToHex(c: number): string {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
}