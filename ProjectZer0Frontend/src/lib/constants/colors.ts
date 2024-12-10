// ProjectZer0Frontend/src/lib/constants/colors.ts
export const COLORS = {
    // Primary colors
    PRIMARY: {
        BLUE: '#3498db',    // Vibrant blue
        YELLOW: '#f1c40f',  // Sunflower yellow
        PURPLE: '#9b59b6',  // Royal purple
        GREEN: '#2ecc71',   // Emerald green
        TURQUOISE: '#1abc9c', // Turquoise
        ORANGE: '#e67e22',  // Carrot orange
        RED: '#e74c3c',     // Coral red
        FOREST: '#27ae60'   // Forest green
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