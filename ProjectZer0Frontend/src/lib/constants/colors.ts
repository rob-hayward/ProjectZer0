// ProjectZer0Frontend/src/lib/constants/colors.ts
export const COLORS = {
    // Primary colors - Updated with Newton's Color Wheel (bright versions)
    PRIMARY: {
        // Newton's Color Wheel - Content Node Colors (6 colors, avoiding red/green for voting)
        INDIGO: '#4f46e5',      // Word nodes (240° - foundational content)
        BLUE_VIOLET: '#7c3aed', // Definition nodes (270° - related to words)  
        CYAN: '#06b6d4',        // OpenQuestion nodes (180° - questions, attention-getting)
        YELLOW: '#f59e0b',      // Statement nodes (60° - bright, central statements)
        ORANGE: '#ea580c',      // Quantity nodes (30° - data/metrics)
        MAGENTA: '#ec4899',     // Comment nodes (300° - meta-content)
        
        // Voting Colors (preserved as specified)
        GREEN: '#2ecc71',       // Positive vote buttons (120°)
        RED: '#e74c3c',         // Negative vote buttons (0°)
        
        // Legacy colors (keeping for backward compatibility if needed)
        BLUE: '#3498db',        // Vibrant blue (legacy)
        PURPLE: '#9b59b6',      // Royal purple (legacy)
        TURQUOISE: '#1abc9c',   // Turquoise (legacy)
        FOREST: '#27ae60',      // Forest green (legacy)
    },

    // UI colors
    UI: {
        BACKGROUND: '#000000',
        TEXT: {
            PRIMARY: '#FFFFFF',
            SECONDARY: 'rgba(255, 255, 255, 0.7)',
            TERTIARY: 'rgba(255, 255, 255, 0.5)'
        },
        BORDER: {
            LIGHT: 'rgba(255, 255, 255, 0.2)',
            LIGHTER: 'rgba(255, 255, 255, 0.4)'
        }
    },

    // Graph specific colors
    GRAPH: {
        NODE: {
            BACKGROUND: 'rgba(0, 0, 0, 0.7)',
            BORDER: 'rgba(255, 255, 255, 0.2)',
            HOVER_BORDER: 'rgba(255, 255, 255, 0.4)',
            GLOW: 'rgba(255, 255, 255, 0.15)'
        },
        EDGE: {
            DEFAULT: 'rgba(255, 255, 255, 0.2)',
            HIGHLIGHT: 'rgba(255, 255, 255, 0.4)'
        }
    }
} as const;